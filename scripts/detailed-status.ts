import { getUnresolvedIssues } from '../lib/airtable.js';

(async () => {
  const issues = await getUnresolvedIssues();
  
  console.log('\n📋 DETAILED BUG STATUS\n');
  
  const priorities = ['High', 'Medium', 'Low'];
  
  for (const priority of priorities) {
    const filtered = issues.filter(i => i.priority === priority);
    if (filtered.length === 0) continue;
    
    console.log(`\n${{ High: '🔥', Medium: '📌', Low: '📋' }[priority]} ${priority} Priority (${filtered.length}):\n`);
    
    filtered.forEach((issue, idx) => {
      const status = issue.royFix ? '✅' : '⬜';
      console.log(`${idx + 1}. ${status} ${issue.id}`);
      console.log(`   Page: ${issue.page || 'N/A'}`);
      console.log(`   Feedback: ${issue.feedback.substring(0, 80)}...`);
      console.log('');
    });
  }
})();
