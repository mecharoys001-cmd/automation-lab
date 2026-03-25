import { generateSchedule } from '@/lib/scheduler/engine';
import { db } from '@/lib/db';

const programId = db.prepare('SELECT id FROM programs ORDER BY created_at DESC LIMIT 1').get() as any;
if (!programId) {
  console.log('No programs found');
  process.exit(1);
}

console.log('Testing scheduler for program:', programId.id);
const result = generateSchedule(programId.id);

console.log('\n=== SCHEDULING SUMMARY ===');
console.log('Total templates:', result.summary.totalClasses);
console.log('Successfully scheduled:', result.summary.scheduledSessions);
console.log('Failed to schedule:', result.summary.unassignedSessions);
console.log('Success rate:', ((result.summary.scheduledSessions / result.summary.totalClasses * 100) || 0).toFixed(1) + '%');

if (result.summary.unassignedSessions > 0) {
  console.log('\n=== FAILED TEMPLATES ===');
  result.unassigned.forEach(u => {
    console.log(`\n- ${u.className} (${u.sessionsPerWeek} sessions/week)`);
    console.log(`  Reason: ${u.reason || 'Unknown'}`);
  });
}
