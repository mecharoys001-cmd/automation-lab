/**
 * List medium priority unfixed bugs from Airtable
 */

import { getUnresolvedIssues } from '../lib/airtable.js';

async function main() {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix);
  const mediumBugs = unfixed.filter(i => i.priority === 'Medium');
  
  console.log(`Found ${mediumBugs.length} Medium priority unfixed bugs:\n`);
  
  mediumBugs.forEach((bug, i) => {
    console.log(`${i+1}. [${bug.id}] ${bug.page || 'Unknown page'}`);
    console.log(`   ${bug.feedback?.substring(0, 150)}...\n`);
  });
  
  if (mediumBugs.length > 0) {
    console.log(`\n🎯 Next bug to fix:\n`);
    const next = mediumBugs[0];
    console.log(`ID: ${next.id}`);
    console.log(`Page: ${next.page}`);
    console.log(`Modal: ${next.modalName || 'N/A'}`);
    console.log(`\nFeedback:\n${next.feedback}`);
  }
}

main().catch(console.error);
