/**
 * R-H-G Self-Review Synthesis Types
 * 
 * Based on: data/career-framework/review-questions-and-rating.md
 */

/**
 * Available ratings (from review-questions-and-rating.md):
 * - Does not meet minimum requirements
 * - Room for improvement
 * - Gets ship done
 * - Goes the extra mile
 * - Sets a new record
 */
export type Rating =
  | 'Does not meet minimum requirements'
  | 'Room for improvement'
  | 'Gets ship done'
  | 'Goes the extra mile'
  | 'Sets a new record';

export interface SelfReview {
  /** Results / Impact section - answers Q1 */
  results: string;

  /** How - team effectiveness & learning mindset - answers Q2 */
  how: string;

  /** Growth & Development - answers Q3 */
  growth: string;

  /** Suggested performance rating */
  suggestedRating: Rating;

  /** Evidence-based justification for the rating */
  ratingJustification: string;
}

export interface SynthesisInput {
  /** Alignment data from Phase B3 */
  alignmentPath: string;

  /** Directory containing PR summaries */
  summariesDir: string;

  /** Role level for context */
  roleLevel: string;
}
