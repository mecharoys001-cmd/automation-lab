import { getUnresolvedIssues } from '../lib/airtable';

const skipId = process.argv[2];
const priority = process.argv[3] || 'Medium';

if (!skipId) {
  console.error('Usage: npx tsx scripts/skip-bug.ts <record-id-to-skip> [priority]');
  process.exit(1);
}

(async () => {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix && i.priority === priority);
  const remaining = unfixed.filter(i => i.id !== skipId);
  
  if (remaining.length === 0) {
    console.log(`✅ No more unfixed ${priority} priority bugs after skipping!`);
    process.exit(0);
  }

  const next = remaining[0];
  console.log(`🐛 Next ${priority} priority bug to fix (skipping ${skipId}):\n`);
  console.log(`ID: ${next.id}`);
  console.log(`Priority: ${next.priority}`);
  console.log(`Page: ${next.page || 'Unknown'}\n`);
  console.log(`Feedback:\n${next.feedback}\n`);
  console.log(`📊 Remaining unfixed ${priority} priority bugs: ${remaining.length}`);
})();
