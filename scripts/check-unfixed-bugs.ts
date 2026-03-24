#!/usr/bin/env node
/**
 * Check Airtable for unfixed bugs
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  console.log('🔍 Checking Airtable for unfixed bugs...\n');
  
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix);
  
  console.log(`📊 Summary:`);
  console.log(`  Total unresolved: ${issues.length}`);
  console.log(`  Unfixed (ROY Fix = false): ${unfixed.length}`);
  console.log(`  Fixed but awaiting verification: ${issues.length - unfixed.length}\n`);
  
  if (unfixed.length === 0) {
    console.log('✅ No unfixed bugs! All issues have been addressed.\n');
    process.exit(0);
  }
  
  // Show highest priority unfixed bug
  const highPriority = unfixed.filter(i => i.priority === 'High');
  const mediumPriority = unfixed.filter(i => i.priority === 'Medium');
  const lowPriority = unfixed.filter(i => i.priority === 'Low');
  
  console.log(`🔴 High Priority: ${highPriority.length}`);
  console.log(`🟡 Medium Priority: ${mediumPriority.length}`);
  console.log(`🟢 Low Priority: ${lowPriority.length}\n`);
  
  const nextBug = highPriority[0] || mediumPriority[0] || lowPriority[0];
  
  if (nextBug) {
    console.log('📋 NEXT BUG TO FIX:\n');
    console.log(`  ID: ${nextBug.id}`);
    console.log(`  Priority: ${nextBug.priority || 'Not set'}`);
    console.log(`  Page: ${nextBug.page || 'Not specified'}`);
    console.log(`  Modal: ${nextBug.modalName || 'N/A'}`);
    console.log(`  Feedback: ${nextBug.feedback}\n`);
    if (nextBug.screenshot && nextBug.screenshot.length > 0) {
      console.log(`  Screenshots: ${nextBug.screenshot.length} attached\n`);
    }
    
    // Output as JSON for parsing
    console.log('---JSON---');
    console.log(JSON.stringify(nextBug, null, 2));
  }
}

main().catch(console.error);
