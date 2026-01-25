/**
 * PR Page Parser
 * 
 * Extracts structured data from individual PR pages.
 * No LLM, no Jira fetching — just clean facts.
 */

import { Page } from 'playwright';
import { ParsedPR, PRType, PRListItem } from './types.js';

/**
 * Infers PR type from title prefix.
 * 
 * Examples:
 * - "feat: [CDS-123]: Add feature" → "feat"
 * - "fix: [BUG-456]: Fix issue" → "fix"
 * - "chore: Update deps" → "chore"
 * - "hotfix: Critical fix" → "hotfix"
 */
export function inferPRType(title: string): PRType {
  const lowerTitle = title.toLowerCase().trim();
  
  if (lowerTitle.startsWith('feat:') || lowerTitle.startsWith('feat(')) {
    return 'feat';
  }
  if (lowerTitle.startsWith('fix:') || lowerTitle.startsWith('fix(')) {
    return 'fix';
  }
  if (lowerTitle.startsWith('chore:') || lowerTitle.startsWith('chore(')) {
    return 'chore';
  }
  if (lowerTitle.startsWith('hotfix:') || lowerTitle.startsWith('hotfix(')) {
    return 'hotfix';
  }
  
  return 'other';
}

/**
 * Extracts Jira ticket ID from PR title.
 * 
 * Patterns:
 * - [CDS-12345]
 * - [UUI-357]
 * - [PIPE-30997]
 */
export function extractJiraId(title: string): string | undefined {
  // Match [XXX-12345] pattern
  const match = title.match(/\[([A-Z]+-\d+)\]/);
  return match ? match[1] : undefined;
}

/**
 * Extracts image URLs from HTML content.
 * Filters for actual screenshot uploads, not avatars/icons.
 * 
 * Harness upload URLs look like:
 * https://harness0.harness.io/gateway/code/api/v1/repos/.../+/uploads/UUID.png
 */
function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  
  // Match img tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    // Only include actual screenshot uploads (Harness upload URLs)
    // Filter out avatars, icons, badges, etc.
    if (
      url.includes('/uploads/') || 
      url.includes('user-images') ||
      (url.includes('.png') && !url.includes('badge') && !url.includes('avatar') && !url.includes('icon'))
    ) {
      urls.push(url);
    }
  }
  
  // Dedupe
  return [...new Set(urls)];
}

/**
 * Parses a single PR page and extracts structured data.
 * 
 * DOM structure (Harness Code UI):
 * - Title: h1.font-heading-section
 * - Description: .wmde-markdown or .prose.pr-section
 * - Screenshots: img[src*="/uploads/"]
 */
export async function parsePRPage(page: Page, prUrl: string, prNumber: string): Promise<ParsedPR> {
  console.log(`[pr-parser] Parsing PR #${prNumber}...`);
  
  // Navigate to PR conversation page (has description)
  const conversationUrl = prUrl.endsWith('/conversation') ? prUrl : `${prUrl}/conversation`;
  await page.goto(conversationUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Wait for the page content to render (markdown section)
  try {
    await page.waitForSelector('.wmde-markdown, h1.font-heading-section', { timeout: 10000 });
  } catch {
    // If selector not found, just wait a bit
    await page.waitForTimeout(3000);
  }
  
  // Extract title from page header
  // Selector: h1.font-heading-section
  let title = '';
  try {
    const titleElement = await page.$('h1.font-heading-section');
    if (titleElement) {
      // Get only the title text, not the PR number span
      title = await titleElement.evaluate((el) => {
        // Clone the element to manipulate
        const clone = el.cloneNode(true) as HTMLElement;
        // Remove the PR number span and edit button
        const spans = clone.querySelectorAll('span, button');
        spans.forEach(span => span.remove());
        return clone.textContent?.trim() || '';
      });
    }
    
    // Fallback: try other selectors
    if (!title) {
      const fallbackTitle = await page.$eval('h1', el => el.textContent?.trim() || '');
      title = fallbackTitle.replace(/#\d+$/, '').trim(); // Remove trailing PR number
    }
  } catch {
    console.log(`[pr-parser] Could not extract title from page for PR #${prNumber}`);
  }
  
  // Extract description from markdown section
  // Selector: .wmde-markdown or .prose.pr-section
  let descriptionText = '';
  let descriptionHtml = '';
  try {
    const descSelectors = [
      '.wmde-markdown',
      '.prose.pr-section',
      '.prose-invert.pr-section',
      '[class*="markdown-body"]',
    ];
    
    for (const selector of descSelectors) {
      const descElement = await page.$(selector);
      if (descElement) {
        descriptionHtml = await descElement.innerHTML() || '';
        // Get clean text content
        descriptionText = await descElement.evaluate((el) => {
          // Get text content, preserving some structure
          return el.textContent?.trim() || '';
        });
        
        if (descriptionText.length > 20) {
          break;
        }
      }
    }
  } catch {
    console.log(`[pr-parser] Could not extract description for PR #${prNumber}`);
  }
  
  // Extract screenshot URLs from description HTML
  // Look for Harness upload URLs: /uploads/UUID.png
  const screenshotUrls = extractImageUrls(descriptionHtml);
  
  // Also try to extract from img elements directly
  if (screenshotUrls.length === 0) {
    try {
      const imgUrls = await page.$$eval('.wmde-markdown img, .prose img', (imgs) => {
        return imgs
          .map(img => img.getAttribute('src'))
          .filter((src): src is string => !!src && src.includes('/uploads/'));
      });
      screenshotUrls.push(...imgUrls);
    } catch {
      // Ignore
    }
  }
  
  // Extract files changed, additions, deletions
  // These might be on a "Changes" tab, so we look for common patterns
  let filesChangedCount: number | undefined;
  let additions: number | undefined;
  let deletions: number | undefined;
  
  try {
    const pageText = await page.textContent('body') || '';
    
    // Files changed - look for "N files" or "N changed files"
    const filesMatch = pageText.match(/(\d+)\s*(?:files?|changed)/i);
    if (filesMatch) {
      filesChangedCount = parseInt(filesMatch[1], 10);
    }
    
    // Look for +N / -N pattern (additions/deletions)
    // Common format: "+150 / -20" or "+150 -20"
    const statsMatch = pageText.match(/\+(\d+)\s*[\/\-]\s*-?(\d+)/);
    if (statsMatch) {
      additions = parseInt(statsMatch[1], 10);
      deletions = parseInt(statsMatch[2], 10);
    }
  } catch {
    // Stats extraction is optional
  }
  
  // Infer type and extract Jira ID from title
  const prType = inferPRType(title);
  const jiraId = extractJiraId(title);
  
  const parsedPR: ParsedPR = {
    prNumber,
    title,
    type: prType,
    jiraId,
    descriptionText: descriptionText || undefined,
    screenshotUrls,
    filesChangedCount,
    additions,
    deletions,
    url: prUrl,
  };
  
  console.log(`[pr-parser] Parsed PR #${prNumber}: type=${prType}, jiraId=${jiraId || 'none'}, screenshots=${screenshotUrls.length}`);
  
  return parsedPR;
}

/**
 * Parses multiple PRs from a list.
 * 
 * @param page - Playwright page instance
 * @param prList - List of PRs from the crawler
 * @param limit - Max PRs to parse (for testing)
 */
export async function parsePRs(
  page: Page,
  prList: PRListItem[],
  limit?: number
): Promise<ParsedPR[]> {
  const prsToProcess = limit ? prList.slice(0, limit) : prList;
  const results: ParsedPR[] = [];
  
  console.log(`[pr-parser] Parsing ${prsToProcess.length} PRs...`);
  
  for (const pr of prsToProcess) {
    try {
      const parsed = await parsePRPage(page, pr.url, pr.prNumber);
      results.push(parsed);
    } catch (error) {
      console.error(`[pr-parser] Failed to parse PR #${pr.prNumber}:`, error);
    }
  }
  
  console.log(`[pr-parser] Successfully parsed ${results.length}/${prsToProcess.length} PRs`);
  return results;
}
