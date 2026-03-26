#!/usr/bin/env tsx
import { markAsFixed } from '../lib/airtable';

async function main() {
  const bugId = process.argv[2];
  if (!bugId) {
    console.error('Usage: tsx mark-bug-fixed.ts <record-id>');
    process.exit(1);
  }

  console.log(`Marking bug ${bugId} as fixed...`);
  const success = await markAsFixed(bugId);
  
  if (success) {
    console.log('✅ Bug marked as "ROY fix" in Airtable');
  } else {
    console.log('❌ Failed to mark bug as fixed');
    process.exit(1);
  }
}

main().catch(console.error);
