/**
 * Symphonix Scheduler — Utility Functions
 *
 * Pure helper functions for date iteration, time parsing,
 * overlap detection, and availability matching. No database
 * calls — these are deterministic and testable in isolation.
 */

import type { AvailabilityJson, TimeWindow, SchoolCalendar, ProgramRule } from './types';

// ============================================================
// Day-of-week mapping
// ============================================================

/** Maps JS Date.getDay() (0=Sunday) to availability_json keys */
const DAY_INDEX_TO_NAME: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export function dayIndexToName(dayIndex: number): string {
  return DAY_INDEX_TO_NAME[dayIndex] ?? 'sunday';
}

// ============================================================
// Time parsing & comparison
// ============================================================

/**
 * Parses a time string ("HH:MM" or "HH:MM:SS") to minutes since midnight.
 * Returns NaN for invalid input.
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

/** Converts minutes since midnight back to "HH:MM" format */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Creates a TimeWindow from start/end time strings */
export function toTimeWindow(startTime: string, endTime: string): TimeWindow {
  return {
    start_minutes: timeToMinutes(startTime),
    end_minutes: timeToMinutes(endTime),
  };
}

/**
 * Checks if two time windows overlap.
 * Two windows overlap when one starts before the other ends AND ends after the other starts.
 * Adjacent windows (one ends exactly when the other starts) do NOT overlap.
 */
export function timeWindowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start_minutes < b.end_minutes && a.end_minutes > b.start_minutes;
}

/**
 * Checks if window `inner` is fully contained within window `outer`.
 * Used to verify an instructor/venue is available for the entire session duration.
 */
export function timeWindowContains(outer: TimeWindow, inner: TimeWindow): boolean {
  return outer.start_minutes <= inner.start_minutes && outer.end_minutes >= inner.end_minutes;
}

// ============================================================
// Availability checking
// ============================================================

/**
 * Checks if an availability_json has a time block that fully covers the
 * requested time window on the given day of week.
 *
 * Returns true if at least one block in the day's schedule contains the window.
 * Returns true if availability_json is null (treat as "always available").
 */
export function availabilityCoversWindow(
  availability: AvailabilityJson | null,
  dayOfWeek: number,
  sessionWindow: TimeWindow
): boolean {
  // Null availability = unrestricted (always available)
  if (!availability) return true;

  const dayName = dayIndexToName(dayOfWeek);
  const blocks = availability[dayName as keyof AvailabilityJson];

  // No blocks defined for this day = unavailable
  if (!blocks || blocks.length === 0) return false;

  // At least one block must fully contain the session window
  return blocks.some((block) => {
    const blockWindow = toTimeWindow(block.start, block.end);
    return timeWindowContains(blockWindow, sessionWindow);
  });
}

// ============================================================
// Date utilities
// ============================================================

/** Formats a Date to "YYYY-MM-DD" (ISO date string, no timezone drift) */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" to a Date (at midnight UTC to avoid timezone issues) */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Generates all dates from startDate to endDate (inclusive) that match
 * the given JS day-of-week (0=Sunday ... 6=Saturday).
 */
export function datesForDayOfWeek(
  startDate: string,
  endDate: string,
  dayOfWeek: number
): string[] {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  // Advance to the first occurrence of the target day
  const current = new Date(start);
  const daysUntilTarget = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + daysUntilTarget);

  // Walk week by week
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

// ============================================================
// Calendar & rule lookups
// ============================================================

/**
 * Builds a lookup map from the school_calendar entries.
 * Key: date string "YYYY-MM-DD", Value: array of calendar entries for that date.
 */
export function buildCalendarMap(
  calendar: SchoolCalendar[]
): Map<string, SchoolCalendar[]> {
  const map = new Map<string, SchoolCalendar[]>();
  for (const entry of calendar) {
    const existing = map.get(entry.date) ?? [];
    existing.push(entry);
    map.set(entry.date, existing);
  }
  return map;
}

/**
 * Builds a Set of blackout day-of-week numbers from active program rules.
 * e.g., if "No Wednesday sessions" rule exists → Set contains 3.
 */
export function buildBlackoutDaysSet(rules: ProgramRule[]): Set<number> {
  const set = new Set<number>();
  for (const rule of rules) {
    if (rule.rule_type === 'blackout_day' && rule.is_active && rule.day_of_week !== null) {
      set.add(rule.day_of_week);
    }
  }
  return set;
}

// ============================================================
// Skill matching
// ============================================================

/**
 * Checks if an instructor's skills are a superset of the required skills.
 * Comparison is case-insensitive (e.g., "Strings" matches "strings").
 * If required_skills is null or empty, any instructor matches.
 * If instructor has null skills, they only match when no skills are required.
 */
export function skillsMatch(
  instructorSkills: string[] | null,
  requiredSkills: string[] | null
): boolean {
  // No requirements → everyone qualifies
  if (!requiredSkills || requiredSkills.length === 0) return true;

  // Requirements exist but instructor has no skills → no match
  if (!instructorSkills || instructorSkills.length === 0) return false;

  // Every required skill must be in the instructor's skill set (case-insensitive)
  const skillSet = new Set(instructorSkills.map((s) => s.toLowerCase()));
  return requiredSkills.every((skill) => skillSet.has(skill.toLowerCase()));
}
