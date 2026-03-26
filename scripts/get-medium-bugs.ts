import { getUnresolvedIssues } from '../lib/airtable';

(async () => {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix && i.priority === 'Medium');
  
  if (unfixed.length === 0) {
    console.log('✅ No unfixed medium priority bugs!');
    process.exit(0);
  }

  const next = unfixed[0];
  console.log(`🐛 Next medium priority bug to fix:\n`);
  console.log(`ID: ${next.id}`);
  console.log(`Priority: ${next.priority}`);
  console.log(`Page: ${next.page || 'Unknown'}\n`);
  console.log(`Feedback:\n${next.feedback}\n`);
  console.log(`📊 Remaining unfixed medium priority bugs: ${unfixed.length}`);
})();
