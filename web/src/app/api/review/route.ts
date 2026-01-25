import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Data is in parent directory relative to /web
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const REVIEW_FILE = path.join(DATA_DIR, 'self-review.json');
const ALIGNMENT_FILE = path.join(DATA_DIR, 'alignment.json');

console.log('[api/review] PROJECT_ROOT:', PROJECT_ROOT);
console.log('[api/review] REVIEW_FILE:', REVIEW_FILE);

export async function GET() {
  try {
    // Check if review exists
    if (!fs.existsSync(REVIEW_FILE)) {
      return NextResponse.json({
        success: false,
        error: 'No review found. Run the pipeline first.',
      });
    }

    // Load review
    const review = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf-8'));

    // Load stats from alignment if available
    let stats = null;
    if (fs.existsSync(ALIGNMENT_FILE)) {
      const alignment = JSON.parse(fs.readFileSync(ALIGNMENT_FILE, 'utf-8'));
      stats = {
        totalPRs: alignment.summary?.totalPRs || 0,
        strongCount: alignment.summary?.strongCount || 0,
        moderateCount: alignment.summary?.moderateCount || 0,
      };
    }

    return NextResponse.json({
      success: true,
      review,
      stats,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
