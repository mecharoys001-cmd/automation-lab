/**
 * Check for unfixed bugs in Airtable
 * Returns bugs that are NOT marked as "ROY Fix"
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function checkUnfixedBugs() {
  try {
    const allIssues = await getUnresolvedIssues();
    
    // Filter for issues that haven't been marked as "ROY Fix" yet
    const unfixedBugs = allIssues.filter(issue => !issue.royFix);
    
    console.log(`Total unresolved issues: ${allIssues.length}`);
    console.log(`Unfixed bugs (not yet marked ROY Fix): ${unfixedBugs.length}`);
    console.log('');
    
    if (unfixedBugs.length > 0) {
      console.log('Unfixed bugs by priority:');
      const byPriority = {
        High: unfixedBugs.filter(b => b.priority === 'High'),
        Medium: unfixedBugs.filter(b => b.priority === 'Medium'),
        Low: unfixedBugs.filter(b => b.priority === 'Low'),
      };
      
      console.log(`  High: ${byPriority.High.length}`);
      console.log(`  Medium: ${byPriority.Medium.length}`);
      console.log(`  Low: ${byPriority.Low.length}`);
      console.log('');
      
      // Show the highest priority bug
      const nextBug = unfixedBugs[0]; // Already sorted by priority
      console.log('NEXT BUG TO FIX:');
      console.log(`  ID: ${nextBug.id}`);
      console.log(`  Priority: ${nextBug.priority}`);
      console.log(`  Page: ${nextBug.page || 'N/A'}`);
      console.log(`  Modal: ${nextBug.modalName || 'N/A'}`);
      console.log(`  Feedback: ${nextBug.feedback}`);
      if (nextBug.screenshot && nextBug.screenshot.length > 0) {
        console.log(`  Screenshot: ${nextBug.screenshot[0]}`);
      }
      
      // Output as JSON for easy parsing
      console.log('');
      console.log('JSON:');
      console.log(JSON.stringify(nextBug, null, 2));
    } else {
      console.log('✅ No unfixed bugs remaining!');
    }
  } catch (error) {
    console.error('Error checking bugs:', error);
    process.exit(1);
  }
}

checkUnfixedBugs();
