#!/usr/bin/env tsx
/**
 * Get bug status summary
 */

import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  console.log('📊 Bug Status Summary\n');
  
  const issues = await getUnresolvedIssues();
  
  const total = issues.length;
  const fixed = issues.filter(i => i.royFix).length;
  const unfixed = issues.filter(i => !i.royFix).length;
  
  console.log(`Total unresolved: ${total}`);
  console.log(`  ✅ Fixed by ROY (awaiting verification): ${fixed}`);
  console.log(`  🐛 Unfixed (need work): ${unfixed}\n`);
  
  // Breakdown by priority
  const byPriority = {
    High: { total: 0, fixed: 0 },
    Medium: { total: 0, fixed: 0 },
    Low: { total: 0, fixed: 0 },
  };
  
  issues.forEach(i => {
    const p = i.priority || 'Low';
    byPriority[p].total++;
    if (i.royFix) byPriority[p].fixed++;
  });
  
  console.log('By Priority:');
  console.log(`  🔥 High: ${byPriority.High.total} total (${byPriority.High.fixed} fixed, ${byPriority.High.total - byPriority.High.fixed} unfixed)`);
  console.log(`  📌 Medium: ${byPriority.Medium.total} total (${byPriority.Medium.fixed} fixed, ${byPriority.Medium.total - byPriority.Medium.fixed} unfixed)`);
  console.log(`  📋 Low: ${byPriority.Low.total} total (${byPriority.Low.fixed} fixed, ${byPriority.Low.total - byPriority.Low.fixed} unfixed)\n`);
}

main().catch(console.error);
