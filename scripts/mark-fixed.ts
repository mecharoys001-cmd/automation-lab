import { markAsFixed } from '../lib/airtable';

const recordId = process.argv[2];
if (!recordId) {
  console.error('Usage: npx tsx scripts/mark-fixed.ts <record-id>');
  process.exit(1);
}

(async () => {
  const success = await markAsFixed(recordId);
  if (success) {
    console.log(`✅ Marked ${recordId} as fixed`);
  } else {
    console.error(`❌ Failed to mark ${recordId} as fixed`);
    process.exit(1);
  }
})();
