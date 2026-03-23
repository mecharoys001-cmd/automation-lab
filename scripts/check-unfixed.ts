import Airtable from 'airtable';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base('appdyCFvZRVuCr4tb');

  const records = await base('App Feedback')
    .select({
      filterByFormula: 'NOT({Completed})',
      sort: [
        { field: 'Priority', direction: 'desc' },
        { field: 'Created', direction: 'asc' }
      ]
    })
    .all();

  console.log(`Total unresolved: ${records.length}`);
  const unfixed = records.filter(r => !r.get('ROY fix'));
  console.log(`Unfixed (ROY fix = false): ${unfixed.length}`);
  console.log(`Fixed awaiting verification: ${records.length - unfixed.length}`);

  if (unfixed.length > 0) {
    console.log('\n📋 UNFIXED BUGS (highest priority first):');
    unfixed.forEach((r, i) => {
      console.log(`\n${i + 1}. Priority: ${r.get('Priority') || 'None'}`);
      console.log(`   ID: ${r.id}`);
      console.log(`   Page: ${r.get('Page') || 'N/A'}`);
      console.log(`   Modal: ${r.get('Modal Name') || 'N/A'}`);
      console.log(`   Feedback: ${String(r.get('Feedback') || '').substring(0, 150)}...`);
    });
  } else {
    console.log('\n✅ All bugs have been fixed! No unfixed bugs remaining.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
