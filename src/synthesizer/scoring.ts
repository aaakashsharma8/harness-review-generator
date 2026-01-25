/**
 * Deterministic Performance Scoring
 *
 * Based on: data/career-framework/review-questions-and-rating.md
 *
 * Computes performance signals from data — no LLM interpretation needed.
 * These signals drive rating selection and guide prose generation.
 */

import { Rating } from "./types.js";

export interface PerformanceSignals {
  /** How many competency categories have strong coverage (0-1) */
  breadthScore: number;

  /** Technical complexity based on work types (0-1) */
  complexityScore: number;

  /** Initiative beyond assigned work (0-1) */
  initiativeScore: number;

  /** Enablement of others / platform work (0-1) */
  enablementScore: number;

  /** Production reliability / fixes (0-1) */
  reliabilityScore: number;

  /** Total PR count */
  totalPRs: number;

  /** PR type breakdown */
  prTypes: {
    feat: number;
    fix: number;
    hotfix: number;
    chore: number;
    other: number;
  };
}

export interface ReviewContext {
  /** High-level impact themes for Results section */
  impactThemes: string[];

  /** Behavior patterns for How section */
  behaviors: string[];

  /** Growth areas for Growth section */
  growthAreas: string[];

  /** Pre-decided rating */
  rating: Rating;

  /** Raw signals for debugging */
  signals: PerformanceSignals;

  /** Extracted key outcomes */
  keyOutcomes: string[];

  /** Who benefited from the work */
  beneficiaries: string[];
}

interface PRSummary {
  prNumber: number;
  title: string;
  type: string;
  jiraId: string | null;
  summary: {
    what: string;
    why: string;
    how: string;
    impact: string;
  };
}

interface AlignmentSummary {
  strongCount: number;
  moderateCount: number;
  weakCount: number;
  totalPRs: number;
}

/**
 * Compute performance signals from alignment and PR data.
 */
export function computePerformanceSignals(
  alignment: AlignmentSummary,
  prs: PRSummary[]
): PerformanceSignals {
  const totalCompetencies = 11; // Framework competencies

  // 1. Breadth: coverage across competencies
  const coverageRatio =
    (alignment.strongCount + alignment.moderateCount * 0.5) / totalCompetencies;
  const breadthScore = Math.min(1, coverageRatio);

  // 2. Count PR types
  const typeCounts = prs.reduce((acc, pr) => {
    acc[pr.type] = (acc[pr.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const feats = typeCounts["feat"] || 0;
  const fixes = typeCounts["fix"] || 0;
  const hotfixes = typeCounts["hotfix"] || 0;
  const chores = typeCounts["chore"] || 0;
  const other = typeCounts["other"] || 0;

  // 3. Complexity: features and hotfixes are higher complexity
  const complexityRaw =
    (feats * 1.5 + hotfixes * 2 + fixes * 1 + chores * 0.5) /
    Math.max(prs.length, 1);
  const complexityScore = Math.min(1, complexityRaw / 1.5);

  // 4. Initiative: features + chores indicate proactive work
  const initiativeRaw = (feats + chores) / Math.max(prs.length, 1);
  const initiativeScore = Math.min(1, initiativeRaw * 1.5);

  // 5. Enablement: look for platform/foundation keywords
  const enablementKeywords = [
    "platform",
    "core",
    "unified",
    "foundation",
    "route",
    "shared",
    "common",
    "infrastructure",
  ];
  const enablementPRs = prs.filter((pr) =>
    enablementKeywords.some(
      (kw) =>
        pr.title.toLowerCase().includes(kw) ||
        pr.summary.what.toLowerCase().includes(kw) ||
        pr.summary.impact.toLowerCase().includes(kw)
    )
  );
  const enablementScore = Math.min(
    1,
    enablementPRs.length / Math.max(prs.length * 0.3, 1)
  );

  // 6. Reliability: fixes + hotfixes indicate production ownership
  const reliabilityRaw = (fixes + hotfixes * 2) / Math.max(prs.length, 1);
  const reliabilityScore = Math.min(1, reliabilityRaw);

  return {
    breadthScore: round(breadthScore),
    complexityScore: round(complexityScore),
    initiativeScore: round(initiativeScore),
    enablementScore: round(enablementScore),
    reliabilityScore: round(reliabilityScore),
    totalPRs: prs.length,
    prTypes: {
      feat: feats,
      fix: fixes,
      hotfix: hotfixes,
      chore: chores,
      other,
    },
  };
}

/**
 * Decide rating deterministically based on signals.
 *
 * Based on: review-questions-and-rating.md RATING CALIBRATION GUIDE
 *
 * RATING CONSTRAINTS:
 * - Default to "Gets ship done" when evidence is solid but not exceptional
 * - Use "Goes the extra mile" only when impact clearly exceeds role scope
 * - Use "Sets a new record" sparingly and only with overwhelming evidence
 */
export function decideRating(signals: PerformanceSignals): Rating {
  const avg =
    (signals.breadthScore + signals.complexityScore + signals.initiativeScore) /
    3;

  // "Sets a new record" — exceptional, organization-wide impact
  // PR data alone cannot justify this; should be rare and strongly justified
  // Keeping threshold very high to prevent auto-selection
  if (
    signals.breadthScore >= 0.95 &&
    signals.initiativeScore >= 0.95 &&
    signals.enablementScore >= 0.9 &&
    signals.totalPRs >= 15 &&
    avg >= 0.9
  ) {
    return "Sets a new record";
  }

  // "Goes the extra mile" — exceeds expectations, takes ownership beyond scope
  // - Exceeds expectations for the role
  // - Takes ownership beyond assigned scope
  // - Enables others and improves shared foundations
  // - Delivers high-impact or foundational work
  if (
    signals.breadthScore >= 0.7 &&
    signals.initiativeScore >= 0.6 &&
    (signals.enablementScore >= 0.5 || signals.complexityScore >= 0.7) &&
    avg >= 0.65
  ) {
    return "Goes the extra mile";
  }

  // "Gets ship done" — consistently meets expectations (this is a good rating!)
  // - Consistently meets expectations for the role
  // - Delivers reliable, quality outcomes
  // - Demonstrates solid ownership and collaboration
  if (avg >= 0.4 || signals.breadthScore >= 0.5) {
    return "Gets ship done";
  }

  // "Room for improvement" — delivers value but inconsistently
  if (avg >= 0.2) {
    return "Room for improvement";
  }

  // "Does not meet minimum requirements" — rare, only with very low signals
  return "Does not meet minimum requirements";
}

/**
 * Build structured context for prose generation.
 *
 * Based on: guidelines.md R-H-G Framework
 */
export function buildReviewContext(
  signals: PerformanceSignals,
  prs: PRSummary[],
  rating: Rating
): ReviewContext {
  // Extract key outcomes from PR summaries
  const keyOutcomes = extractKeyOutcomes(prs);

  // Extract impact themes with WHERE + WHY format
  const impactThemes = extractImpactThemes(prs, signals);

  // Extract behavior patterns using concrete actions
  const behaviors = extractBehaviors(signals, prs);

  // Determine who benefited
  const beneficiaries = extractBeneficiaries(prs);

  // Define growth areas
  const growthAreas = extractGrowthAreas(signals, prs);

  return {
    impactThemes,
    behaviors,
    growthAreas,
    rating,
    signals,
    keyOutcomes,
    beneficiaries,
  };
}

/**
 * Extract key outcomes from PR summaries.
 * Focus on WHAT changed, not WHAT was done.
 */
function extractKeyOutcomes(prs: PRSummary[]): string[] {
  const outcomes: string[] = [];

  for (const pr of prs) {
    // Extract from impact field (most relevant)
    if (pr.summary.impact && pr.summary.impact.length > 20) {
      outcomes.push(pr.summary.impact);
    }
  }

  return outcomes.slice(0, 5);
}

/**
 * Extract impact themes with WHERE + WHY format.
 *
 * Based on: guidelines.md RESULTS / IMPACT section
 * - Include: What changed, who benefited, why it mattered
 * - Avoid: Task lists, technology name-dropping
 */
function extractImpactThemes(
  prs: PRSummary[],
  signals: PerformanceSignals
): string[] {
  const themes: string[] = [];
  const { feat, fix, hotfix, chore } = signals.prTypes;

  // Feature themes
  if (feat >= 2) {
    const featPRs = prs.filter((p) => p.type === "feat");
    const featureWords = featPRs.flatMap((f) =>
      (f.summary.what + " " + f.summary.impact).toLowerCase().split(" ")
    );

    if (
      featureWords.some(
        (w) =>
          w.includes("execution") ||
          w.includes("pipeline") ||
          w.includes("workflow")
      )
    ) {
      themes.push(
        "execution workflows and pipeline capabilities, improving platform usability for engineering teams"
      );
    }
    if (
      featureWords.some(
        (w) =>
          w.includes("ui") ||
          w.includes("unified") ||
          w.includes("view") ||
          w.includes("tab")
      )
    ) {
      themes.push(
        "unified UI components and navigation, improving user experience consistency across the platform"
      );
    }
    if (themes.length === 0) {
      themes.push(
        "core feature delivery, expanding platform capabilities for end users and internal teams"
      );
    }
  }

  // Fix/reliability themes
  if (fix + hotfix >= 2) {
    themes.push(
      "platform stability and correctness, reducing bugs and improving system reliability"
    );
  }

  // Infrastructure/chore themes
  if (chore >= 1 || signals.enablementScore >= 0.5) {
    themes.push(
      "codebase health and maintainability, enabling faster future development"
    );
  }

  // Ensure we have at least 2 themes
  if (themes.length < 2) {
    themes.push(
      "end-to-end delivery with ownership from design through production"
    );
  }

  return themes.slice(0, 4);
}

/**
 * Extract behavior patterns using concrete actions.
 *
 * Based on: guidelines.md HOW section
 * - Include: Collaboration, decision-making, risk management
 * - Avoid: Generic statements like "worked well with the team"
 *
 * Use language patterns from guidelines.md:
 * - "Partnered with ___ to ___"
 * - "Aligned early with ___ to avoid ___"
 * - "Took ownership of ___"
 */
function extractBehaviors(
  signals: PerformanceSignals,
  prs: PRSummary[]
): string[] {
  const behaviors: string[] = [];

  // Ownership behaviors
  if (signals.complexityScore >= 0.6) {
    behaviors.push(
      "took ownership of complex changes, validating approaches incrementally before full implementation"
    );
  }

  // Enablement behaviors
  if (signals.enablementScore >= 0.5) {
    behaviors.push(
      "contributed to shared foundations and platform infrastructure that other engineers can build upon"
    );
  }

  // Reliability behaviors
  if (signals.reliabilityScore >= 0.4) {
    behaviors.push(
      "addressed production issues with root-cause analysis, preventing recurrence"
    );
  }

  // Initiative behaviors
  if (signals.initiativeScore >= 0.6) {
    behaviors.push(
      "proactively identified improvement opportunities beyond assigned scope"
    );
  }

  // Collaboration (PRs don't capture this well, but it's important)
  behaviors.push(
    "coordinated with cross-functional partners through clear communication and early alignment"
  );

  // Balance
  if (signals.breadthScore >= 0.6) {
    behaviors.push("balanced feature delivery with long-term codebase health");
  }

  return behaviors.slice(0, 4);
}

/**
 * Extract who benefited from the work.
 */
function extractBeneficiaries(prs: PRSummary[]): string[] {
  const beneficiaries = new Set<string>();

  const impactTexts = prs.map((p) => p.summary.impact.toLowerCase()).join(" ");

  if (impactTexts.includes("user") || impactTexts.includes("customer")) {
    beneficiaries.add("end users");
  }
  if (
    impactTexts.includes("team") ||
    impactTexts.includes("engineer") ||
    impactTexts.includes("developer")
  ) {
    beneficiaries.add("engineering team");
  }
  if (
    impactTexts.includes("platform") ||
    impactTexts.includes("infrastructure")
  ) {
    beneficiaries.add("platform health");
  }

  if (beneficiaries.size === 0) {
    beneficiaries.add("team and platform");
  }

  return Array.from(beneficiaries);
}

/**
 * Extract growth areas.
 *
 * Based on: guidelines.md GROWTH & LEARNING section
 * - Include: Real challenges, lessons learned, forward-looking goals
 * - Avoid: "Everything went well", vague goals
 */
function extractGrowthAreas(
  signals: PerformanceSignals,
  _prs: PRSummary[]
): string[] {
  const areas: string[] = [];

  // Identify weaker areas for honest growth focus
  if (signals.enablementScore < 0.5) {
    areas.push(
      "expanding contributions to shared infrastructure and enabling other engineers"
    );
  }

  if (signals.reliabilityScore < 0.5) {
    areas.push("deepening production ownership and operational awareness");
  }

  // Forward-looking goals (always relevant)
  areas.push("broadening system-level thinking across team boundaries");
  areas.push("strengthening technical communication and documentation");

  return areas.slice(0, 3);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
