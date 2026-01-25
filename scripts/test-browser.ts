/**
 * Test script for Phase A1: Browser foundation
 * 
 * Purpose:
 * - Verify persistent Chrome context works
 * - Verify user is already logged into Harness
 * - Check for any redirects or login prompts
 * 
 * Usage:
 *   npm run test:browser
 * 
 * First run:
 *   1. Browser opens
 *   2. Manually log into Harness Code
 *   3. Close browser
 * 
 * Subsequent runs:
 *   1. Browser opens already authenticated
 *   2. No login required
 */

import { launchBrowser, openPage, closeBrowser } from '../src/crawler/browser.js';

// ============================================
// Harness Code PR list URL
// ============================================
const HARNESS_PR_LIST_URL = 'https://harness0.harness.io/ng/account/l7B_kbSEQD2wjrM7PShm5w/module/code/orgs/PROD/projects/Harness_Commons/repos/harness-core-ui/pulls';

async function main() {
  console.log('\n========================================');
  console.log('  Phase A1: Browser Foundation Test');
  console.log('========================================\n');

  try {
    // Step 1: Launch browser
    console.log('[test] Step 1: Launching persistent Chrome...\n');
    await launchBrowser();

    // Step 2: Open Harness PR list page
    console.log(`[test] Step 2: Opening Harness page: ${HARNESS_PR_LIST_URL}\n`);
    const page = await openPage(HARNESS_PR_LIST_URL);

    // Step 3: Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Step 4: Check current URL (detect redirects)
    const currentUrl = page.url();
    console.log(`[test] Current URL: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('auth') || currentUrl.includes('signin')) {
      console.log('\n⚠️  REDIRECT DETECTED: You were redirected to a login page.');
      console.log('   → Please log in manually in the browser window.');
      console.log('   → Then close the browser and run this script again.\n');
    } else {
      console.log('\n✅ SUCCESS: No login redirect detected.');
      console.log('   → You appear to be authenticated.\n');
    }

    // Step 5: Get page title
    const title = await page.title();
    console.log(`[test] Page title: ${title}`);

    // Step 6: Keep browser open for manual inspection
    console.log('\n[test] Browser will stay open for 30 seconds for inspection...');
    console.log('[test] Press Ctrl+C to close earlier.\n');
    
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    await closeBrowser();
    console.log('[test] Done.\n');
  }
}

main();
