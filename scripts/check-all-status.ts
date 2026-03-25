import { getUnresolvedIssues } from '../lib/airtable';

async function main() {
  const all = await getUnresolvedIssues();
  
  console.log('\n📊 INCOMPLETE ISSUES STATUS:\n');
  console.log(`Total incomplete: ${all.length}`);
  
  if (all.length > 0) {
    const withRoyFix = all.filter(i => i.royFix);
    const withoutRoyFix = all.filter(i => !i.royFix);
    
    console.log(`  • With ROY Fix: ${withRoyFix.length} (awaiting verification)`);
    console.log(`  • Without ROY Fix: ${withoutRoyFix.length} (unfixed)`);
    
    if (withoutRoyFix.length > 0) {
      console.log('\n❌ UNFIXED BUGS:');
      withoutRoyFix.forEach((bug, idx) => {
        console.log(`\n${idx + 1}. [${bug.priority || 'Unknown'}] ${bug.page || 'Unknown page'}`);
        console.log(`   ${bug.feedback.substring(0, 100)}...`);
        console.log(`   ID: ${bug.id}`);
      });
    }
    
    if (withRoyFix.length > 0) {
      console.log('\n✅ FIXED (awaiting verification):');
      console.log(`   ${withRoyFix.length} issues waiting for verification agent to confirm.`);
    }
  } else {
    console.log('\n🎉 All bugs are either fixed or completed!');
  }
}

main().catch(console.error);
