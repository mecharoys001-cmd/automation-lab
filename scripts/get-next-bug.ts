#!/usr/bin/env tsx
/**
 * Get the next unfixed bug (highest priority first)
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  // Filter for unfixed bugs (royFix = false)
  const unfixed = issues.filter(i => !i.royFix);
  
  if (unfixed.length === 0) {
    console.log('✅ No unfixed bugs remaining!');
    process.exit(0);
  }
  
  // Sort by priority (High > Medium > Low)
  const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
  unfixed.sort((a, b) => {
    const aPriority = priorityOrder[a.priority || 'Low'];
    const bPriority = priorityOrder[b.priority || 'Low'];
    return bPriority - aPriority;
  });
  
  const nextBug = unfixed[0];
  
  console.log('🐛 Next bug to fix:\n');
  console.log(`ID: ${nextBug.id}`);
  console.log(`Priority: ${nextBug.priority}`);
  console.log(`Page: ${nextBug.page || 'Unknown'}`);
  if (nextBug.modalName) {
    console.log(`Modal: ${nextBug.modalName}`);
  }
  console.log(`\nFeedback:\n${nextBug.feedback}`);
  
  if (nextBug.screenshot && nextBug.screenshot.length > 0) {
    console.log(`\nScreenshots: ${nextBug.screenshot.length}`);
    nextBug.screenshot.forEach((url, idx) => {
      console.log(`  ${idx + 1}. ${url}`);
    });
  }
  
  console.log(`\n📊 Remaining unfixed bugs: ${unfixed.length}`);
  console.log(`   High: ${unfixed.filter(i => i.priority === 'High').length}`);
  console.log(`   Medium: ${unfixed.filter(i => i.priority === 'Medium').length}`);
  console.log(`   Low: ${unfixed.filter(i => i.priority === 'Low').length}`);
}

main().catch(console.error);
