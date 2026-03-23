/**
 * Fetch unfixed bugs from Airtable
 * Returns bugs that are NOT completed and NOT marked as "ROY Fix"
 */
import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  try {
    console.log('Fetching unresolved issues from Airtable...\n');
    
    const issues = await getUnresolvedIssues();
    
    // Filter out bugs already marked as "ROY Fix" (waiting verification)
    const unfixedIssues = issues.filter(issue => !issue.royFix);
    
    if (unfixedIssues.length === 0) {
      console.log('✅ No unfixed bugs found! All issues are either fixed or completed.');
      process.exit(0);
    }
    
    // Sort by priority: High > Medium > Low
    const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
    unfixedIssues.sort((a, b) => {
      const aPriority = a.priority ? (priorityOrder[a.priority] || 0) : 0;
      const bPriority = b.priority ? (priorityOrder[b.priority] || 0) : 0;
      return bPriority - aPriority;
    });
    
    console.log(`Found ${unfixedIssues.length} unfixed bugs:\n`);
    
    // Show top 5
    unfixedIssues.slice(0, 5).forEach((issue, idx) => {
      console.log(`${idx + 1}. [${issue.priority || 'No Priority'}] ${issue.id}`);
      console.log(`   Page: ${issue.page || 'N/A'}`);
      console.log(`   Modal: ${issue.modalName || 'N/A'}`);
      console.log(`   Feedback: ${issue.feedback.substring(0, 100)}${issue.feedback.length > 100 ? '...' : ''}`);
      console.log('');
    });
    
    // Output the next bug to fix as JSON
    console.log('\n--- NEXT BUG TO FIX ---');
    console.log(JSON.stringify(unfixedIssues[0], null, 2));
    
  } catch (error) {
    console.error('Error fetching bugs:', error);
    process.exit(1);
  }
}

main();
