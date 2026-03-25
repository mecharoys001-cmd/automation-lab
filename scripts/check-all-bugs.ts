import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const issues = await getUnresolvedIssues();
  console.log(`\nTotal unresolved issues: ${issues.length}`);
  
  if (issues.length > 0) {
    const royFixed = issues.filter(i => i.royFix);
    const unfixed = issues.filter(i => !i.royFix);
    console.log(`  - ROY fixed (awaiting verification): ${royFixed.length}`);
    console.log(`  - Unfixed: ${unfixed.length}\n`);
    
    if (unfixed.length > 0) {
      console.log('Unfixed breakdown:');
      const byPriority = { High: 0, Medium: 0, Low: 0 };
      unfixed.forEach(i => {
        byPriority[i.priority || 'Low']++;
      });
      console.log(`  High: ${byPriority.High}`);
      console.log(`  Medium: ${byPriority.Medium}`);
      console.log(`  Low: ${byPriority.Low}`);
    }
  } else {
    console.log('✅ All bugs fixed and verified!');
  }
}

main().catch(console.error);
