/**
 * Shared types for normalized data structures.
 * These are the "clean facts" extracted from raw pages.
 */

/** PR type inferred from title prefix */
export type PRType = 'feat' | 'fix' | 'chore' | 'hotfix' | 'other';

/**
 * Structured PR data extracted from a PR page.
 * No intelligence — just facts.
 */
export interface ParsedPR {
  /** PR number (e.g., 42975) */
  prNumber: string;
  
  /** Full PR title */
  title: string;
  
  /** PR type inferred from title prefix (feat/fix/chore/hotfix/other) */
  type: PRType;
  
  /** Jira ticket ID extracted from title (e.g., "CDS-117690") */
  jiraId?: string;
  
  /** PR description as plain text (no HTML) */
  descriptionText?: string;
  
  /** Screenshot/image URLs from PR description */
  screenshotUrls: string[];
  
  /** Number of files changed */
  filesChangedCount?: number;
  
  /** Lines added */
  additions?: number;
  
  /** Lines deleted */
  deletions?: number;
  
  /** Full URL to the PR */
  url: string;
}

/**
 * Raw PR list item from the PR list crawler.
 */
export interface PRListItem {
  title: string;
  url: string;
  prNumber: string;
}
