/**
 * Login Helper Script
 * 
 * Purpose:
 * - Opens persistent Chrome browser
 * - Navigates to Harness
 * - Waits for you to complete Okta SSO login manually
 * - Saves session to chrome-user-data/ for future runs
 * 
 * Usage:
 *   npm run login
 * 
 * Steps:
 *   1. Run this script
 *   2. Complete Okta SSO login in the browser window
 *   3. Once logged in and you see the Harness dashboard, press Enter in terminal
 *   4. Session is saved — future runs will be authenticated
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const USER_DATA_DIR = path.join(PROJECT_ROOT, 'chrome-user-data');

const HARNESS_URL = 'https://harness0.harness.io/ng/account/l7B_kbSEQD2wjrM7PShm5w/module/code/orgs/PROD/projects/Harness_Commons/repos/harness-core-ui/pulls';
const JIRA_URL = 'https://harness.atlassian.net/browse/CDS-117690';

async function main() {
  console.log('\n========================================');
  console.log('  Harness Login Helper');
  console.log('========================================\n');

  console.log('[login] Launching Chrome with persistent profile...');
  console.log(`[login] User data dir: ${USER_DATA_DIR}\n`);
  
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log('========================================');
  console.log('  MANUAL ACTION REQUIRED');
  console.log('========================================');
  console.log('');
  console.log('  1. Log into BOTH Harness AND Jira');
  console.log('  2. Complete Okta SSO for each');
  console.log('  3. CLOSE THE BROWSER WINDOW when done');
  console.log('');
  console.log('  Your sessions will be saved automatically.');
  console.log('========================================\n');

  // Step 1: Navigate to Harness
  console.log(`[login] Step 1: Navigating to Harness...`);
  console.log(`[login] URL: ${HARNESS_URL}\n`);
  await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
  
  console.log('[login] → Complete Harness/Okta login if prompted');
  console.log('[login] → Then navigate to Jira tab below\n');
  
  // Step 2: Open Jira in new tab
  console.log(`[login] Step 2: Opening Jira in new tab...`);
  console.log(`[login] URL: ${JIRA_URL}\n`);
  const jiraPage = await context.newPage();
  await jiraPage.goto(JIRA_URL, { waitUntil: 'domcontentloaded' });
  
  console.log('[login] → Complete Jira/Atlassian login if prompted');
  console.log('[login] → Close browser when BOTH are logged in\n');
  
  console.log('[login] Waiting for you to close the browser...\n');

  // Wait for browser to be closed by user
  await new Promise<void>((resolve) => {
    context.on('close', () => {
      resolve();
    });
  });

  console.log('\n✅ Browser closed. Session saved.');
  console.log('   Run "npm run test:browser" to verify auth works.\n');
}

main().catch(console.error);
