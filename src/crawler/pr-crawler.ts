import { Page } from 'playwright';
import { launchBrowser } from './browser.js';

export interface PRListConfig {
  /** Base URL for the repo (without /pulls) */
  repoUrl: string;
  /** User ID for the created_by filter */
  userId: string;
  /** Optional: Filter PRs created after this date */
  createdAfter?: Date;
  /** Optional: Filter PRs created before this date */
  createdBefore?: Date;
}

export interface PRListItem {
  /** PR title (includes Jira ID like [CDS-12345]) */
  title: string;
  /** Full URL to the PR */
  url: string;
  /** PR number (e.g., "42975") */
  prNumber: string;
}

/**
 * Navigates to the PR list page with author and date filters applied.
 */
async function navigateToPRList(page: Page, config: PRListConfig): Promise<void> {
  // Build URL with filters
  const params = new URLSearchParams();
  params.set('created_by', config.userId);
  
  // Add date filters if provided (timestamps in milliseconds)
  if (config.createdAfter) {
    params.set('created_gt', config.createdAfter.getTime().toString());
    console.log(`[pr-crawler] Filter: created after ${config.createdAfter.toISOString()}`);
  }
  if (config.createdBefore) {
    params.set('created_lt', config.createdBefore.getTime().toString());
    console.log(`[pr-crawler] Filter: created before ${config.createdBefore.toISOString()}`);
  }
  
  const url = `${config.repoUrl}/pulls?${params.toString()}`;
  console.log(`[pr-crawler] Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Wait for the page to fully load - look for PR-related content
  console.log(`[pr-crawler] Waiting for page content to load...`);
  await page.waitForTimeout(5000);
}

/**
 * Clicks the "Merged" tab to filter only merged PRs.
 */
async function clickMergedTab(page: Page): Promise<void> {
  console.log(`[pr-crawler] Clicking "Merged" tab...`);
  
  // Wait for tabs to be visible
  await page.waitForTimeout(2000);
  
  // Try multiple approaches to find and click the Merged tab
  // Based on actual DOM: button[id*="trigger-merged"] with class cn-tabs-trigger
  const selectors = [
    'button[id*="trigger-merged"]',
    'button.cn-tabs-trigger:has-text("Merged")',
    '[role="tab"]:has-text("Merged")',
    'button:has-text("Merged")',
  ];
  
  let clicked = false;
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        clicked = true;
        console.log(`[pr-crawler] Clicked Merged tab using: ${selector}`);
        break;
      }
    } catch {
      // Try next selector
    }
  }
  
  if (!clicked) {
    console.warn(`[pr-crawler] Warning: Could not find Merged tab with selectors.`);
  }
  
  // Wait for filter to apply and content to reload
  console.log(`[pr-crawler] Waiting for merged PRs to load...`);
  await page.waitForTimeout(3000);
}

/**
 * Extracts PR items from the current page.
 * 
 * DOM structure (Harness Code UI):
 * - PR container: .cn-stacked-list-item-clickable
 * - PR link: a.cn-stacked-list-item-clickable-block[href*="/pulls/"]
 * - PR title: .font-heading-base.break-all inside the container
 */
async function extractPRsFromPage(page: Page): Promise<PRListItem[]> {
  console.log(`[pr-crawler] Extracting PRs from page...`);
  
  // Wait for PR list to be visible
  try {
    await page.waitForSelector('.cn-stacked-list-item-clickable', { timeout: 5000 });
  } catch {
    console.log(`[pr-crawler] No PR items found on page (timeout waiting for .cn-stacked-list-item-clickable)`);
    return [];
  }
  
  // Extract PRs using the actual DOM structure
  const prs = await page.$$eval('.cn-stacked-list-item-clickable', (items) => {
    const results: Array<{ title: string; url: string; prNumber: string }> = [];
    
    for (const item of items) {
      // Find the PR link (a.cn-stacked-list-item-clickable-block)
      const link = item.querySelector('a.cn-stacked-list-item-clickable-block[href*="/pulls/"]');
      if (!link) continue;
      
      const href = link.getAttribute('href');
      if (!href) continue;
      
      // Extract PR number from URL
      const prMatch = href.match(/\/pulls\/(\d+)/);
      if (!prMatch) continue;
      
      const prNumber = prMatch[1];
      
      // Find the title (span.font-heading-base inside the item)
      const titleElement = item.querySelector('.font-heading-base');
      const title = titleElement?.textContent?.trim() || `PR #${prNumber}`;
      
      results.push({
        title,
        url: href.startsWith('http') ? href : `https://harness0.harness.io${href}`,
        prNumber,
      });
    }
    
    return results;
  });
  
  console.log(`[pr-crawler] Found ${prs.length} PRs on current page`);
  return prs;
}

/**
 * Checks if there's a next page and clicks it.
 * Returns true if navigated to next page, false if no more pages.
 * 
 * DOM structure: button[aria-label="Go to next page"]
 */
async function goToNextPage(page: Page): Promise<boolean> {
  try {
    const nextButton = page.locator('button[aria-label="Go to next page"]').first();
    
    if (await nextButton.isVisible({ timeout: 1000 })) {
      const isDisabled = await nextButton.isDisabled();
      if (!isDisabled) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        console.log(`[pr-crawler] Navigated to next page`);
        return true;
      }
    }
  } catch {
    // Button not found or other error
  }
  
  console.log(`[pr-crawler] No more pages (next button disabled or not found)`);
  return false;
}

/**
 * Re-applies filters after navigation (e.g., after visiting a PR and going back).
 * Call this if filters get reset.
 */
export async function reapplyFilters(page: Page, config: PRListConfig): Promise<void> {
  await navigateToPRList(page, config);
  await clickMergedTab(page);
}

/**
 * Fetches all merged PRs for a user from a repository.
 * 
 * @param config - Repository URL and user ID
 * @param maxPages - Maximum pages to fetch (default: 10)
 * @returns List of PR items with title, URL, and PR number
 */
export async function fetchMergedPRs(
  config: PRListConfig,
  maxPages: number = 10
): Promise<PRListItem[]> {
  console.log(`\n[pr-crawler] Starting PR fetch for user ${config.userId}`);
  console.log(`[pr-crawler] Repo: ${config.repoUrl}`);
  
  const context = await launchBrowser();
  const page = await context.newPage();
  
  try {
    // Navigate to PR list with author filter
    await navigateToPRList(page, config);
    
    // Click Merged tab
    await clickMergedTab(page);
    
    // Collect PRs from all pages
    const allPRs: PRListItem[] = [];
    let pageNum = 1;
    
    while (pageNum <= maxPages) {
      console.log(`[pr-crawler] Processing page ${pageNum}...`);
      
      const prs = await extractPRsFromPage(page);
      allPRs.push(...prs);
      
      // Try to go to next page
      const hasNextPage = await goToNextPage(page);
      if (!hasNextPage) break;
      
      pageNum++;
    }
    
    console.log(`\n[pr-crawler] Total PRs found: ${allPRs.length}`);
    return allPRs;
    
  } finally {
    await page.close();
  }
}

/**
 * Gets the page object for manual inspection/interaction.
 * Useful for debugging selectors.
 */
export async function openPRListPage(config: PRListConfig): Promise<Page> {
  const context = await launchBrowser();
  const page = await context.newPage();
  await navigateToPRList(page, config);
  await clickMergedTab(page);
  return page;
}
