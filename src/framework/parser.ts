/**
 * Career Framework Parser
 * 
 * Parses framework text files into structured data.
 */

import { readFileSync } from 'fs';
import { CareerFramework, Competency } from './types.js';

/**
 * Parses a career framework text file.
 * 
 * Expected format:
 * # Level Name
 * ## Category
 * ### Competency Name
 * - Bullet point
 * - Bullet point
 */
export function parseFramework(filepath: string): CareerFramework {
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  
  let level = '';
  let currentCategory = '';
  let currentCompetency: Competency | null = null;
  const competencies: Competency[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Level (# heading)
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      level = trimmed.replace('# ', '').trim();
      continue;
    }
    
    // Category (## heading)
    if (trimmed.startsWith('## ')) {
      // Save previous competency if exists
      if (currentCompetency) {
        competencies.push(currentCompetency);
        currentCompetency = null;
      }
      currentCategory = trimmed.replace('## ', '').trim();
      continue;
    }
    
    // Competency (### heading)
    if (trimmed.startsWith('### ')) {
      // Save previous competency if exists
      if (currentCompetency) {
        competencies.push(currentCompetency);
      }
      currentCompetency = {
        category: currentCategory,
        name: trimmed.replace('### ', '').trim(),
        bullets: [],
      };
      continue;
    }
    
    // Bullet point
    if (trimmed.startsWith('- ') && currentCompetency) {
      currentCompetency.bullets.push(trimmed.replace('- ', '').trim());
    }
  }
  
  // Don't forget the last competency
  if (currentCompetency) {
    competencies.push(currentCompetency);
  }

  return {
    level,
    competencies,
  };
}

/**
 * Gets all unique categories from a framework
 */
export function getCategories(framework: CareerFramework): string[] {
  const categories = new Set<string>();
  for (const comp of framework.competencies) {
    categories.add(comp.category);
  }
  return Array.from(categories);
}
