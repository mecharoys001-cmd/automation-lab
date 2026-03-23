import { getUnresolvedIssues } from '../lib/airtable.js';

(async () => {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix);
  
  if (unfixed.length === 0) {
    console.log('No unfixed issues remaining!');
    process.exit(0);
  }
  
  const next = unfixed[0];
  console.log(`\n🐛 NEXT BUG TO FIX:\n`);
  console.log(`ID: ${next.id}`);
  console.log(`Priority: ${next.priority || 'N/A'}`);
  console.log(`Page: ${next.page || 'N/A'}`);
  console.log(`Modal: ${next.modalName || 'N/A'}`);
  console.log(`\nFeedback:\n${next.feedback}\n`);
  if (next.screenshot && next.screenshot.length > 0) {
    console.log(`Screenshots: ${next.screenshot.join(', ')}`);
  }
})();
