#!/usr/bin/env tsx
import { getIssue } from '../lib/airtable';

async function main() {
  const issue = await getIssue('recebBjYHHYSFThsJ');
  console.log('=== BUG DETAILS ===');
  console.log('ID:', issue?.id);
  console.log('Page:', issue?.page);
  console.log('Priority:', issue?.priority);
  console.log('ROY Fix:', issue?.royFix);
  console.log('\nFeedback:');
  console.log(issue?.feedback);
}

main().catch(console.error);
