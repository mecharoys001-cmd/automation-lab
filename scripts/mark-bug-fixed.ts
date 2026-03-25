import Airtable from 'airtable';

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const BASE_ID = 'appdyCFvZRVuCr4tb';
const TABLE_NAME = 'App Feedback';

const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(BASE_ID);

async function markAsFixed(recordId: string) {
  try {
    await base(TABLE_NAME).update(recordId, {
      'ROY Fix': true
    });
    console.log(`✅ Bug ${recordId} marked as "ROY Fix"`);
  } catch (error) {
    console.error(`❌ Failed to mark bug as fixed:`, error);
    process.exit(1);
  }
}

const recordId = process.argv[2];
if (!recordId) {
  console.error('Usage: npx tsx scripts/mark-bug-fixed.ts <record-id>');
  process.exit(1);
}

markAsFixed(recordId);
