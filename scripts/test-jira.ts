/**
 * Test script for Phase B2: Jira Parsing
 * 
 * Tests:
 * - Navigate to Jira ticket page
 * - Extract summary, description, type, status
 * 
 * Usage:
 *   npm run test:jira
 */

import { fetchJiraTicket, getJiraUrl } from '../src/crawler/jira-crawler.js';
import { launchBrowser, closeBrowser } from '../src/crawler/browser.js';

// Test with a known Jira ticket from the parsed PRs
const TEST_TICKET_ID = 'CDS-117690';

async function main() {
  console.log('\n========================================');
  console.log('  Phase B2: Jira Parsing Test');
  console.log('========================================\n');

  try {
    // Launch browser
    console.log('[test] Launching browser...\n');
    const context = await launchBrowser();
    const page = await context.newPage();

    // Fetch Jira ticket
    console.log(`[test] Fetching Jira ticket: ${TEST_TICKET_ID}`);
    console.log(`[test] URL: ${getJiraUrl(TEST_TICKET_ID)}\n`);

    const jira = await fetchJiraTicket(page, TEST_TICKET_ID);

    await page.close();

    // Display results
    console.log('\n========================================');
    console.log('  Parsed Jira Ticket');
    console.log('========================================\n');

    console.log(`Ticket ID:   ${jira.ticketId}`);
    console.log(`Summary:     ${jira.summary || '(empty)'}`);
    console.log(`Issue Type:  ${jira.issueType || '(unknown)'}`);
    console.log(`Status:      ${jira.status || '(unknown)'}`);
    console.log(`URL:         ${jira.url}`);
    console.log('');
    console.log('Description:');
    console.log('─'.repeat(50));
    console.log(jira.description ? jira.description.substring(0, 300) + (jira.description.length > 300 ? '...' : '') : '(empty)');
    console.log('─'.repeat(50));
    console.log('');
    console.log('Release Notes:');
    console.log('─'.repeat(50));
    console.log(jira.releaseNotes || '(not found)');
    console.log('─'.repeat(50));

    // Validation checklist
    console.log('\n========================================');
    console.log('  Validation Checklist');
    console.log('========================================\n');

    const checks = [
      { name: 'Summary extracted', pass: jira.summary.length > 5 },
      { name: 'Description is readable', pass: jira.description.length > 10 },
      { name: 'Issue type detected', pass: jira.issueType.length > 0 },
      { name: 'Status detected', pass: jira.status.length > 0 },
      { name: 'Release notes found', pass: !!jira.releaseNotes && jira.releaseNotes.length > 10 },
      { name: 'No HTML soup', pass: !jira.description.includes('<div') && !(jira.releaseNotes || '').includes('<div') },
    ];

    for (const check of checks) {
      console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
    }

    // Raw JSON output
    console.log('\n========================================');
    console.log('  Raw JSON');
    console.log('========================================\n');
    console.log(JSON.stringify(jira, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    await closeBrowser();
    console.log('\n[test] Done.\n');
  }
}

main();
