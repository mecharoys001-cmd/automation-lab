#!/usr/bin/env tsx
import { markAsFixed } from '../lib/airtable';

async function main() {
  const recordId = 'recebBjYHHYSFThsJ';
  console.log(`Marking ${recordId} as "ROY fix"...`);
  
  const success = await markAsFixed(recordId);
  
  if (success) {
    console.log('✅ Successfully marked as ROY fix');
  } else {
    console.error('❌ Failed to mark as ROY fix');
    process.exit(1);
  }
}

main().catch(console.error);
