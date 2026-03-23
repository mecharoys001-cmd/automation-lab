import { getUnresolvedIssues } from '../lib/airtable.js';

(async () => {
  const issues = await getUnresolvedIssues();
  const unfixedMedium = issues.filter(i => !i.royFix && i.priority === 'Medium');
  
  if (unfixedMedium.length === 0) {
    console.log('No unfixed Medium priority issues!');
    process.exit(0);
  }
  
  const next = unfixedMedium[0];
  console.log(`\n🐛 NEXT MEDIUM PRIORITY BUG:\n`);
  console.log(`ID: ${next.id}`);
  console.log(`Page: ${next.page || 'N/A'}`);
  console.log(`Modal: ${next.modalName || 'N/A'}`);
  console.log(`\nFeedback:\n${next.feedback}\n`);
  if (next.screenshot && next.screenshot.length > 0) {
    console.log(`Screenshots: ${next.screenshot.join(', ')}`);
  }
})();
