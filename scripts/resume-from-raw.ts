/**
 * Resume Pipeline from Existing Raw Data
 *
 * Skips crawling/parsing and starts from:
 *  - Step 3: Summaries  -> writes data/processed.json
 *  - Step 4: Alignment  -> writes data/alignment.json
 *  - Step 5: R-H-G Review -> writes data/self-review.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { summarizePR, PRSummary } from '../src/summarizer/pr-summarizer.js';
import { parseFramework } from '../src/framework/parser.js';
import { alignToFramework } from '../src/framework/aligner.js';
import { synthesizeReviewFromData } from '../src/synthesizer/rhg-synthesizer.js';
import { ParsedPR } from '../src/normalizer/types.js';
import { ParsedJira } from '../src/normalizer/jira-types.js';

const RAW_FILE = 'data/raw.json';
const PROCESSED_FILE = 'data/processed.json';
const ALIGNMENT_FILE = 'data/alignment.json';
const REVIEW_FILE = 'data/self-review.json';

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
        type?: string;
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

async function main() {
    const startTime = Date.now();

    if (!fs.existsSync(RAW_FILE)) {
        console.error(`❌ ${RAW_FILE} not found. Run the crawler first or place the file under data/raw.json.`);
        process.exit(1);
    }

    const rawContent = fs.readFileSync(RAW_FILE, 'utf-8');
    const rawData: RawDataFile = JSON.parse(rawContent);

    const config = rawData.config;
    if (!config?.frameworkPath || !config?.roleLevel) {
        console.error('❌ Missing frameworkPath or roleLevel in raw.json → config. Cannot continue.');
        process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('  RESUME PIPELINE - Continue from data/raw.json');
    console.log('='.repeat(60) + '\n');

    console.log('[resume] Loaded:');
    console.log(`  Raw PRs: ${rawData.prs.length}`);
    console.log(`  Role:    ${config.roleLevel}`);
    console.log(`  Framework: ${config.frameworkPath}`);
    console.log('');

    // Step 3: Summaries
    console.log('[resume] Step 3: Generating summaries...\n');
    console.log('─'.repeat(60));

    const processedPRs: ProcessedPRData[] = [];
    for (let i = 0; i < rawData.prs.length; i++) {
        const rawPR = rawData.prs[i];
        const progress = `[${i + 1}/${rawData.prs.length}]`;

        console.log(`${progress} Summarizing PR #${rawPR.prNumber}...`);

        try {
            const parsedPR: ParsedPR = {
                prNumber: rawPR.prNumber,
                title: rawPR.title,
                descriptionText: rawPR.description,
                type: rawPR.type as 'feat' | 'fix' | 'chore' | 'hotfix' | 'other',
                jiraId: rawPR.jiraId ?? undefined,
                url: rawPR.url,
                screenshotUrls: rawPR.screenshotUrls,
            };

            let jiraContext: ParsedJira | undefined = undefined;
            if (rawPR.jiraContext && typeof rawPR.jiraId === 'string') {
                jiraContext = {
                    ticketId: rawPR.jiraId,
                    summary: rawPR.jiraContext.summary,
                    description: rawPR.jiraContext.description,
                    releaseNotes: rawPR.jiraContext.releaseNotes,
                    issueType: rawPR.jiraContext.type || 'Task',
                    status: rawPR.jiraContext.status,
                    url: `https://harness.atlassian.net/browse/${rawPR.jiraId}`,
                };
            }

            const summary: PRSummary = await summarizePR(parsedPR, jiraContext);

            processedPRs.push({
                prNumber: rawPR.prNumber,
                title: rawPR.title,
                type: rawPR.type,
                jiraId: rawPR.jiraId,
                repo: rawPR.repo,
                summary: summary.summary,
            });

            console.log('  ✅ Done');
        } catch (error) {
            console.log(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    const processedDataFile: ProcessedDataFile = {
        generatedAt: new Date().toISOString(),
        totalPRs: processedPRs.length,
        summaries: processedPRs,
    };
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processedDataFile, null, 2));
    console.log(`\n[resume] ✅ Saved summaries to ${PROCESSED_FILE}`);

    // Step 4: Alignment
    console.log('\n[resume] Step 4: Aligning to career framework...\n');
    const framework = parseFramework(config.frameworkPath);
    const alignerPRs = processedPRs.map(pr => ({
        prNumber: pr.prNumber,
        title: pr.title,
        type: pr.type,
        jiraId: pr.jiraId ?? undefined,
        summary: pr.summary,
        metadata: { repo: pr.repo },
    }));
    const alignment = await alignToFramework(framework, alignerPRs, true);
    fs.writeFileSync(
        ALIGNMENT_FILE,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                framework: { level: framework.level, competencies: framework.competencies },
                alignments: alignment.alignments,
                summary: alignment.summary,
            },
            null,
            2
        )
    );
    console.log(`[resume] ✅ Saved alignment to ${ALIGNMENT_FILE}`);

    // Step 5: R-H-G synthesis
    console.log('\n[resume] Step 5: Generating R-H-G review...\n');
    const review = await synthesizeReviewFromData(processedPRs, alignment, config.roleLevel);
    fs.writeFileSync(
        REVIEW_FILE,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                ...review,
            },
            null,
            2
        )
    );
    console.log(`[resume] ✅ Saved review to ${REVIEW_FILE}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('  RESUME COMPLETE');
    console.log('='.repeat(60) + '\n');
    console.log(`  Summarized:    ${processedPRs.length}`);
    console.log(`  Duration:      ${duration}s`);
    console.log('');
    console.log('  Output files:');
    console.log(`    📄 ${PROCESSED_FILE} - PR summaries`);
    console.log(`    📄 ${ALIGNMENT_FILE} - Framework mapping`);
    console.log(`    📄 ${REVIEW_FILE}    - Final R-H-G output`);
    console.log('');
}

main();


