import { markAsFixed } from '../lib/airtable.js';

(async () => {
  const recordId = process.argv[2];
  if (!recordId) {
    console.error('Usage: npx tsx scripts/mark-fixed.ts <recordId>');
    process.exit(1);
  }

  const success = await markAsFixed(recordId);
  console.log(success ? `✅ Marked ${recordId} as fixed` : `❌ Failed to mark ${recordId} as fixed`);
})();
