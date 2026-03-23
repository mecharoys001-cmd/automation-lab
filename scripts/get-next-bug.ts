#!/usr/bin/env tsx
/**
 * Get the next unfixed bug from Airtable
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  console.log('🔍 Fetching unresolved issues...\n');
  
  const issues = await getUnresolvedIssues();
  
  // Find first unfixed issue (prioritize High > Medium > Low)
  const unfixed = issues.find(i => !i.royFix);
  
  if (!unfixed) {
    console.log('✅ No unfixed bugs remaining! All issues have been fixed by ROY.\n');
    console.log('Remaining issues are awaiting verification.\n');
    return;
  }
  
  console.log('🐛 NEXT BUG TO FIX:\n');
  console.log(`ID: ${unfixed.id}`);
  console.log(`Priority: ${unfixed.priority || 'Not set'}`);
  console.log(`Page: ${unfixed.page || 'Not specified'}`);
  if (unfixed.modalName) {
    console.log(`Modal: ${unfixed.modalName}`);
  }
  console.log(`\nFeedback:\n${unfixed.feedback}\n`);
  if (unfixed.screenshot && unfixed.screenshot.length > 0) {
    console.log(`Screenshots: ${unfixed.screenshot.length} attached`);
    unfixed.screenshot.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
  }
  console.log('\n---\n');
  
  // Count remaining
  const remaining = issues.filter(i => !i.royFix).length;
  console.log(`📊 Total unfixed bugs remaining: ${remaining}\n`);
}

main().catch(console.error);
