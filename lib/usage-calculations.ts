// lib/usage-calculations.ts
// Calculates expected number of historical runs for external tools
// based on their first run date and frequency.

/**
 * Calculate the number of expected runs from firstRunDate to today.
 *
 * - Daily: one run per day since firstRunDate
 * - Weekly: floor(daysDiff / 7)
 * - Monthly: count full month intervals using day-of-month matching
 *   (e.g., started Feb 15 → counts Mar 15, Apr 15, etc.)
 * - Custom: floor(daysDiff / customInterval)
 *
 * Returns 0 for: future dates, missing frequency, invalid data.
 *
 * Examples:
 *   calculateExpectedRuns('2026-01-01', 'daily')   // ~85 (as of 2026-03-27)
 *   calculateExpectedRuns('2026-01-01', 'weekly')   // 12
 *   calculateExpectedRuns('2026-01-15', 'monthly')  // 2 (Feb 15, Mar 15)
 *   calculateExpectedRuns('2026-01-01', 'custom', 14) // 6
 *   calculateExpectedRuns('2027-01-01', 'daily')    // 0 (future)
 *   calculateExpectedRuns('2026-03-27', 'daily')    // 1 (today counts as first run)
 */
export function calculateExpectedRuns(
  firstRunDate: string | null | undefined,
  frequency: string | null | undefined,
  customInterval?: number | null,
): number {
  if (!firstRunDate || !frequency || frequency === 'none') return 0;

  const start = new Date(firstRunDate + 'T00:00:00');
  if (isNaN(start.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Future date → 0 runs
  if (start > today) return 0;

  const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  switch (frequency) {
    case 'daily':
      // First run date counts as run #1, each subsequent day adds 1
      return daysDiff + 1;

    case 'weekly':
      // First run date counts as run #1, then every 7 days
      return Math.floor(daysDiff / 7) + 1;

    case 'monthly':
      return countMonthlyRuns(start, today);

    case 'custom': {
      const interval = customInterval && customInterval > 0 ? customInterval : 0;
      if (interval === 0) return 0;
      // First run counts as run #1, then every N days
      return Math.floor(daysDiff / interval) + 1;
    }

    default:
      return 0;
  }
}

/**
 * Count full monthly intervals using day-of-month matching.
 * Started Feb 15 → runs on Feb 15, Mar 15, Apr 15, etc.
 * For months where the day doesn't exist (e.g., Jan 31 → Feb has no 31st),
 * the run is placed on the last day of that month.
 */
function countMonthlyRuns(start: Date, today: Date): number {
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();

  let count = 0;
  let year = startYear;
  let month = startMonth;

  while (true) {
    // Calculate the actual run date for this month
    // Use day-of-month matching, clamped to month's last day
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const runDay = Math.min(startDay, daysInMonth);
    const runDate = new Date(year, month, runDay);

    if (runDate > today) break;

    count++;

    // Advance to next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return count;
}
