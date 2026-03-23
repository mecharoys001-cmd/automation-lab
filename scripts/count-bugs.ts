import { getUnresolvedIssues } from '../lib/airtable';

async function countBugs() {
  const issues = await getUnresolvedIssues();
  
  const fixed = issues.filter(i => i.royFix);
  const unfixed = issues.filter(i => !i.royFix);
  
  console.log('📊 Bug Status Report');
  console.log('='.repeat(60));
  console.log(`Total unresolved: ${issues.length}`);
  console.log(`  ✅ Fixed (ROY fix=true): ${fixed.length}`);
  console.log(`  ❌ Unfixed (ROY fix=false): ${unfixed.length}`);
  console.log('='.repeat(60));
  
  if (unfixed.length > 0) {
    console.log('\n❌ Unfixed Issues:');
    unfixed.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. [${issue.priority || 'No priority'}] ${issue.page || 'No page'}`);
      console.log(`   ID: ${issue.id}`);
      console.log(`   ${issue.feedback.substring(0, 80)}${issue.feedback.length > 80 ? '...' : ''}`);
    });
  } else {
    console.log('\n✅ All bugs have been fixed! Waiting for verification.');
  }
}

countBugs().catch(console.error);
