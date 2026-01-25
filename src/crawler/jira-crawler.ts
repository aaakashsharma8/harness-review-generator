/**
 * Jira Crawler
 * 
 * Navigates to Jira ticket pages and extracts minimal context.
 * Uses existing persistent Chrome auth.
 */

import { Page } from 'playwright';
import { launchBrowser } from './browser.js';
import { ParsedJira } from '../normalizer/jira-types.js';

/** Base Jira URL */
const JIRA_BASE_URL = 'https://harness.atlassian.net/browse';

/**
 * Builds the Jira ticket URL from ticket ID
 */
export function getJiraUrl(ticketId: string): string {
  return `${JIRA_BASE_URL}/${ticketId}`;
}

/**
 * Fetches and parses a single Jira ticket.
 * 
 * Extracts:
 * - Summary (title)
 * - Description (plain text)
 * - Issue type (Bug, Story, Task, etc.)
 * - Status (Done, Closed, etc.)
 */
export async function fetchJiraTicket(
  page: Page,
  ticketId: string
): Promise<ParsedJira> {
  const url = getJiraUrl(ticketId);
  console.log(`[jira-crawler] Fetching ticket: ${ticketId}`);
  console.log(`[jira-crawler] URL: ${url}`);

  // Navigate to Jira ticket page
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Wait for page content to load
  try {
    await page.waitForSelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]', { timeout: 10000 });
  } catch {
    // Fallback: wait for any h1 element
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Extract summary (title)
  let summary = '';
  try {
    // Jira Cloud uses data-testid for summary
    const summarySelectors = [
      '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
      '[data-testid="issue-field-summary"]',
      'h1[data-testid*="summary"]',
      'h1',
    ];
    
    for (const selector of summarySelectors) {
      const el = await page.$(selector);
      if (el) {
        summary = await el.textContent() || '';
        summary = summary.trim();
        if (summary.length > 5) break;
      }
    }
  } catch {
    console.log(`[jira-crawler] Could not extract summary for ${ticketId}`);
  }

  // Extract description
  let description = '';
  try {
    const descSelectors = [
      '[data-testid="issue.views.field.rich-text.description"]',
      '[data-testid*="description"]',
      '.ak-renderer-document',
      '[class*="description"]',
    ];
    
    for (const selector of descSelectors) {
      const el = await page.$(selector);
      if (el) {
        description = await el.textContent() || '';
        description = description.trim();
        if (description.length > 10) break;
      }
    }
  } catch {
    console.log(`[jira-crawler] Could not extract description for ${ticketId}`);
  }

  // Extract issue type (Bug, Story, Task, etc.)
  let issueType = '';
  try {
    const typeSelectors = [
      '[data-testid="issue.views.issue-base.foundation.change-issue-type.button"]',
      '[data-testid*="issue-type"]',
      '[aria-label*="Type"]',
      '[class*="issue-type"]',
    ];
    
    for (const selector of typeSelectors) {
      const el = await page.$(selector);
      if (el) {
        issueType = await el.textContent() || '';
        issueType = issueType.trim();
        if (issueType.length > 0) break;
      }
    }
    
    // Fallback: look for type in breadcrumb or header
    if (!issueType) {
      const pageText = await page.textContent('body') || '';
      const typeMatch = pageText.match(/\b(Bug|Story|Task|Epic|Sub-task|Improvement|Feature)\b/i);
      if (typeMatch) {
        issueType = typeMatch[1];
      }
    }
  } catch {
    console.log(`[jira-crawler] Could not extract issue type for ${ticketId}`);
  }

  // Extract status (Done, Closed, In Progress, etc.)
  let status = '';
  try {
    const statusSelectors = [
      '[data-testid="issue.views.issue-base.foundation.status.status-field-wrapper"]',
      '[data-testid*="status"]',
      '[class*="status-lozenge"]',
      '[class*="jira-issue-status"]',
    ];
    
    for (const selector of statusSelectors) {
      const el = await page.$(selector);
      if (el) {
        status = await el.textContent() || '';
        status = status.trim();
        if (status.length > 0) break;
      }
    }
  } catch {
    console.log(`[jira-crawler] Could not extract status for ${ticketId}`);
  }

  // Extract Public Release Notes Summary (custom field)
  let releaseNotes = '';
  try {
    // Look for the release notes field by finding the h2 label, then getting the text content div
    const releaseNotesEl = await page.evaluate(() => {
      // Find the h2 heading with "Public Release Notes Summary"
      const headings = document.querySelectorAll('h2[data-component-selector="jira-issue-field-heading-multiline-field-heading-title"]');
      for (const heading of headings) {
        if (heading.textContent?.includes('Release Notes')) {
          // Get the parent container
          const container = heading.closest('div[class*="_i2q7idpf"]') || heading.parentElement?.parentElement?.parentElement;
          if (container) {
            // Find the text content area within this container
            const textArea = container.querySelector('[data-testid="issue-internal-fields.text-area.text-content-area"]');
            if (textArea) {
              return textArea.textContent?.trim() || '';
            }
          }
        }
      }
      return '';
    });
    
    if (releaseNotesEl) {
      releaseNotes = releaseNotesEl;
    }
  } catch {
    console.log(`[jira-crawler] Could not extract release notes for ${ticketId}`);
  }

  const parsed: ParsedJira = {
    ticketId,
    summary,
    description,
    releaseNotes: releaseNotes || undefined,
    issueType,
    status,
    url,
  };

  console.log(`[jira-crawler] Parsed ${ticketId}: type=${issueType || 'unknown'}, status=${status || 'unknown'}`);

  return parsed;
}

/**
 * Fetches multiple Jira tickets.
 */
export async function fetchJiraTickets(
  ticketIds: string[]
): Promise<Map<string, ParsedJira>> {
  const context = await launchBrowser();
  const page = await context.newPage();
  const results = new Map<string, ParsedJira>();

  for (const ticketId of ticketIds) {
    try {
      const parsed = await fetchJiraTicket(page, ticketId);
      results.set(ticketId, parsed);
    } catch (error) {
      console.error(`[jira-crawler] Failed to fetch ${ticketId}:`, error);
    }
  }

  await page.close();
  return results;
}
