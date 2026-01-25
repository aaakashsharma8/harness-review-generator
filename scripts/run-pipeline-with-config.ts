/**
 * Pipeline Runner with Dynamic Config
 * 
 * Produces clean, consolidated output files:
 *   data/raw.json       - All parsed PR data
 *   data/processed.json - All summaries  
 *   data/alignment.json - Framework mapping
 *   data/self-review.json - Final R-H-G output
 * 
 * Usage: npm run pipeline:dynamic
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchMergedPRs, PRListConfig } from '../src/crawler/pr-crawler.js';
import { parsePRPage } from '../src/normalizer/pr-parser.js';
import { fetchJiraTicket } from '../src/crawler/jira-crawler.js';
import { summarizePR, PRSummary } from '../src/summarizer/pr-summarizer.js';
import { launchBrowser, closeBrowser } from '../src/crawler/browser.js';
import { parseFramework } from '../src/framework/parser.js';
import { alignToFramework, ProcessedPR } from '../src/framework/aligner.js';
import { synthesizeReviewFromData } from '../src/synthesizer/rhg-synthesizer.js';
import { ParsedPR } from '../src/normalizer/types.js';
import { ParsedJira } from '../src/normalizer/jira-types.js';

const CONFIG_FILE = 'data/pipeline-config.json';
const RAW_FILE = 'data/raw.json';
const PROCESSED_FILE = 'data/processed.json';
const ALIGNMENT_FILE = 'data/alignment.json';
const REVIEW_FILE = 'data/self-review.json';
const MAX_PAGES = 10;

interface PipelineConfig {
  userId: string;
  repoUrls: string[];
  roleLevel: string;
  frameworkPath: string;
  createdAfter?: string;
  createdBefore?: string;
}

interface RawPRData {
  prNumber: string;
  title: string;
  description: string;
  type: string;
  jiraId: string | null;
  url: string;
  repo: string;
  screenshotUrls: string[];
  jiraContext?: {
    summary: string;
    description: string;
    type: string;
    status: string;
    releaseNotes?: string;
  };
}

interface RawDataFile {
  generatedAt: string;
  config: PipelineConfig;
  totalPRs: number;
  prs: RawPRData[];
}

interface ProcessedPRData {
  prNumber: string;
  title: string;
  type: string;
  jiraId: string | null;
  repo: string;
  summary: {
    what: string;
    why: string;
    how: string;
    impact: string;
  };
}

interface ProcessedDataFile {
  generatedAt: string;
  totalPRs: number;
  summaries: ProcessedPRData[];
}

// Default config (fallback)
const DEFAULT_CONFIG: PipelineConfig = {
  userId: '1374',
  repoUrls: ['https://harness0.harness.io/ng/account/l7B_kbSEQD2wjrM7PShm5w/module/code/orgs/PROD/projects/Harness_Commons/repos/harness-core-ui'],
  roleLevel: 'Senior Software Engineer 1',
  frameworkPath: 'data/career-framework/SSE1.txt',
};

function loadConfig(): PipelineConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    console.log(`[pipeline] Loading config from ${CONFIG_FILE}`);
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  }
  console.log('[pipeline] Using default config');
  return DEFAULT_CONFIG;
}

function normalizeRepoUrl(url: string): string {
  // Remove /summary/refs/heads/main or similar suffixes
  return url
    .replace(/\/summary.*$/, '')
    .replace(/\/pulls.*$/, '')
    .replace(/\/files.*$/, '');
}

async function main() {
  const config = loadConfig();
  
  console.log('\n' + '='.repeat(60));
  console.log('  FULL PIPELINE - Self Review Data Generation');
  console.log('='.repeat(60) + '\n');

  console.log('[pipeline] Config:');
  console.log(`  User ID: ${config.userId}`);
  console.log(`  Repos: ${config.repoUrls.length}`);
  config.repoUrls.forEach(r => console.log(`    - ${normalizeRepoUrl(r)}`));
  console.log(`  Role: ${config.roleLevel}`);
  if (config.createdAfter) console.log(`  After: ${config.createdAfter}`);
  if (config.createdBefore) console.log(`  Before: ${config.createdBefore}`);
  console.log('');

  const startTime = Date.now();
  
  // Ensure data directory exists
  fs.mkdirSync('data', { recursive: true });

  try {
    // ================================================================
    // STEP 1: Fetch all PRs from all repos
    // ================================================================
    console.log('[pipeline] Step 1: Fetching merged PRs...\n');
    
    const allPRItems: Array<{ title: string; url: string; prNumber: string; repoUrl: string }> = [];

    for (const rawRepoUrl of config.repoUrls) {
      const repoUrl = normalizeRepoUrl(rawRepoUrl);
      console.log(`[pipeline] Fetching from: ${repoUrl}`);
      
      const prConfig: PRListConfig = {
        repoUrl,
        userId: config.userId,
        createdAfter: config.createdAfter ? new Date(config.createdAfter) : undefined,
        createdBefore: config.createdBefore ? new Date(config.createdBefore) : undefined,
      };

      const prs = await fetchMergedPRs(prConfig, MAX_PAGES);
      prs.forEach(pr => allPRItems.push({ ...pr, repoUrl }));
      console.log(`[pipeline] Found ${prs.length} PRs from this repo\n`);
    }

    console.log(`[pipeline] Total PRs found: ${allPRItems.length}\n`);

    if (allPRItems.length === 0) {
      console.log('❌ No PRs found. Check your filters and repo URL.');
      return;
    }

    // Get browser context for parsing
    const context = await launchBrowser();
    const page = await context.newPage();

    // ================================================================
    // STEP 2: Parse each PR and collect raw data
    // ================================================================
    console.log('[pipeline] Step 2: Parsing PR pages...\n');
    console.log('─'.repeat(60));

    const rawPRs: RawPRData[] = [];

    for (let i = 0; i < allPRItems.length; i++) {
      const prItem = allPRItems[i];
      const progress = `[${i + 1}/${allPRItems.length}]`;
      
      console.log(`\n${progress} PR #${prItem.prNumber}: ${prItem.title.substring(0, 50)}...`);

      try {
        // Parse PR page
        console.log(`  → Parsing PR page...`);
        const parsedPR: ParsedPR = await parsePRPage(page, prItem.url, prItem.prNumber);

        // Build raw data object
        const rawPR: RawPRData = {
          prNumber: parsedPR.prNumber,
          title: parsedPR.title,
          description: parsedPR.description,
          type: parsedPR.type,
          jiraId: parsedPR.jiraId,
          url: parsedPR.url,
          repo: prItem.repoUrl,
          screenshotUrls: parsedPR.screenshotUrls,
        };

        // Fetch Jira context (if available)
        if (parsedPR.jiraId) {
          console.log(`  → Fetching Jira ${parsedPR.jiraId}...`);
          try {
            const jira: ParsedJira = await fetchJiraTicket(page, parsedPR.jiraId);
            rawPR.jiraContext = {
              summary: jira.summary,
              description: jira.description,
              type: jira.type,
              status: jira.status,
              releaseNotes: jira.releaseNotes,
            };
          } catch {
            console.log(`  ⚠️  Jira fetch failed, continuing without context`);
          }
        }

        rawPRs.push(rawPR);
        console.log(`  ✅ Parsed successfully`);

      } catch (error) {
        console.log(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Save raw data
    const rawDataFile: RawDataFile = {
      generatedAt: new Date().toISOString(),
      config,
      totalPRs: rawPRs.length,
      prs: rawPRs,
    };
    fs.writeFileSync(RAW_FILE, JSON.stringify(rawDataFile, null, 2));
    console.log(`\n[pipeline] ✅ Saved raw data to ${RAW_FILE}`);

    // ================================================================
    // STEP 3: Generate summaries for all PRs
    // ================================================================
    console.log('\n[pipeline] Step 3: Generating summaries...\n');
    console.log('─'.repeat(60));

    const processedPRs: ProcessedPRData[] = [];

    for (let i = 0; i < rawPRs.length; i++) {
      const rawPR = rawPRs[i];
      const progress = `[${i + 1}/${rawPRs.length}]`;
      
      console.log(`${progress} Summarizing PR #${rawPR.prNumber}...`);

      try {
        // Convert raw to ParsedPR format for summarizer
        const parsedPR: ParsedPR = {
          prNumber: rawPR.prNumber,
          title: rawPR.title,
          description: rawPR.description,
          type: rawPR.type as 'feat' | 'fix' | 'chore' | 'hotfix' | 'other',
          jiraId: rawPR.jiraId,
          url: rawPR.url,
          screenshotUrls: rawPR.screenshotUrls,
        };

        // Convert jira context if available
        const jiraContext: ParsedJira | undefined = rawPR.jiraContext ? {
          ticketId: rawPR.jiraId!,
          summary: rawPR.jiraContext.summary,
          description: rawPR.jiraContext.description,
          type: rawPR.jiraContext.type,
          status: rawPR.jiraContext.status,
          releaseNotes: rawPR.jiraContext.releaseNotes,
        } : undefined;

        const summary: PRSummary = await summarizePR(parsedPR, jiraContext);

        processedPRs.push({
          prNumber: rawPR.prNumber,
          title: rawPR.title,
          type: rawPR.type,
          jiraId: rawPR.jiraId,
          repo: rawPR.repo,
          summary: summary.summary,
        });

        console.log(`  ✅ Done`);

      } catch (error) {
        console.log(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await page.close();

    // Save processed data
    const processedDataFile: ProcessedDataFile = {
      generatedAt: new Date().toISOString(),
      totalPRs: processedPRs.length,
      summaries: processedPRs,
    };
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processedDataFile, null, 2));
    console.log(`\n[pipeline] ✅ Saved summaries to ${PROCESSED_FILE}`);

    // ================================================================
    // STEP 4: Align to career framework
    // ================================================================
    console.log('\n[pipeline] Step 4: Aligning to career framework...\n');
    
    const framework = parseFramework(config.frameworkPath);
    
    // Convert to ProcessedPR format for aligner
    const alignerPRs: ProcessedPR[] = processedPRs.map(pr => ({
      prNumber: parseInt(pr.prNumber, 10),
      title: pr.title,
      type: pr.type,
      jiraId: pr.jiraId || undefined,
      summary: pr.summary,
      metadata: { repo: pr.repo },
    }));

    const alignment = await alignToFramework(framework, alignerPRs, true);

    // Save alignment
    fs.writeFileSync(ALIGNMENT_FILE, JSON.stringify({
      generatedAt: new Date().toISOString(),
      framework: { level: framework.level, competencies: framework.competencies },
      alignments: alignment.alignments,
      summary: alignment.summary,
    }, null, 2));
    console.log(`[pipeline] ✅ Saved alignment to ${ALIGNMENT_FILE}`);

    // ================================================================
    // STEP 5: Generate R-H-G review
    // ================================================================
    console.log('\n[pipeline] Step 5: Generating R-H-G review...\n');
    
    const review = await synthesizeReviewFromData(
      processedPRs,
      alignment,
      config.roleLevel
    );

    fs.writeFileSync(REVIEW_FILE, JSON.stringify({
      generatedAt: new Date().toISOString(),
      ...review,
    }, null, 2));
    console.log(`[pipeline] ✅ Saved review to ${REVIEW_FILE}`);

    // ================================================================
    // Summary
    // ================================================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('  PIPELINE COMPLETE');
    console.log('='.repeat(60) + '\n');

    console.log(`  Total PRs:     ${rawPRs.length}`);
    console.log(`  Summarized:    ${processedPRs.length}`);
    console.log(`  Duration:      ${duration}s`);
    console.log(`  Rating:        ⭐ ${review.suggestedRating}`);
    console.log('');
    console.log('  Output files:');
    console.log(`    📄 ${RAW_FILE}       - All parsed PR data`);
    console.log(`    📄 ${PROCESSED_FILE} - All summaries`);
    console.log(`    📄 ${ALIGNMENT_FILE} - Framework mapping`);
    console.log(`    📄 ${REVIEW_FILE}    - Final R-H-G output`);
    console.log('');

  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error);
  } finally {
    await closeBrowser();
    console.log('[pipeline] Done.\n');
  }
}

main();
