import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Data is in parent directory relative to /web
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const RAW_FILE = path.join(DATA_DIR, 'raw.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed.json');
const ALIGNMENT_FILE = path.join(DATA_DIR, 'alignment.json');
const REVIEW_FILE = path.join(DATA_DIR, 'self-review.json');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';

  try {
    const result: Record<string, unknown> = {};

    // Load requested data
    if (type === 'all' || type === 'raw') {
      if (fs.existsSync(RAW_FILE)) {
        result.raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf-8'));
      }
    }

    if (type === 'all' || type === 'processed') {
      if (fs.existsSync(PROCESSED_FILE)) {
        result.processed = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf-8'));
      }
    }

    if (type === 'all' || type === 'alignment') {
      if (fs.existsSync(ALIGNMENT_FILE)) {
        result.alignment = JSON.parse(fs.readFileSync(ALIGNMENT_FILE, 'utf-8'));
      }
    }

    if (type === 'all' || type === 'review') {
      if (fs.existsSync(REVIEW_FILE)) {
        result.review = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf-8'));
      }
    }

    // Add file status
    result.files = {
      raw: fs.existsSync(RAW_FILE),
      processed: fs.existsSync(PROCESSED_FILE),
      alignment: fs.existsSync(ALIGNMENT_FILE),
      review: fs.existsSync(REVIEW_FILE),
    };

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
