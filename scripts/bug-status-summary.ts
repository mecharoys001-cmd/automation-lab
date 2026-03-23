#!/usr/bin/env tsx
/**
 * Complete bug status summary
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  console.log(`📊 BUG STATUS SUMMARY\n`);
  console.log(`Total unresolved: ${issues.length}`);
  
  const unfixed = issues.filter(i => !i.royFix);
  const fixed = issues.filter(i => i.royFix);
  
  console.log(`  ✅ Fixed (ROY Fix = true, awaiting verification): ${fixed.length}`);
  console.log(`  ⬜ Unfixed (ROY Fix = false): ${unfixed.length}\n`);
  
  if (unfixed.length > 0) {
    console.log('⬜ UNFIXED BUGS:\n');
    unfixed.forEach((bug, idx) => {
      console.log(`${idx + 1}. [${bug.priority || 'Unknown'}] ${bug.page || 'Unknown'}${bug.modalName ? ` → ${bug.modalName}` : ''}`);
      console.log(`   ${bug.feedback.substring(0, 100)}${bug.feedback.length > 100 ? '...' : ''}`);
      console.log(`   ID: ${bug.id}\n`);
    });
  }
  
  if (fixed.length > 0) {
    console.log('✅ FIXED (awaiting verification):\n');
    fixed.forEach((bug, idx) => {
      console.log(`${idx + 1}. [${bug.priority || 'Unknown'}] ${bug.page || 'Unknown'}${bug.modalName ? ` → ${bug.modalName}` : ''}`);
      console.log(`   ${bug.feedback.substring(0, 80)}${bug.feedback.length > 80 ? '...' : ''}`);
      console.log(`   ID: ${bug.id}\n`);
    });
  }
}

main().catch(console.error);
