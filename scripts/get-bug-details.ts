import Airtable from 'airtable';

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const BASE_ID = 'appdyCFvZRVuCr4tb';
const TABLE_NAME = 'App Feedback';

const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(BASE_ID);

async function getBugDetails(recordId: string) {
  const record = await base(TABLE_NAME).find(recordId);
  
  console.log('='.repeat(80));
  console.log('BUG DETAILS');
  console.log('='.repeat(80));
  console.log(`ID: ${record.id}`);
  console.log(`Priority: ${record.get('Priority')}`);
  console.log(`Page: ${record.get('Page')}`);
  console.log(`Modal Name: ${record.get('Modal Name') || 'N/A'}`);
  console.log(`ROY Fix: ${record.get('ROY Fix') ? '✅' : '⬜'}`);
  console.log(`Completed: ${record.get('Completed') ? '✅' : '⬜'}`);
  console.log('\nFEEDBACK:');
  console.log('-'.repeat(80));
  console.log(record.get('Feedback'));
  console.log('-'.repeat(80));
  
  const screenshots = record.get('Screenshot/Image') as any[];
  if (screenshots && screenshots.length > 0) {
    console.log('\nSCREENSHOTS:');
    screenshots.forEach((s: any) => {
      console.log(`- ${s.url}`);
    });
  }
}

const recordId = process.argv[2] || 'recTabWHCM1FzhzHG';
getBugDetails(recordId);
