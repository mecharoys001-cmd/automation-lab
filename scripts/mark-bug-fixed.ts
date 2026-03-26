import { markAsFixed } from '../lib/airtable';

const recordId = process.argv[2] || 'recR59MRuWLfEI1u2';

async function main() {
  console.log(`Marking ${recordId} as "ROY fix" in Airtable...`);
  
  const success = await markAsFixed(recordId);
  
  if (success) {
    console.log(`✅ Successfully marked ${recordId} as "ROY fix"`);
  } else {
    console.error(`❌ Failed to mark ${recordId} as fixed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
