#!/usr/bin/env tsx
/**
 * Automated Bug Fixer v2 - Complete implementation
 * 
 * Features:
 * - Intelligent bug categorization
 * - Automated fixes for simple bugs
 * - Claude Code delegation for complex bugs
 * - Build validation & deployment
 * - Progress tracking & reporting
 * - Error handling & recovery
 */

import { getUnresolvedIssues, markAsFixed } from '../lib/airtable';
import { categorizeBug, shouldSkip, canAutoFix } from './bug-taxonomy';
import { applyFixStrategy, type Bug, type FixResult } from './fix-strategies';
import { deployFix } from './deploy-fix';
import { startWork, completeWork, recordError, isStuck, getAttemptCount } from './state-manager';
import { generateDashboard } from './bug-dashboard';

const REPORT_DIR = '/home/ethan/.openclaw/workspace/automation-lab/reports/bug-fixes';
const MAX_ATTEMPTS = 3;

async function ensureReportDir() {
  const fs = await import('fs/promises');
  await fs.mkdir(REPORT_DIR, { recursive: true });
}

async function writeReport(bug: Bug, decision: string, reason: string, fixResult?: FixResult) {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${bug.id}.md`;
  const filepath = path.join(REPORT_DIR, filename);
  
  const report = `# Bug Fix Report: ${bug.id}

**Priority:** ${bug.priority}
**Page:** ${bug.page}
**Decision:** ${decision}
**Category:** ${categorizeBug(bug.id)}

## Feedback
${bug.feedback}

## Analysis
${reason}

${fixResult ? `## Fix Result
**Success:** ${fixResult.success ? 'Yes' : 'No'}

### Changes
${fixResult.changes.map(c => `- ${c}`).join('\n')}

${fixResult.error ? `### Error\n${fixResult.error}` : ''}
` : ''}

---
*Generated: ${new Date().toISOString()}*
`;

  await fs.writeFile(filepath, report);
  console.log(`📄 Report written: ${filename}`);
}

async function getNextBug(): Promise<Bug | null> {
  const issues = await getUnresolvedIssues();
  
  // Filter out already fixed and skipped bugs
  const fixable = issues.filter(i => !i.royFix && !shouldSkip(i.id));
  
  if (fixable.length === 0) return null;
  
  // Priority order: Auto-fixable first, then by priority
  for (const priority of ['High', 'Medium', 'Low']) {
    const auto = fixable.find(i => i.priority === priority && canAutoFix(i.id));
    if (auto) return auto;
  }
  
  for (const priority of ['High', 'Medium', 'Low']) {
    const manual = fixable.find(i => i.priority === priority);
    if (manual) return manual;
  }
  
  return null;
}

async function handleAlreadyFixed(bug: Bug): Promise<void> {
  console.log(`✓ Bug ${bug.id} was already fixed`);
  await markAsFixed(bug.id);
  await writeReport(bug, 'already_fixed', 'Bug was already fixed in previous work');
}

async function handleSkipped(bug: Bug, reason: string): Promise<void> {
  console.log(`⏭️  Skipping ${bug.id}: ${reason}`);
  await writeReport(bug, 'skip', reason);
}

async function attemptFix(bug: Bug): Promise<FixResult> {
  console.log(`🔧 Attempting to fix ${bug.id}...`);
  
  try {
    // Apply fix strategy
    const fixResult = await applyFixStrategy(bug);
    
    if (fixResult.success) {
      console.log(`✅ Fix applied successfully`);
      console.log(`   Changes: ${fixResult.changes.length}`);
      
      // Deploy the fix
      const deployed = await deployFix(bug, fixResult);
      
      if (deployed) {
        await writeReport(bug, 'fixed', 'Bug fixed and deployed', fixResult);
        return fixResult;
      } else {
        throw new Error('Deployment failed');
      }
    } else {
      throw new Error(fixResult.error || 'Fix failed');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Fix attempt failed: ${errorMsg}`);
    
    const failResult: FixResult = {
      success: false,
      changes: [],
      error: errorMsg,
    };
    
    await writeReport(bug, 'failed', `Fix attempt failed: ${errorMsg}`, failResult);
    await recordError(errorMsg);
    
    return failResult;
  }
}

async function main() {
  console.log('🤖 Automated Bug Fixer v2 starting...\n');
  
  await ensureReportDir();
  
  // Check if stuck on a bug
  if (await isStuck()) {
    console.log('⚠️  Detected stuck state, clearing...');
    await completeWork();
  }
  
  // Get next bug
  const bug = await getNextBug();
  
  if (!bug) {
    console.log('✅ No more fixable bugs!');
    await generateDashboard();
    process.exit(0);
  }
  
  console.log(`🐛 Processing bug: ${bug.id}`);
  console.log(`   Priority: ${bug.priority}`);
  console.log(`   Page: ${bug.page || 'Unknown'}`);
  console.log(`   Category: ${categorizeBug(bug.id)}`);
  console.log(`   Feedback: ${bug.feedback.substring(0, 100)}...\n`);
  
  // Track work
  await startWork(bug.id);
  
  // Check if this bug should be marked as already fixed
  const category = categorizeBug(bug.id);
  if (category === 'ALREADY_FIXED') {
    await handleAlreadyFixed(bug);
    await completeWork();
    await generateDashboard();
    process.exit(0);
  }
  
  // Check attempt count
  const attempts = await getAttemptCount();
  if (attempts >= MAX_ATTEMPTS) {
    await handleSkipped(bug, `Max attempts (${MAX_ATTEMPTS}) reached`);
    await completeWork();
    await generateDashboard();
    process.exit(0);
  }
  
  // Attempt fix
  const result = await attemptFix(bug);
  
  if (result.success) {
    await completeWork();
    console.log(`\n✅ Successfully fixed ${bug.id}`);
  } else {
    console.log(`\n❌ Failed to fix ${bug.id} (attempt ${attempts}/${MAX_ATTEMPTS})`);
  }
  
  // Update dashboard
  await generateDashboard();
  
  // Check remaining count
  const remaining = await getUnresolvedIssues();
  const unfixed = remaining.filter(i => !i.royFix && !shouldSkip(i.id));
  console.log(`\n📊 Remaining fixable bugs: ${unfixed.length}`);
  console.log(`   High: ${unfixed.filter(i => i.priority === 'High').length}`);
  console.log(`   Medium: ${unfixed.filter(i => i.priority === 'Medium').length}`);
  console.log(`   Low: ${unfixed.filter(i => i.priority === 'Low').length}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
