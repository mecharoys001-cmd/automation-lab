#!/usr/bin/env tsx
import { getIssue } from '../lib/airtable';

async function main() {
  const bugId = process.argv[2];
  if (!bugId) {
    console.error('Usage: tsx get-bug-details.ts <record-id>');
    process.exit(1);
  }

  const issue = await getIssue(bugId);
  if (issue) {
    console.log('=== BUG DETAILS ===');
    console.log(`ID: ${issue.id}`);
    console.log(`Priority: ${issue.priority}`);
    console.log(`Page: ${issue.page}`);
    console.log(`Modal: ${issue.modalName || 'N/A'}`);
    console.log(`ROY Fix: ${issue.royFix ? 'Yes' : 'No'}`);
    console.log(`\nFeedback:\n${issue.feedback}`);
    if (issue.screenshot && issue.screenshot.length > 0) {
      console.log(`\nScreenshots: ${issue.screenshot.length}`);
      issue.screenshot.forEach((url, i) => console.log(`  ${i+1}. ${url}`));
    }
  } else {
    console.error('Bug not found');
  }
}

main().catch(console.error);
