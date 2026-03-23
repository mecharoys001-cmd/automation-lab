#!/usr/bin/env tsx
/**
 * Check which bugs are awaiting verification
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  // Fixed but not completed = awaiting verification
  const awaitingVerification = issues.filter(i => i.royFix);
  
  console.log(`📋 Status Summary:\n`);
  console.log(`Total unresolved: ${issues.length}`);
  console.log(`Awaiting verification: ${awaitingVerification.length}`);
  console.log(`Unfixed: ${issues.length - awaitingVerification.length}\n`);
  
  if (awaitingVerification.length > 0) {
    console.log('🔍 Issues awaiting verification:\n');
    awaitingVerification.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${issue.priority}] ${issue.page || 'Unknown'}${issue.modalName ? ` → ${issue.modalName}` : ''}`);
      console.log(`   ${issue.feedback.substring(0, 80)}${issue.feedback.length > 80 ? '...' : ''}\n`);
    });
  }
  
  if (issues.length - awaitingVerification.length === 0) {
    console.log('✅ All bugs have been fixed! Awaiting verification completion.');
  }
}

main().catch(console.error);
