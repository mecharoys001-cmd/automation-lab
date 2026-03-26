import { getUnresolvedIssues } from '../lib/airtable';

(async () => {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix && i.priority === 'Low');
  
  if (unfixed.length === 0) {
    console.log('✅ No unfixed low priority bugs!');
    process.exit(0);
  }

  console.log(`📋 Unfixed Low Priority Bugs (${unfixed.length}):\n`);
  unfixed.slice(0, 5).forEach((bug, idx) => {
    console.log(`${idx + 1}. [${bug.id}] ${bug.page || 'Unknown'}`);
    console.log(`   ${bug.feedback.substring(0, 120)}...`);
    console.log('');
  });
})();
