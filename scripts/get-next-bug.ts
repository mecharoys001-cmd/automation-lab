/**
 * Get the next unfixed bug (highest priority first)
 */
import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  console.log('🔍 Finding next unfixed bug...\n');
  
  const issues = await getUnresolvedIssues();
  
  // Find first issue that doesn't have ROY fix
  const nextBug = issues.find(issue => !issue.royFix);
  
  if (!nextBug) {
    console.log('✅ No unfixed bugs remaining!');
    process.exit(0);
  }
  
  console.log('🐛 Next Bug to Fix:\n');
  console.log(`ID: ${nextBug.id}`);
  console.log(`Priority: ${nextBug.priority || 'Not Set'}`);
  console.log(`Page: ${nextBug.page || 'Not specified'}`);
  console.log(`Modal: ${nextBug.modalName || 'N/A'}`);
  console.log(`\nFeedback:\n${nextBug.feedback}`);
  
  if (nextBug.screenshot && nextBug.screenshot.length > 0) {
    console.log(`\nScreenshots: ${nextBug.screenshot.length} attached`);
    nextBug.screenshot.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
  }
  
  console.log('\n---');
  console.log(`Total unresolved: ${issues.length}`);
  console.log(`Unfixed: ${issues.filter(i => !i.royFix).length}`);
}

main().catch(console.error);
