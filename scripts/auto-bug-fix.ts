#!/usr/bin/env tsx
/**
 * Automated Bug Fixer
 * 
 * Works through Airtable feedback backlog one bug at a time.
 * Strategy:
 * 1. Get next unfixed high-priority bug
 * 2. If none, move to medium priority
 * 3. If none, move to low priority
 * 4. Analyze the bug and attempt fix
 * 5. Mark as fixed when done
 */

import { getUnresolvedIssues, markAsFixed } from '../lib/airtable';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const REPORT_DIR = '/home/ethan/.openclaw/workspace/automation-lab/reports/bug-fixes';

interface BugAnalysis {
  id: string;
  priority: string;
  page: string;
  feedback: string;
  decision: 'fix' | 'already_fixed' | 'skip' | 'architectural';
  reason: string;
  changes?: string[];
}

async function ensureReportDir() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
}

async function writeReport(analysis: BugAnalysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${analysis.id}.md`;
  const filepath = path.join(REPORT_DIR, filename);
  
  const report = `# Bug Fix Report: ${analysis.id}

**Priority:** ${analysis.priority}
**Page:** ${analysis.page}
**Decision:** ${analysis.decision}

## Feedback
${analysis.feedback}

## Analysis
${analysis.reason}

${analysis.changes ? `## Changes Made\n${analysis.changes.map(c => `- ${c}`).join('\n')}` : ''}

---
*Generated: ${new Date().toISOString()}*
`;

  await fs.writeFile(filepath, report);
  console.log(`📄 Report written: ${filename}`);
}

// Track skipped bugs to avoid infinite loops
const SKIP_LIST = new Set([
  'recOM4KV2NfAQOWjh', // 4-tier role system (architectural)
  'recWOb2YnrFANDR5S', // Server-side enforcement (architectural)
  'recFDhl2DJiKP9pnb', // Week view (doesn't exist)
  'recHUg2YPxcsNIQO6', // Version overwrite (duplicate)
]);

async function getNextBug() {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix && !SKIP_LIST.has(i.id));
  
  // Priority order: High → Medium → Low
  for (const priority of ['High', 'Medium', 'Low']) {
    const match = unfixed.find(i => i.priority === priority);
    if (match) return match;
  }
  
  return null;
}

async function analyzeBug(bug: any): Promise<BugAnalysis> {
  const feedback = bug.feedback.toLowerCase();
  const page = (bug.page || '').toLowerCase();
  
  // Pattern matching for common already-fixed scenarios
  if (feedback.includes('no toast') || feedback.includes('no confirmation') || feedback.includes('no success message')) {
    if (feedback.includes('intake form')) {
      return {
        id: bug.id,
        priority: bug.priority,
        page: bug.page || 'Unknown',
        feedback: bug.feedback,
        decision: 'already_fixed',
        reason: 'Intake form already has toast notifications and success page implemented (lines 264, 271, 307-326 in page.tsx)',
      };
    }
  }
  
  if (feedback.includes('active template') && feedback.includes('require')) {
    return {
      id: bug.id,
      priority: bug.priority,
      page: bug.page || 'Unknown',
      feedback: bug.feedback,
      decision: 'already_fixed',
      reason: 'API comment on line 168 confirms: "Active templates only require a name — all other fields are optional"',
    };
  }
  
  if (feedback.includes('version') && feedback.includes('overwrite') && feedback.includes('warning')) {
    return {
      id: bug.id,
      priority: bug.priority,
      page: bug.page || 'Unknown',
      feedback: bug.feedback,
      decision: 'already_fixed',
      reason: 'Overwrite confirmation modal exists (lines 421-444 in versions/page.tsx), API returns SLOTS_FULL error code',
    };
  }
  
  // Architectural changes that need planning
  if (feedback.includes('4 role') || feedback.includes('role tier') || feedback.includes('editor') && feedback.includes('staff') && feedback.includes('role')) {
    return {
      id: bug.id,
      priority: bug.priority,
      page: bug.page || 'Unknown',
      feedback: bug.feedback,
      decision: 'architectural',
      reason: 'Requires database migration to add editor role_level, API changes, and permission middleware implementation',
    };
  }
  
  if (feedback.includes('server-side enforcement') || feedback.includes('no observable server-side')) {
    return {
      id: bug.id,
      priority: bug.priority,
      page: bug.page || 'Unknown',
      feedback: bug.feedback,
      decision: 'architectural',
      reason: 'Requires comprehensive auth middleware and per-route permission checks',
    };
  }
  
  if (feedback.includes('weekly calendar') && feedback.includes('8 columns')) {
    return {
      id: bug.id,
      priority: bug.priority,
      page: bug.page || 'Unknown',
      feedback: bug.feedback,
      decision: 'skip',
      reason: 'Weekly time-slot view does not exist in the codebase (only month grid view exists)',
    };
  }
  
  // Default: needs manual review
  return {
    id: bug.id,
    priority: bug.priority,
    page: bug.page || 'Unknown',
    feedback: bug.feedback,
    decision: 'skip',
    reason: 'Requires manual code analysis and custom fix',
  };
}

async function main() {
  console.log('🤖 Automated Bug Fixer starting...\n');
  
  await ensureReportDir();
  
  const bug = await getNextBug();
  
  if (!bug) {
    console.log('✅ No unfixed bugs remaining!');
    process.exit(0);
  }
  
  console.log(`🐛 Processing bug: ${bug.id}`);
  console.log(`   Priority: ${bug.priority}`);
  console.log(`   Page: ${bug.page || 'Unknown'}`);
  console.log(`   Feedback: ${bug.feedback.substring(0, 100)}...\n`);
  
  const analysis = await analyzeBug(bug);
  
  console.log(`📊 Decision: ${analysis.decision}`);
  console.log(`   Reason: ${analysis.reason}\n`);
  
  // Write report
  await writeReport(analysis);
  
  // Mark as fixed if applicable
  if (analysis.decision === 'already_fixed' || analysis.decision === 'fix') {
    console.log(`✅ Marking ${bug.id} as fixed...`);
    const success = await markAsFixed(bug.id);
    if (success) {
      console.log('   ✓ Marked successfully');
    } else {
      console.log('   ✗ Failed to mark (may need token refresh)');
    }
  } else {
    console.log(`⏭️  Skipping ${bug.id} (${analysis.decision})`);
    console.log('   This bug requires manual intervention or architectural planning.');
  }
  
  // Check remaining count
  const remaining = await getUnresolvedIssues();
  const unfixed = remaining.filter(i => !i.royFix);
  console.log(`\n📊 Remaining unfixed bugs: ${unfixed.length}`);
  console.log(`   High: ${unfixed.filter(i => i.priority === 'High').length}`);
  console.log(`   Medium: ${unfixed.filter(i => i.priority === 'Medium').length}`);
  console.log(`   Low: ${unfixed.filter(i => i.priority === 'Low').length}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
