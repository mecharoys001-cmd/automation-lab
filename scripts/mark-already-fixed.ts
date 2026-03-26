#!/usr/bin/env tsx
import { markAsFixed } from '../lib/airtable';

const alreadyFixed = [
  'recyHBQr4mshvAMON', // Intake feedback
  'recd54cuIBueuGgxa', // Active templates
  'recR4nEGyvZ9MWjkK', // Version overwrite
  'recHUg2YPxcsNIQO6', // Version overwrite duplicate
  'recA39Nz2IolzR7Yk', // Max-length attributes
  'recSd7hEZNbd4mnXq', // Lazy loading
];

(async () => {
  console.log('Marking already-fixed bugs...\n');
  
  for (const id of alreadyFixed) {
    try {
      const success = await markAsFixed(id);
      console.log(`${id}: ${success ? '✅' : '❌'}`);
    } catch (e) {
      console.log(`${id}: ❌ ERROR - ${e.message}`);
    }
  }
  
  console.log('\nDone!');
})();
