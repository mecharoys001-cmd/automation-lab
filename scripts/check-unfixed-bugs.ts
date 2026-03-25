#!/usr/bin/env tsx
/**
 * Check for bugs that haven't been fixed yet (ROY Fix = FALSE)
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  // Filter for unfixed bugs (ROY Fix = false)
  const unfixed = issues.filter(i => !i.royFix);
  
  if (unfixed.length === 0) {
    console.log('✅ No unfixed bugs remaining. All bugs have been fixed and are awaiting verification.');
    return;
  }
  
  console.log(`🔧 Found ${unfixed.length} unfixed bug(s):\n`);
  
  // Sort by priority: High > Medium > Low
  const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1, undefined: 0 };
  unfixed.sort((a, b) => priorityOrder[b.priority || 'undefined'] - priorityOrder[a.priority || 'undefined']);
  
  // Show the next bug to fix (highest priority first)
  const nextBug = unfixed[0];
  console.log('🎯 Next bug to fix (highest priority):');
  console.log(`   Priority: ${nextBug.priority || 'None'}`);
  console.log(`   ID: ${nextBug.id}`);
  console.log(`   Page: ${nextBug.page || 'Unknown'}`);
  if (nextBug.modalName) console.log(`   Modal: ${nextBug.modalName}`);
  console.log(`   Feedback:\n${nextBug.feedback}\n`);
  
  if (unfixed.length > 1) {
    console.log(`\n📋 Remaining unfixed bugs: ${unfixed.length - 1}`);
    console.log(`   High: ${unfixed.filter(i => i.priority === 'High').length - (nextBug.priority === 'High' ? 1 : 0)}`);
    console.log(`   Medium: ${unfixed.filter(i => i.priority === 'Medium').length - (nextBug.priority === 'Medium' ? 1 : 0)}`);
    console.log(`   Low: ${unfixed.filter(i => i.priority === 'Low').length - (nextBug.priority === 'Low' ? 1 : 0)}`);
  }
}

main().catch(console.error);
