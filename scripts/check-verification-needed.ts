#!/usr/bin/env tsx
/**
 * Check which bugs are fixed (ROY fix = true) but not yet verified (Completed = false)
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  // Filter for bugs that have been fixed but not verified
  const awaitingVerification = issues.filter(i => i.royFix && !i.completed);
  
  console.log(`📋 Total unresolved issues: ${issues.length}`);
  console.log(`✅ Fixed (ROY fix = true): ${issues.filter(i => i.royFix).length}`);
  console.log(`⏳ Awaiting verification: ${awaitingVerification.length}\n`);
  
  if (awaitingVerification.length > 0) {
    console.log('Issues awaiting verification:');
    awaitingVerification.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. [${issue.priority || 'None'}] ${issue.page || 'Unknown'}${issue.modalName ? ` → ${issue.modalName}` : ''}`);
      console.log(`   ID: ${issue.id}`);
      console.log(`   ${issue.feedback.substring(0, 100)}${issue.feedback.length > 100 ? '...' : ''}`);
    });
  }
  
  const unfixed = issues.filter(i => !i.royFix);
  console.log(`\n🎯 Unfixed bugs: ${unfixed.length}`);
  
  if (unfixed.length > 0) {
    console.log('\nNext bug to fix:');
    const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1, undefined: 0 };
    unfixed.sort((a, b) => (priorityOrder[b.priority!] || 0) - (priorityOrder[a.priority!] || 0));
    const next = unfixed[0];
    console.log(`[${next.priority || 'None'}] ${next.page || 'Unknown'}: ${next.feedback.substring(0, 80)}...`);
  }
}

main().catch(console.error);
