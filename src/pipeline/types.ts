/**
 * Pipeline Input/Output Types
 */

import { SelfReview } from '../synthesizer/types';

export interface PipelineConfig {
  /** User ID for filtering PRs (e.g., "1374") */
  userId: string;

  /** List of repo URLs to scan */
  repoUrls: string[];

  /** Role level (e.g., "Senior Software Engineer") */
  roleLevel: string;

  /** Path to career framework file */
  frameworkPath: string;

  /** Optional: Filter PRs created after this date */
  createdAfter?: Date;

  /** Optional: Filter PRs created before this date */
  createdBefore?: Date;
}

export interface PipelineProgress {
  stage: 'fetching_prs' | 'parsing_prs' | 'fetching_jira' | 'summarizing' | 'aligning' | 'generating' | 'complete' | 'error';
  message: string;
  current?: number;
  total?: number;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

export interface PipelineResult {
  success: boolean;
  review?: SelfReview;
  error?: string;
  stats: {
    totalPRs: number;
    parsedPRs: number;
    jiraTickets: number;
    duration: number;
  };
}
