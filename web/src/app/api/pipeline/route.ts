import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Map role levels to their framework files
const ROLE_FRAMEWORK_MAP: Record<string, string> = {
  'SE1': 'data/career-framework/SE1.txt',
  'SE2': 'data/career-framework/SE2.txt',
  'SSE1': 'data/career-framework/SSE1.txt',
  'SSE2': 'data/career-framework/SSE2.txt',
  'Staff1': 'data/career-framework/Staff1.txt',
  'Staff2': 'data/career-framework/Staff2.txt',
  'Principal': 'data/career-framework/Principal.txt',
  'Architect': 'data/career-framework/Architect.txt',
  'Distinguished': 'data/career-framework/Distinguished.txt',
};

// Map role codes to display names
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'SE1': 'Software Engineer 1',
  'SE2': 'Software Engineer 2',
  'SSE1': 'Senior Software Engineer 1',
  'SSE2': 'Senior Software Engineer 2',
  'Staff1': 'Staff Engineer 1',
  'Staff2': 'Staff Engineer 2',
  'Principal': 'Principal Engineer',
  'Architect': 'Architect',
  'Distinguished': 'Distinguished Engineer',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, repoUrls, roleLevel, createdAfter, createdBefore } = body;

    // Validate input
    if (!userId || !repoUrls || repoUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId and repoUrls',
      });
    }

    // Get framework path for the role
    const frameworkPath = ROLE_FRAMEWORK_MAP[roleLevel] || 'data/career-framework/SSE1.txt';
    const roleDisplayName = ROLE_DISPLAY_NAMES[roleLevel] || roleLevel;

    // Get root project directory (parent of web/)
    const cwd = process.cwd().replace('/web', '');
    const configPath = path.join(cwd, 'data', 'pipeline-config.json');
    
    // Write config file for the pipeline script to read
    const config = {
      userId,
      repoUrls: repoUrls.filter((url: string) => url.trim()),
      roleLevel: roleDisplayName,
      frameworkPath,
      createdAfter: createdAfter || undefined,
      createdBefore: createdBefore || undefined,
    };

    console.log('[API] Writing pipeline config:', JSON.stringify(config, null, 2));
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Run the dynamic pipeline
    console.log('[API] Running pipeline...');
    const { stdout, stderr } = await execAsync(
      `cd "${cwd}" && npm run pipeline`,
      {
        timeout: 0, // allow the full pipeline to run without time limit
        maxBuffer: 10 * 1024 * 1024, // increase buffer to handle verbose logs
      }
    );
    
    console.log('[API] Pipeline stdout (last 1000 chars):', stdout.slice(-1000));
    if (stderr) console.log('[API] Pipeline stderr:', stderr.slice(-500));

    return NextResponse.json({
      success: true,
      message: 'Pipeline completed successfully',
    });

  } catch (error) {
    console.error('[API] Pipeline error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
