/**
 * Symphonix Scheduler — Types
 *
 * Interfaces for the auto-scheduler engine inputs, outputs,
 * and internal data structures. Complements the database types
 * in src/types/database.ts with scheduler-specific shapes.
 */

import type {
  Program,
  SessionTemplate,
  SchoolCalendar,
  ProgramRule,
  Instructor,
  Venue,
  Session,
  SessionInsert,
  AvailabilityJson,
  TemplateType,
  RotationMode,
} from '@/types/database';

// ============================================================
// Engine input / output
// ============================================================

/** What the caller passes to the engine */
export interface SchedulerInput {
  program_id: string;
  /** When set, the engine generates sessions for Jan 1 – Dec 31 of this year
   *  instead of the program's start_date/end_date. */
  year?: number;
  /** When true, run scheduling logic without clearing drafts or inserting sessions.
   *  Returns what WOULD be generated. */
  preview?: boolean;
}

/** What the engine returns after generating sessions */
export interface SchedulerResult {
  success: boolean;
  /** Total draft sessions created */
  sessions_created: number;
  /** Sessions left without an instructor */
  unassigned_count: number;
  /** Sessions created with scheduling warnings (e.g. no qualified instructor) */
  sessions_with_warnings: number;
  /** Number of existing draft sessions deleted before regeneration */
  drafts_cleared: number;
  /** Per-template breakdown for diagnostics */
  template_stats: TemplateStats[];
  /** Dates that were skipped and why */
  skipped_dates: SkippedDate[];
  /** Human-readable summary */
  summary: string;
  /** Error message if success=false */
  error?: string;
  /** Preview statistics: session counts by venue name */
  byVenue?: Record<string, number>;
  /** Preview statistics: session counts by week start date */
  byWeek?: Record<string, number>;
}

/** Per-template statistics */
export interface TemplateStats {
  template_id: string;
  day_of_week: number;
  grade_groups: string[];
  sessions_generated: number;
  sessions_unassigned: number;
}

/** Record of a skipped date with reason */
export interface SkippedDate {
  date: string;
  template_id: string;
  reason: SkipReason;
  detail?: string;
}

export type SkipReason =
  | 'no_school'
  | 'early_dismissal'
  | 'blackout_rule'
  | 'venue_unavailable'
  | 'venue_conflict'
  | 'venue_at_capacity'
  | 'venue_blackout'
  | 'no_instructor'
  | 'no_qualified_instructor'
  | 'week_cycle_skip';

// ============================================================
// Internal data loaded from the database
// ============================================================

/** All data the engine needs, fetched once upfront */
export interface SchedulerData {
  program: Program;
  templates: SessionTemplate[];
  calendar: SchoolCalendar[];
  rules: ProgramRule[];
  instructors: Instructor[];
  venues: Venue[];
  /** Existing non-draft sessions for conflict checking */
  existing_sessions: Session[];
  /** Schedule Builder visual placements (override template day/time) */
  template_placements: TemplatePlacement[];
}

/** A saved placement from the Schedule Builder grid */
export interface TemplatePlacement {
  id: string;
  program_id: string;
  template_id: string;
  /** 0=Mon … 4=Fri */
  day_index: number;
  /** Fractional hours since midnight (e.g. 9.25 = 9:15 AM) */
  start_hour: number;
  /** Duration in fractional hours (e.g. 1.5 = 90 min) */
  duration_hours: number;
  /** Optional venue override from the Schedule Builder grid */
  venue_id?: string | null;
}

/** A session ready to be inserted (before the DB generates id/timestamps) */
export type DraftSession = SessionInsert;

// ============================================================
// Instructor matching
// ============================================================

/** An instructor scored for assignment to a particular session slot */
export interface InstructorCandidate {
  instructor: Instructor;
  /** Number of sessions already assigned (lower = preferred) */
  session_count: number;
}

// ============================================================
// Time helpers
// ============================================================

/** Normalized time window for overlap comparisons */
export interface TimeWindow {
  /** Minutes since midnight */
  start_minutes: number;
  /** Minutes since midnight */
  end_minutes: number;
}

// Re-export database types used throughout the scheduler
export type {
  Program,
  SessionTemplate,
  SchoolCalendar,
  ProgramRule,
  Instructor,
  Venue,
  Session,
  SessionInsert,
  AvailabilityJson,
  TemplateType,
  RotationMode,
};
