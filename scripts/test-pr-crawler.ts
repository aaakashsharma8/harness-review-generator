/**
 * Test script for Phase A2: PR Crawler
 * 
 * Tests:
 * - Navigation to PR list with author filter
 * - Clicking "Merged" tab
 * - Extracting PR titles and URLs
 * 
 * Usage:
 *   npm run test:crawler
 */

import { fetchMergedPRs, PRListConfig } from '../src/crawler/pr-crawler.js';
import { closeBrowser } from '../src/crawler/browser.js';

// ============================================
// CONFIGURE: Your repo URL and user ID
// ============================================
const config: PRListConfig = {
  repoUrl: 'https://harness0.harness.io/ng/account/l7B_kbSEQD2wjrM7PShm5w/module/code/orgs/PROD/projects/Harness_Commons/repos/harness-core-ui',
  userId: '1374', // Your user ID from the URL param
};

async function main() {
  console.log('\n========================================');
  console.log('  Phase A2: PR Crawler Test');
  console.log('========================================\n');

  try {
    // Fetch merged PRs (limit to 2 pages for testing)
    const prs = await fetchMergedPRs(config, 2);
    
    console.log('\n========================================');
    console.log('  Results');
    console.log('========================================\n');
    
    if (prs.length === 0) {
      console.log('❌ No PRs found. Possible issues:');
      console.log('   - "Merged" tab selector may need adjustment');
      console.log('   - PR link selectors may need adjustment');
      console.log('   - User ID may be incorrect');
    } else {
      console.log(`✅ Found ${prs.length} merged PRs:\n`);
      
      prs.forEach((pr, i) => {
        console.log(`${i + 1}. [#${pr.prNumber}] ${pr.title}`);
        console.log(`   ${pr.url}\n`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    await closeBrowser();
    console.log('\n[test] Done.\n');
  }
}

main();
