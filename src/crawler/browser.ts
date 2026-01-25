import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const USER_DATA_DIR = path.join(PROJECT_ROOT, 'chrome-user-data');

let browserContext: BrowserContext | null = null;

export interface BrowserOptions {
  headless?: boolean;
}

/**
 * Launches a persistent Chrome browser context.
 * 
 * Uses a local profile directory to persist:
 * - Cookies
 * - Session storage
 * - Login states
 * 
 * First run: User must manually log into GitHub/Jira.
 * Subsequent runs: Already authenticated.
 */
export async function launchBrowser(options: BrowserOptions = {}): Promise<BrowserContext> {
  if (browserContext) {
    return browserContext;
  }

  const { headless = false } = options;

  console.log(`[browser] Launching Chrome with persistent profile...`);
  console.log(`[browser] User data dir: ${USER_DATA_DIR}`);

  browserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless,
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  console.log(`[browser] Chrome launched successfully`);

  return browserContext;
}

/**
 * Opens a new page in the persistent browser context.
 */
export async function openPage(url?: string): Promise<Page> {
  const context = await launchBrowser();
  const page = await context.newPage();
  
  if (url) {
    console.log(`[browser] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  return page;
}

/**
 * Closes the browser context.
 */
export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    console.log(`[browser] Closing browser...`);
    await browserContext.close();
    browserContext = null;
  }
}

/**
 * Gets the current browser context, or null if not launched.
 */
export function getBrowserContext(): BrowserContext | null {
  return browserContext;
}
