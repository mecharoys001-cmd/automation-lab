import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  
  console.log(`Total unresolved: ${issues.length}`);
  const unfixed = issues.filter(r => !r.royFix);
  console.log(`Unfixed (ROY fix = false): ${unfixed.length}`);
  console.log(`Fixed awaiting verification: ${issues.length - unfixed.length}`);

  if (unfixed.length > 0) {
    console.log('\n📋 UNFIXED BUGS (highest priority first):');
    unfixed.forEach((r, i) => {
      console.log(`\n${i + 1}. Priority: ${r.priority || 'None'}`);
      console.log(`   ID: ${r.id}`);
      console.log(`   Page: ${r.page || 'N/A'}`);
      console.log(`   Modal: ${r.modalName || 'N/A'}`);
      console.log(`   Feedback: ${r.feedback.substring(0, 150)}${r.feedback.length > 150 ? '...' : ''}`);
    });
  } else {
    console.log('\n✅ All bugs have been fixed! No unfixed bugs remaining.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
