/**
 * Career Framework Aligner
 * 
 * Maps PR evidence to career framework competencies.
 * Uses keyword matching + LLM for nuanced classification.
 */

import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { complete, DEFAULT_CONFIG } from '../summarizer/llm-client.js';
import { 
  CareerFramework, 
  Competency, 
  PREvidence, 
  CompetencyAlignment, 
  FrameworkAlignment 
} from './types.js';

/**
 * Processed PR summary (loaded from disk)
 */
interface ProcessedPR {
  prNumber: string;
  title: string;
  type: string;
  jiraId?: string;
  summary: {
    what: string;
    why: string;
    how: string;
    impact: string;
  };
}

/**
 * Loads all processed PR summaries from disk
 */
export function loadProcessedPRs(dir: string = 'data/processed'): ProcessedPR[] {
  const files = readdirSync(dir).filter(f => f.endsWith('.summary.json'));
  const prs: ProcessedPR[] = [];
  
  for (const file of files) {
    const content = readFileSync(path.join(dir, file), 'utf-8');
    prs.push(JSON.parse(content));
  }
  
  return prs;
}

/**
 * Keyword patterns for competency matching (fast, deterministic)
 */
const COMPETENCY_KEYWORDS: Record<string, string[]> = {
  // Technical Excellence
  'Builds scalable, maintainable systems': ['architecture', 'scalable', 'module', 'routing', 'refactor', 'foundation', 'infrastructure', 'MFE', 'micro-frontend'],
  'Delivers high-quality code': ['test', 'quality', 'unit test', 'coverage', 'standard'],
  'Solves complex technical problems': ['fix', 'bug', 'hotfix', 'debug', 'resolve', 'issue'],
  
  // Execution & Delivery
  'Delivers features end-to-end': ['feature', 'feat', 'add', 'implement', 'support', 'enable'],
  'Ships incrementally with impact': ['incremental', 'phase', 'milestone', 'iteration'],
  'Handles production issues effectively': ['hotfix', 'production', 'incident', 'urgent', 'critical'],
  
  // Collaboration
  'Collaborates effectively across teams': ['cross-team', 'collaboration', 'platform', 'shared'],
  'Improves team processes and tools': ['chore', 'tooling', 'process', 'automation', 'export', 'module'],
  'Drives technical decisions': ['design', 'architecture', 'decision', 'RFC'],
  
  // Customer & Business Impact
  'Delivers customer value': ['user', 'customer', 'enable', 'allow', 'support', 'experience'],
  'Supports business goals': ['deployment', 'release', 'launch', 'rollout'],
};

/**
 * Quick keyword-based matching (no LLM)
 */
function keywordMatch(pr: ProcessedPR, competency: Competency): boolean {
  const keywords = COMPETENCY_KEYWORDS[competency.name] || [];
  const prText = `${pr.title} ${pr.summary.what} ${pr.summary.how} ${pr.summary.impact}`.toLowerCase();
  
  return keywords.some(kw => prText.includes(kw.toLowerCase()));
}

/**
 * Uses LLM to determine if a PR supports a competency (more accurate)
 */
async function llmMatch(pr: ProcessedPR, competency: Competency): Promise<{ matches: boolean; reason: string }> {
  const prompt = `You are classifying a pull request for a performance review.

PR Summary:
- Title: ${pr.title}
- Type: ${pr.type}
- WHAT: ${pr.summary.what}
- HOW: ${pr.summary.how}
- IMPACT: ${pr.summary.impact}

Competency to evaluate:
- Category: ${competency.category}
- Name: ${competency.name}
- Expectations: ${competency.bullets.join('; ')}

Does this PR provide evidence for this competency?

Answer with ONLY one of:
- YES: [one sentence reason]
- NO: [one sentence reason]`;

  try {
    const response = await complete(prompt, { ...DEFAULT_CONFIG, temperature: 0 });
    const answer = response.content.trim();
    
    if (answer.toUpperCase().startsWith('YES')) {
      return { 
        matches: true, 
        reason: answer.replace(/^YES:\s*/i, '').trim() 
      };
    }
    return { 
      matches: false, 
      reason: answer.replace(/^NO:\s*/i, '').trim() 
    };
  } catch {
    // Fallback to keyword matching on error
    return { 
      matches: keywordMatch(pr, competency), 
      reason: 'Keyword match (LLM unavailable)' 
    };
  }
}

/**
 * Aligns a single PR to all competencies
 */
async function alignPR(
  pr: ProcessedPR, 
  framework: CareerFramework,
  useLLM: boolean = true
): Promise<Map<string, PREvidence>> {
  const alignments = new Map<string, PREvidence>();
  
  for (const competency of framework.competencies) {
    let matches = false;
    let reason = '';
    
    if (useLLM) {
      const result = await llmMatch(pr, competency);
      matches = result.matches;
      reason = result.reason;
    } else {
      matches = keywordMatch(pr, competency);
      reason = matches ? 'Keyword match' : '';
    }
    
    if (matches) {
      alignments.set(competency.name, {
        prNumber: pr.prNumber,
        title: pr.title,
        type: pr.type,
        relevantSummary: `${pr.summary.what} ${pr.summary.impact}`,
        matchReason: reason,
      });
    }
  }
  
  return alignments;
}

/**
 * Determines strength based on evidence count
 */
function determineStrength(evidenceCount: number): 'strong' | 'moderate' | 'weak' | 'none' {
  if (evidenceCount >= 3) return 'strong';
  if (evidenceCount >= 2) return 'moderate';
  if (evidenceCount >= 1) return 'weak';
  return 'none';
}

/**
 * Aligns all PRs to the career framework
 */
export async function alignToFramework(
  framework: CareerFramework,
  prs: ProcessedPR[],
  useLLM: boolean = true
): Promise<FrameworkAlignment> {
  console.log(`[aligner] Aligning ${prs.length} PRs to ${framework.competencies.length} competencies...`);
  
  // Initialize alignments for each competency
  const competencyEvidence = new Map<string, PREvidence[]>();
  for (const comp of framework.competencies) {
    competencyEvidence.set(comp.name, []);
  }
  
  // Track which PRs got mapped
  const mappedPRs = new Set<string>();
  
  // Align each PR
  for (let i = 0; i < prs.length; i++) {
    const pr = prs[i];
    console.log(`[aligner] [${i + 1}/${prs.length}] PR #${pr.prNumber}...`);
    
    const prAlignments = await alignPR(pr, framework, useLLM);
    
    for (const [compName, evidence] of prAlignments) {
      competencyEvidence.get(compName)?.push(evidence);
      mappedPRs.add(pr.prNumber);
    }
  }
  
  // Build alignment results
  const alignments: CompetencyAlignment[] = framework.competencies.map(comp => ({
    competency: comp,
    evidence: competencyEvidence.get(comp.name) || [],
    strength: determineStrength(competencyEvidence.get(comp.name)?.length || 0),
  }));
  
  // Find unmapped PRs
  const unmappedPRs = prs
    .filter(pr => !mappedPRs.has(pr.prNumber))
    .map(pr => pr.prNumber);
  
  // Calculate summary
  const summary = {
    strongCount: alignments.filter(a => a.strength === 'strong').length,
    moderateCount: alignments.filter(a => a.strength === 'moderate').length,
    weakCount: alignments.filter(a => a.strength === 'weak').length,
    noneCount: alignments.filter(a => a.strength === 'none').length,
    totalPRs: prs.length,
    unmappedPRs,
  };
  
  console.log(`[aligner] Alignment complete. Strong: ${summary.strongCount}, Moderate: ${summary.moderateCount}, Weak: ${summary.weakCount}`);
  
  return {
    framework,
    alignments,
    summary,
  };
}
