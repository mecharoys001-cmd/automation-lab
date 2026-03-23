#!/usr/bin/env tsx
import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix);
  
  console.log('\n=== NEXT UNFIXED ISSUE ===\n');
  
  if (unfixed.length === 0) {
    console.log('✅ No unfixed bugs remain!');
    process.exit(0);
  }
  
  const next = unfixed[0];
  console.log('Priority:', next.priority);
  console.log('Page:', next.page);
  console.log('Modal:', next.modalName || 'N/A');
  console.log('ID:', next.id);
  console.log('\nFull Feedback:');
  console.log(next.feedback);
  console.log('\nScreenshots:', next.screenshot || 'None');
}

main().catch(console.error);
