import { markAsFixed } from '../lib/airtable';

const bugId = process.argv[2];
if (!bugId) {
  console.error('Usage: tsx scripts/mark-bug-fixed.ts <record-id>');
  process.exit(1);
}

markAsFixed(bugId)
  .then(() => console.log('✅ Marked', bugId, 'as ROY Fix'))
  .catch(console.error);
