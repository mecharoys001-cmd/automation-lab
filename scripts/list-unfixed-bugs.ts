import { getUnresolvedIssues } from '../lib/airtable.js';

async function main() {
  const issues = await getUnresolvedIssues();

  console.log('\n🔍 Looking for unfixed bugs (ROY Fix = false)...');
  console.log('='.repeat(60));

  const unfixed = issues.filter(i => !i.royFix);

  console.log(`\nFound ${unfixed.length} unfixed bug(s)\n`);

  // Sort by priority (High > Medium > Low)
  const priorityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1, undefined: 0 };
  unfixed.sort((a, b) => (priorityOrder[b.priority || 'undefined'] || 0) - (priorityOrder[a.priority || 'undefined'] || 0));

  unfixed.forEach((issue, idx) => {
    console.log(`${idx + 1}. [${issue.priority || 'No priority'}] ${issue.page || 'Unknown page'}`);
    console.log(`   ID: ${issue.id}`);
    if (issue.modalName) console.log(`   Modal: ${issue.modalName}`);
    console.log(`   ${issue.feedback.substring(0, 150)}${issue.feedback.length > 150 ? '...' : ''}`);
    if (issue.screenshot && issue.screenshot.length > 0) {
      console.log(`   📸 Screenshot: ${issue.screenshot[0]}`);
    }
    console.log();
  });

  // Return the first unfixed bug details
  if (unfixed.length > 0) {
    console.log('\n📌 NEXT BUG TO FIX:');
    console.log('='.repeat(60));
    const next = unfixed[0];
    console.log(`Priority: ${next.priority || 'No priority'}`);
    console.log(`Page: ${next.page || 'Unknown'}`);
    if (next.modalName) console.log(`Modal: ${next.modalName}`);
    console.log(`ID: ${next.id}`);
    console.log(`\nFeedback:\n${next.feedback}`);
    if (next.screenshot && next.screenshot.length > 0) {
      console.log(`\nScreenshot(s):`);
      next.screenshot.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
    }
  }
}

main();
