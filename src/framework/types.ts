/**
 * Career Framework Types
 */

/**
 * A single competency from the career framework
 */
export interface Competency {
  /** Category (e.g., "Technical Excellence") */
  category: string;
  
  /** Competency name (e.g., "Builds scalable, maintainable systems") */
  name: string;
  
  /** Bullet points describing the competency */
  bullets: string[];
}

/**
 * Parsed career framework
 */
export interface CareerFramework {
  /** Level name (e.g., "Senior Software Engineer") */
  level: string;
  
  /** All competencies grouped by category */
  competencies: Competency[];
}

/**
 * Evidence from a PR supporting a competency
 */
export interface PREvidence {
  prNumber: string;
  title: string;
  type: string;
  relevantSummary: string; // The WHAT/HOW/IMPACT that supports this competency
  matchReason: string; // Why this PR maps to this competency
}

/**
 * Alignment result for a single competency
 */
export interface CompetencyAlignment {
  competency: Competency;
  evidence: PREvidence[];
  strength: 'strong' | 'moderate' | 'weak' | 'none';
}

/**
 * Complete framework alignment result
 */
export interface FrameworkAlignment {
  framework: CareerFramework;
  alignments: CompetencyAlignment[];
  summary: {
    strongCount: number;
    moderateCount: number;
    weakCount: number;
    noneCount: number;
    totalPRs: number;
    unmappedPRs: string[]; // PRs that didn't map to any competency
  };
}
