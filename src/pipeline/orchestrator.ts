/**
 * Pipeline Orchestrator
 * 
 * Single entry point for running the entire self-review generation pipeline.
 * Designed to be called from Next.js API routes or CLI.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchMergedPRs, PRListConfig } from '../crawler/pr-crawler.js';
import { parsePRPage } from '../normalizer/pr-parser.js';
import { fetchJiraTicket } from '../crawler/jira-crawler.js';
import { summarizePR, PRSummary } from '../summarizer/pr-summarizer.js';
import { launchBrowser, closeBrowser } from '../crawler/browser.js';
import { parseCareerFramework } from '../framework/parser.js';
import { alignToFramework, ProcessedPR } from '../framework/aligner.js';
import { synthesizeReview } from '../synthesizer/rhg-synthesizer.js';
import { ParsedPR } from '../normalizer/types.js';
import { ParsedJira } from '../normalizer/jira-types.js';
import { PipelineConfig, PipelineResult, ProgressCallback, PipelineProgress } from './types.js';
import { SelfReview } from '../synthesizer/types.js';

const DATA_DIR = 'data';
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const ALIGNMENT_FILE = path.join(DATA_DIR, 'alignment.json');
const REVIEW_FILE = path.join(DATA_DIR, 'self-review.json');

/**
 * Default progress callback (console logging)
 */
const defaultProgress: ProgressCallback = (p: PipelineProgress) => {
  const prefix = p.current && p.total ? `[${p.current}/${p.total}]` : '';
  console.log(`[${p.stage}] ${prefix} ${p.message}`);
};

/**
 * Run the complete self-review generation pipeline.
 * 
 * @param config Pipeline configuration
 * @param onProgress Optional callback for progress updates
 * @returns Pipeline result with generated review
 */
export async function runPipeline(
  config: PipelineConfig,
  onProgress: ProgressCallback = defaultProgress
): Promise<PipelineResult> {
  const startTime = Date.now();
  let totalPRs = 0;
  let parsedPRs = 0;
  let jiraTickets = 0;

  // Ensure directories exist
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });

  try {
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 1: Fetch PRs from all repos
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ stage: 'fetching_prs', message: 'Starting PR discovery...' });

    const allPRs: Array<{ title: string; url: string; prNumber: string; repoUrl: string }> = [];

    for (const repoUrl of config.repoUrls) {
      onProgress({ 
        stage: 'fetching_prs', 
        message: `Fetching from ${repoUrl.split('/').slice(-1)[0]}...` 
      });

      const prConfig: PRListConfig = {
        repoUrl,
        userId: config.userId,
        createdAfter: config.createdAfter,
        createdBefore: config.createdBefore,
      };

      const prs = await fetchMergedPRs(prConfig, 10);
      prs.forEach(pr => allPRs.push({ ...pr, repoUrl }));
    }

    totalPRs = allPRs.length;
    onProgress({ 
      stage: 'fetching_prs', 
      message: `Found ${totalPRs} merged PRs across ${config.repoUrls.length} repo(s)` 
    });

    if (totalPRs === 0) {
      return {
        success: false,
        error: 'No merged PRs found for the given filters',
        stats: { totalPRs: 0, parsedPRs: 0, jiraTickets: 0, duration: Date.now() - startTime }
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    // STAGE 2: Parse PRs and fetch Jira
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ stage: 'parsing_prs', message: 'Launching browser...' });
    
    const context = await launchBrowser();
    const page = await context.newPage();

    const processedPRs: ProcessedPR[] = [];

    for (let i = 0; i < allPRs.length; i++) {
      const prItem = allPRs[i];
      
      onProgress({ 
        stage: 'parsing_prs', 
        message: `Parsing PR #${prItem.prNumber}`,
        current: i + 1,
        total: totalPRs
      });

      try {
        // Parse PR page
        const parsedPR: ParsedPR = await parsePRPage(page, prItem.url, prItem.prNumber);
        parsedPRs++;

        // Fetch Jira if available
        let jira: ParsedJira | undefined;
        if (parsedPR.jiraId) {
          onProgress({ 
            stage: 'fetching_jira', 
            message: `Fetching ${parsedPR.jiraId}`,
            current: i + 1,
            total: totalPRs
          });
          
          try {
            jira = await fetchJiraTicket(page, parsedPR.jiraId);
            jiraTickets++;
          } catch {
            // Continue without Jira context
          }
        }

        // Generate summary
        onProgress({ 
          stage: 'summarizing', 
          message: `Summarizing PR #${prItem.prNumber}`,
          current: i + 1,
          total: totalPRs
        });

        const summary: PRSummary = await summarizePR(parsedPR, jira);

        // Build processed PR object
        const processed: ProcessedPR = {
          prNumber: parsedPR.prNumber,
          title: parsedPR.title,
          type: parsedPR.type,
          jiraId: parsedPR.jiraId || undefined,
          summary: summary.summary,
          metadata: {
            repo: prItem.repoUrl,
            url: parsedPR.url,
            screenshotCount: parsedPR.screenshotUrls.length,
            hasJiraContext: !!jira,
          },
        };

        // Save to file
        const filename = `pr-${parsedPR.prNumber}.summary.json`;
        fs.writeFileSync(
          path.join(PROCESSED_DIR, filename),
          JSON.stringify(processed, null, 2)
        );

        processedPRs.push(processed);

      } catch (error) {
        console.error(`Failed to process PR #${prItem.prNumber}:`, error);
        // Continue with other PRs
      }
    }

    await page.close();

    // ═══════════════════════════════════════════════════════════════════
    // STAGE 3: Align to career framework
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ stage: 'aligning', message: 'Parsing career framework...' });
    
    const framework = parseCareerFramework(config.frameworkPath);
    
    onProgress({ stage: 'aligning', message: 'Aligning PRs to competencies...' });
    
    const alignment = await alignToFramework(framework, processedPRs, true);

    // Save alignment
    fs.writeFileSync(ALIGNMENT_FILE, JSON.stringify({
      framework: {
        level: framework.level,
        competencies: framework.competencies,
      },
      alignments: alignment.alignments,
      summary: alignment.summary,
    }, null, 2));

    // ═══════════════════════════════════════════════════════════════════
    // STAGE 4: Generate R-H-G review
    // ═══════════════════════════════════════════════════════════════════
    onProgress({ stage: 'generating', message: 'Generating self-review...' });

    const review: SelfReview = await synthesizeReview(
      ALIGNMENT_FILE,
      PROCESSED_DIR,
      config.roleLevel,
      config.frameworkPath
    );

    // Save review
    fs.writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2));

    onProgress({ stage: 'complete', message: 'Pipeline complete!' });

    return {
      success: true,
      review,
      stats: {
        totalPRs,
        parsedPRs,
        jiraTickets,
        duration: Date.now() - startTime,
      },
    };

  } catch (error) {
    onProgress({ 
      stage: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: {
        totalPRs,
        parsedPRs,
        jiraTickets,
        duration: Date.now() - startTime,
      },
    };

  } finally {
    await closeBrowser();
  }
}

/**
 * Quick regenerate: skip PR fetching/parsing, just regenerate review from existing data.
 */
export async function regenerateReview(
  roleLevel: string,
  frameworkPath: string
): Promise<SelfReview> {
  if (!fs.existsSync(ALIGNMENT_FILE)) {
    throw new Error('No alignment data found. Run full pipeline first.');
  }

  if (!fs.existsSync(PROCESSED_DIR)) {
    throw new Error('No processed PRs found. Run full pipeline first.');
  }

  return synthesizeReview(ALIGNMENT_FILE, PROCESSED_DIR, roleLevel, frameworkPath);
}

/**
 * Get current pipeline data if it exists.
 */
export function getPipelineData(): { alignment: unknown; review: SelfReview | null } | null {
  if (!fs.existsSync(ALIGNMENT_FILE)) {
    return null;
  }

  const alignment = JSON.parse(fs.readFileSync(ALIGNMENT_FILE, 'utf-8'));
  
  let review: SelfReview | null = null;
  if (fs.existsSync(REVIEW_FILE)) {
    review = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf-8'));
  }

  return { alignment, review };
}
