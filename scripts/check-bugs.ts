import { getUnresolvedIssues } from '../lib/airtable.js';

async function main() {
  const issues = await getUnresolvedIssues();
  const unfixed = issues.filter(i => !i.royFix);

  console.log(JSON.stringify({
    total: issues.length,
    unfixed: unfixed.length,
    issues: unfixed.map(i => ({
      id: i.id,
      priority: i.priority,
      page: i.page,
      modal: i.modalName,
      feedback: i.feedback
    }))
  }, null, 2));
}

main().catch(console.error);
