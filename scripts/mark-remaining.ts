#!/usr/bin/env tsx
import { markAsFixed } from '../lib/airtable';

const remaining = [
  'recXkVuUes8DBHYFQ',
  'reczKKUMYyG058zk1',
  'reccATuSBzAZvjtg4',
  'recKc006g9wzJjEyv',
  'rece1lTqrvC99Jtjj',
  'recpQHQavUDTFWXGT',
  'recyZ7KL18DL69PaX',
  'recDE7O2wrkTjorTL',
  'rec1W2HDYQRsiAAQX',
  'recxEZMCXmmVZjeMN',
  'recQ9JMSi9KSJWi3a',
];

(async () => {
  console.log(`Marking ${remaining.length} remaining bugs...\n`);
  
  for (const id of remaining) {
    try {
      const result = await markAsFixed(id);
      console.log(`${id}: ${result ? '✅' : '❌'}`);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(`${id}: ❌ ERROR - ${e.message}`);
    }
  }
  
  console.log('\nDone!');
})();
