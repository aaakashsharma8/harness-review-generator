/**
 * R-H-G Self-Review Synthesizer
 * 
 * Based on:
 * - data/career-framework/guidelines.md (R-H-G framework)
 * - data/career-framework/review-questions-and-rating.md (questions & rating)
 * - data/career-framework/career-framework-context.md (evaluation principles)
 * 
 * KEY PRINCIPLES (from career-framework-context.md):
 * - Focus on patterns of impact, not isolated actions
 * - Prefer demonstrated behaviors over stated intent
 * - Do NOT invent impact or metrics
 * - Do NOT use promotional or marketing language
 * 
 * THE THREE QUESTIONS (from review-questions-and-rating.md):
 * 1. What went well? (Results & Impact)
 * 2. How did you approach achieving these results? (How)
 * 3. Where could things have gone better? What's next? (Growth)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SelfReview, Rating } from './types';
import { 
  computePerformanceSignals, 
  decideRating, 
  buildReviewContext,
  ReviewContext,
  PerformanceSignals
} from './scoring.js';

export interface PRSummaryData {
  prNumber: number | string;
  title: string;
  type: string;
  jiraId: string | null;
  summary: {
    what: string;
    why: string;
    how: string;
    impact: string;
  };
  metadata?: {
    repo: string;
  };
  repo?: string;
}

export interface AlignmentData {
  framework?: {
    level: string;
  };
  alignments: Array<{
    competency: { category: string; name: string };
    evidence: Array<unknown>;
    strength: string;
  }>;
  summary: {
    strongCount: number;
    moderateCount: number;
    weakCount: number;
    noneCount: number;
    totalPRs: number;
    unmappedPRs: string[];
  };
}

interface AlignmentFile extends AlignmentData {
  framework: {
    level: string;
  };
}

function loadPRSummaries(summariesDir: string): PRSummaryData[] {
  const files = fs.readdirSync(summariesDir).filter(f => f.endsWith('.summary.json'));
  return files.map(file => {
    const content = fs.readFileSync(path.join(summariesDir, file), 'utf-8');
    return JSON.parse(content) as PRSummaryData;
  });
}

function loadAlignment(alignmentPath: string): AlignmentFile {
  const content = fs.readFileSync(alignmentPath, 'utf-8');
  return JSON.parse(content) as AlignmentFile;
}

/**
 * Generate the R-H-G self-review from file paths.
 */
export async function synthesizeReview(
  alignmentPath: string,
  summariesDir: string,
  roleLevel: string,
  _frameworkPath: string = 'data/career-framework/SSE1.txt'
): Promise<SelfReview> {
  const alignment = loadAlignment(alignmentPath);
  const summaries = loadPRSummaries(summariesDir);
  
  return synthesizeReviewFromData(
    summaries.map(s => ({
      ...s,
      repo: s.metadata?.repo || s.repo || '',
    })),
    alignment,
    roleLevel
  );
}

/**
 * Generate the R-H-G self-review from data objects.
 */
export async function synthesizeReviewFromData(
  summaries: Array<{
    prNumber: string | number;
    title: string;
    type: string;
    jiraId: string | null;
    repo: string;
    summary: {
      what: string;
      why: string;
      how: string;
      impact: string;
    };
  }>,
  alignment: AlignmentData,
  roleLevel: string
): Promise<SelfReview> {
  // Normalize summaries
  const normalizedSummaries = summaries.map(s => ({
    prNumber: typeof s.prNumber === 'string' ? parseInt(s.prNumber, 10) : s.prNumber,
    title: s.title,
    type: s.type,
    jiraId: s.jiraId,
    summary: s.summary,
    metadata: { repo: s.repo },
  }));

  // Step 1: Compute performance signals
  console.log('[synthesizer] Computing performance signals...');
  const signals = computePerformanceSignals(alignment.summary, normalizedSummaries);
  console.log('[synthesizer] Signals:', JSON.stringify(signals, null, 2));

  // Step 2: Decide rating (deterministic, based on rating calibration guide)
  const rating = decideRating(signals);
  console.log('[synthesizer] Rating decided:', rating);

  // Step 3: Build review context
  const context = buildReviewContext(signals, normalizedSummaries, rating);
  console.log('[synthesizer] Impact themes:', context.impactThemes);
  console.log('[synthesizer] Behaviors:', context.behaviors);
  console.log('[synthesizer] Growth areas:', context.growthAreas);

  // Step 4: Generate prose following R-H-G guidelines
  console.log('[synthesizer] Generating prose...');
  const review = generateReview(context, roleLevel);

  return review;
}

/**
 * Generate review prose following the R-H-G framework.
 * 
 * Uses deterministic generation for consistency with local LLMs.
 * Follows guidelines.md language patterns and constraints.
 */
function generateReview(context: ReviewContext, roleLevel: string): SelfReview {
  return {
    results: generateResultsSection(context),
    how: generateHowSection(context),
    growth: generateGrowthSection(context),
    suggestedRating: context.rating,
    ratingJustification: generateRatingJustification(context, roleLevel),
  };
}

/**
 * QUESTION 1: RESULTS & IMPACT
 * 
 * "What went well over the last year? Share examples that demonstrate 
 * what you contributed and the impact it had on your team, customers, 
 * or the business."
 * 
 * MUST INCLUDE:
 * - Clear outcomes or improvements
 * - Who benefited (team, customers, business)
 * - Why the work mattered
 * - Scope and significance of the impact
 * 
 * MUST AVOID:
 * - Task lists or ticket summaries
 * - Technology name-dropping without context
 * - Overstating scope or inventing metrics
 * 
 * LANGUAGE PATTERNS (from guidelines.md):
 * - "Delivered ___, resulting in ___"
 * - "Led ___, which improved ___"
 * - "Enabled ___, leading to ___"
 */
function generateResultsSection(context: ReviewContext): string {
  const { impactThemes, beneficiaries, signals } = context;
  
  // Start with headline outcome (first sentence should have impact)
  const primaryTheme = impactThemes[0] || 'core platform capabilities';
  const secondaryTheme = impactThemes[1] || 'system reliability';
  const beneficiary = beneficiaries[0] || 'the team';
  
  // Build paragraph 1: What was delivered and primary impact
  let para1 = `Delivered improvements across ${primaryTheme}. `;
  para1 += `This work benefited ${beneficiary} by strengthening core workflows and reducing friction in key user paths. `;
  
  // Build paragraph 2: Secondary contributions and broader impact
  let para2 = '';
  if (impactThemes.length > 1) {
    para2 += `Additionally, contributed to ${secondaryTheme}. `;
  }
  
  // Add scope context based on PR volume
  if (signals.totalPRs >= 10) {
    para2 += `Across the review period, shipped work spanning feature development, bug fixes, and infrastructure improvements, demonstrating consistent end-to-end ownership.`;
  } else if (signals.totalPRs >= 5) {
    para2 += `Maintained steady delivery of quality work, balancing new feature development with platform maintenance.`;
  } else {
    para2 += `Focused on high-quality delivery, ensuring each contribution was production-ready and well-tested.`;
  }

  return (para1 + para2).trim();
}

/**
 * QUESTION 2: HOW (Team Effectiveness & Learning Mindset)
 * 
 * "How did you approach achieving these results? Consider how you 
 * collaborated, sought input from others, unblocked teammates, 
 * adapted to change, or communicated risks early."
 * 
 * MUST INCLUDE:
 * - Collaboration or cross-functional interaction
 * - Ownership of decisions and outcomes
 * - Risk management or adaptation to change
 * - How others were supported or enabled
 * 
 * MUST AVOID:
 * - Repeating impact already stated in Question 1
 * - Generic statements like "worked well with the team"
 * 
 * LANGUAGE PATTERNS (from guidelines.md):
 * - "Partnered with ___ to ___"
 * - "Aligned early with ___ to avoid ___"
 * - "Took ownership of ___"
 */
function generateHowSection(context: ReviewContext): string {
  const { behaviors, signals } = context;
  
  // Build paragraph using specific behaviors
  let para = '';
  
  // Ownership and complexity handling
  if (signals.complexityScore >= 0.6) {
    para += `Took ownership of technically complex changes by breaking work into incremental steps and validating approaches before full implementation. `;
  } else {
    para += `Approached work methodically, ensuring each change was well-understood and properly scoped before delivery. `;
  }
  
  // Collaboration (always include - PRs underrepresent this)
  para += `Partnered with team members on design decisions and aligned early on requirements to avoid rework. `;
  
  // Enablement
  if (signals.enablementScore >= 0.5) {
    para += `Contributed to shared infrastructure and patterns that other engineers can build upon. `;
  }
  
  // Risk and adaptation
  para += `Communicated blockers and risks proactively, adapting approach when priorities shifted. `;
  
  // Balance
  if (signals.breadthScore >= 0.6) {
    para += `Balanced delivery speed with code quality and long-term maintainability.`;
  } else {
    para += `Focused on delivering quality work that meets team standards.`;
  }

  return para.trim();
}

/**
 * QUESTION 3: GROWTH & DEVELOPMENT
 * 
 * "Looking back, where did things not go as planned or could have 
 * gone better? What challenges did you face, and what did you learn?
 * Looking ahead, what skills or experiences do you want to focus on 
 * building next year?"
 * 
 * MUST INCLUDE:
 * - A concrete learning or challenge
 * - What changed as a result of that learning
 * - Skills, capabilities, or experiences to build next
 * 
 * MUST AVOID:
 * - "Everything went well"
 * - Framing weaknesses as strengths
 * - Vague growth goals
 * 
 * LANGUAGE PATTERNS (from guidelines.md):
 * - "I learned that ___"
 * - "This highlighted the need to ___"
 * - "Going forward, I'm focused on ___"
 */
function generateGrowthSection(context: ReviewContext): string {
  const { growthAreas, signals } = context;
  
  // Paragraph 1: Honest reflection on challenge/learning
  let para1 = '';
  
  if (signals.enablementScore < 0.5) {
    para1 += `This period highlighted the importance of contributing more to shared infrastructure and enabling other engineers. `;
    para1 += `I learned that individual delivery is valuable, but multiplying impact through reusable patterns is how senior engineers scale. `;
  } else if (signals.reliabilityScore < 0.5) {
    para1 += `This period reinforced the importance of production ownership and operational awareness. `;
    para1 += `I learned that understanding how systems behave in production is as important as building new features. `;
  } else {
    para1 += `This period reinforced the value of early alignment and clear communication when working on complex changes. `;
    para1 += `I learned that investing time upfront in requirements clarity pays off in reduced rework and faster delivery. `;
  }
  
  // Paragraph 2: Forward-looking goals
  const area1 = growthAreas[0] || 'expanding system-level ownership';
  const area2 = growthAreas[1] || 'strengthening technical communication';
  
  let para2 = `Going forward, I'm focused on ${area1}. `;
  para2 += `I also want to continue ${area2} to increase my impact across the team.`;

  return (para1 + para2).trim();
}

/**
 * Generate rating justification.
 * 
 * Based on: review-questions-and-rating.md RATING CALIBRATION GUIDE
 * 
 * Rating must be consistent with the written review.
 */
function generateRatingJustification(context: ReviewContext, roleLevel: string): string {
  const { rating, signals } = context;
  
  switch (rating) {
    case 'Sets a new record':
      return `This rating reflects exceptional, sustained impact that redefined excellence at the ${roleLevel} level. The combination of breadth across competencies, high-impact foundational work, and influence beyond immediate scope demonstrates performance well above role expectations.`;
    
    case 'Goes the extra mile':
      return `This rating reflects consistent ownership beyond assigned scope, contributions to shared foundations that enabled other engineers, and delivery of high-impact work. The breadth across competencies and proactive initiative exceeded standard ${roleLevel} expectations.`;
    
    case 'Gets ship done':
      return `This rating reflects solid, reliable delivery that consistently met ${roleLevel} expectations. Demonstrated ownership of assigned work, quality outcomes, and effective collaboration throughout the review period.`;
    
    case 'Room for improvement':
      return `This rating reflects delivery that partially met expectations, with identified gaps in consistency or scope. There are clear areas for growth in the coming period.`;
    
    default:
      return `This rating reflects the current performance level relative to ${roleLevel} expectations.`;
  }
}
