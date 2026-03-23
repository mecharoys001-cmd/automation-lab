#!/usr/bin/env tsx
/**
 * Check status of all bugs in Airtable
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  console.log(`📊 Total unresolved issues: ${issues.length}`);
  console.log('');
  
  // Group by priority and ROY fix status
  const byPriority = {
    High: { fixed: 0, unfixed: 0 },
    Medium: { fixed: 0, unfixed: 0 },
    Low: { fixed: 0, unfixed: 0 },
    None: { fixed: 0, unfixed: 0 },
  };
  
  issues.forEach(issue => {
    const priority = issue.priority || 'None';
    if (issue.royFix) {
      byPriority[priority].fixed++;
    } else {
      byPriority[priority].unfixed++;
    }
  });
  
  console.log('Priority breakdown:');
  Object.entries(byPriority).forEach(([priority, counts]) => {
    if (counts.fixed + counts.unfixed > 0) {
      console.log(`  ${priority}: ${counts.unfixed} unfixed, ${counts.fixed} awaiting verification`);
    }
  });
  console.log('');
  
  // List all unfixed bugs
  const unfixed = issues.filter(issue => !issue.royFix);
  
  if (unfixed.length === 0) {
    console.log('✅ All bugs have been marked "ROY fix" and are awaiting verification!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verification agent should test each fix');
    console.log('2. Mark as "Completed" when verified');
    console.log('3. This cron job can be removed');
  } else {
    console.log(`🐛 ${unfixed.length} bugs need fixing:`);
    console.log('');
    unfixed.forEach((bug, i) => {
      console.log(`${i + 1}. [${bug.priority || 'No priority'}] ${bug.page || 'No page'}`);
      console.log(`   ID: ${bug.id}`);
      console.log(`   ${bug.feedback.substring(0, 100)}...`);
      console.log('');
    });
  }
}

main().catch(console.error);
