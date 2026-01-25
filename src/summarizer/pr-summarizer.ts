/**
 * PR Summarizer
 * 
 * Generates structured summaries for PRs using LLM.
 * Output: WHAT / WHY / HOW / IMPACT
 */

import { complete, LLMConfig, DEFAULT_CONFIG } from './llm-client.js';
import { ParsedPR } from '../normalizer/types.js';

/**
 * Structured PR summary
 */
export interface PRSummary {
  prNumber: string;
  jiraId?: string;
  summary: {
    what: string;
    why: string;
    how: string;
    impact: string;
  };
  raw?: string; // Raw LLM output for debugging
}

import { ParsedJira } from '../normalizer/jira-types.js';

/**
 * Builds the prompt for PR summarization
 */
function buildPrompt(pr: ParsedPR, jira?: ParsedJira): string {
  let prompt = `You are summarizing a single pull request for a performance review.

Given:
- PR Title: ${pr.title}
- PR Type: ${pr.type}
${pr.jiraId ? `- Jira Ticket: ${pr.jiraId}` : ''}

PR Description:
"""
${pr.descriptionText || '(No description provided)'}
"""
`;

  if (jira) {
    prompt += `
Jira Ticket Context:
- Summary: ${jira.summary}
- Issue Type: ${jira.issueType}
${jira.releaseNotes ? `- Release Notes: ${jira.releaseNotes}` : ''}
${jira.description && jira.description !== 'Edit description' ? `- Description: ${jira.description}` : ''}
`;
  }

  prompt += `
Write a concise, factual summary with the following sections:

WHAT:
(What was delivered. Be specific.)

WHY:
(Why this work was needed. Prefer Jira intent if available.)

HOW:
(High-level technical approach. No low-level code details.)

IMPACT:
(Customer, team, or platform impact. Prefer Jira release notes if available.)

Rules:
- No hype or adjectives.
- No assumptions beyond the input.
- Prefer Jira context over inference.
- Keep each section to 1–3 sentences.
- Output ONLY the four sections, nothing else.`;

  return prompt;
}

/**
 * Parses LLM response into structured summary
 */
function parseResponse(response: string): { what: string; why: string; how: string; impact: string } {
  const sections = {
    what: '',
    why: '',
    how: '',
    impact: '',
  };

  // Extract sections using regex
  const whatMatch = response.match(/WHAT:\s*\n?([\s\S]*?)(?=\n\s*WHY:|$)/i);
  const whyMatch = response.match(/WHY:\s*\n?([\s\S]*?)(?=\n\s*HOW:|$)/i);
  const howMatch = response.match(/HOW:\s*\n?([\s\S]*?)(?=\n\s*IMPACT:|$)/i);
  const impactMatch = response.match(/IMPACT:\s*\n?([\s\S]*?)$/i);

  if (whatMatch) sections.what = whatMatch[1].trim();
  if (whyMatch) sections.why = whyMatch[1].trim();
  if (howMatch) sections.how = howMatch[1].trim();
  if (impactMatch) sections.impact = impactMatch[1].trim();

  return sections;
}

/**
 * Summarizes a single PR
 */
export async function summarizePR(
  pr: ParsedPR,
  jira?: ParsedJira,
  config: LLMConfig = DEFAULT_CONFIG
): Promise<PRSummary> {
  console.log(`[pr-summarizer] Summarizing PR #${pr.prNumber}${jira ? ` with Jira ${jira.ticketId}` : ''}...`);

  const prompt = buildPrompt(pr, jira);
  
  try {
    const response = await complete(prompt, config);
    const parsed = parseResponse(response.content);

    console.log(`[pr-summarizer] Completed PR #${pr.prNumber}`);

    return {
      prNumber: pr.prNumber,
      jiraId: pr.jiraId,
      summary: parsed,
      raw: response.content,
    };
  } catch (error) {
    console.error(`[pr-summarizer] Failed to summarize PR #${pr.prNumber}:`, error);
    throw error;
  }
}

/**
 * Summarizes multiple PRs
 */
export async function summarizePRs(
  prs: ParsedPR[],
  config: LLMConfig = DEFAULT_CONFIG
): Promise<PRSummary[]> {
  const results: PRSummary[] = [];

  for (const pr of prs) {
    try {
      const summary = await summarizePR(pr, undefined, config);
      results.push(summary);
    } catch (error) {
      console.error(`[pr-summarizer] Skipping PR #${pr.prNumber} due to error`);
    }
  }

  return results;
}
