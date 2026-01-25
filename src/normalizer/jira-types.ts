/**
 * Jira-related types
 */

/**
 * Minimal Jira ticket data for PR enrichment.
 * Intent + scope only — no noise.
 */
export interface ParsedJira {
  /** Ticket ID (e.g., "CDS-117690") */
  ticketId: string;
  
  /** Ticket summary/title */
  summary: string;
  
  /** Description as plain text */
  description: string;
  
  /** Public Release Notes Summary (if available) - high-value context */
  releaseNotes?: string;
  
  /** Issue type: Bug, Story, Task, etc. */
  issueType: string;
  
  /** Current status: Done, Closed, In Progress, etc. */
  status: string;
  
  /** Full URL to the ticket */
  url: string;
}
