#!/usr/bin/env tsx
/**
 * Get the next unresolved bug to fix
 * Shows full details and suggests the Claude Code command
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  console.log('🔍 Finding next bug to fix...\n');
  
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix);
  
  if (unfixed.length === 0) {
    console.log('🎉 All issues have been fixed! Waiting for verification.');
    return;
  }
  
  // Get highest priority unfixed issue
  const high = unfixed.filter(i => i.priority === 'High');
  const medium = unfixed.filter(i => i.priority === 'Medium');
  const low = unfixed.filter(i => i.priority === 'Low');
  
  const next = high[0] || medium[0] || low[0];
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 NEXT BUG TO FIX`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`🎯 Priority: ${next.priority || 'None'}`);
  console.log(`📍 Location: ${next.page || 'Unknown'}${next.modalName ? ` → ${next.modalName}` : ''}`);
  console.log(`🆔 Record ID: ${next.id}\n`);
  
  console.log('📝 FEEDBACK:');
  console.log('─'.repeat(50));
  console.log(next.feedback);
  console.log('─'.repeat(50));
  console.log();
  
  if (next.screenshot && next.screenshot.length > 0) {
    console.log(`📸 Screenshot: ${next.screenshot[0]}\n`);
  }
  
  console.log('🔧 SUGGESTED CLAUDE CODE COMMAND:');
  console.log('─'.repeat(50));
  console.log(`claude -p --dangerously-skip-permissions "Fix bug in Symphonix Scheduler:\n`);
  console.log(`**Issue:** ${next.feedback.substring(0, 200)}${next.feedback.length > 200 ? '...' : ''}\n`);
  console.log(`**Location:** ${next.page || 'Unknown'}${next.modalName ? ` → ${next.modalName}` : ''}`);
  console.log(`**Priority:** ${next.priority || 'Medium'}\n`);
  console.log(`Read the existing code, understand the root cause, fix it properly.`);
  console.log(`Test the fix. Deploy to production. Report what you changed and why."`);
  console.log('─'.repeat(50));
  console.log();
  
  console.log('📊 REMAINING BACKLOG:');
  console.log(`   🔥 High: ${high.length}`);
  console.log(`   📌 Medium: ${medium.length}`);
  console.log(`   📋 Low: ${low.length}`);
  console.log(`   ━━━━━━━━━━━━━━━━`);
  console.log(`   Total: ${unfixed.length} unfixed\n`);
  
  console.log('After fixing, mark as complete with:');
  console.log(`   markAsFixed('${next.id}')\n`);
}

main().catch(console.error);
