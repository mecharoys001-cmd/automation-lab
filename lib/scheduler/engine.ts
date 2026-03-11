/**
 * Symphonix Scheduler — Best Fit Engine
 *
 * Core auto-scheduling algorithm. Given a program_id, generates
 * draft sessions by stamping event templates across the program
 * date range while respecting:
 *
 *  - School calendar blackout dates (no_school)
 *  - Early dismissal cutoffs
 *  - Recurring blackout rules (program_rules)
 *  - Instructor skill matching
 *  - Instructor availability windows
 *  - Instructor double-booking prevention
 *  - Instructor-specific calendar exceptions
 *  - Venue availability and conflict detection
 *  - Load balancing (prefer instructor with fewest sessions)
 *
 * Re-running clears existing DRAFT sessions and regenerates.
 * Published/canceled/completed sessions are never touched.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  SchedulerInput,
  SchedulerResult,
  SchedulerData,
  ScheduleWarning,
  DraftSession,
  TemplateStats,
  SkippedDate,
  InstructorCandidate,
  SessionTemplate,
  Instructor,
  Venue,
  Session,
  SchoolCalendar,
  TimeWindow,
  TemplatePlacement,
  ProgramRule,
} from './types';
import {
  datesForDayOfWeek,
  buildCalendarMap,
  buildBlackoutDaysSet,
  toTimeWindow,
  timeWindowsOverlap,
  availabilityCoversWindow,
  skillsMatch,
  timeToMinutes,
  dayIndexToName,
  weeksSinceStart,
  parseDate,
  formatDate,
} from './utils';
import {
  findInstructorForTaggedSlot,
  findInstructorForAutoAssign,
  findInstructorForTimeBlock,
  createRotationMap,
  type AutoAssignContext,
} from './auto-assign';

// ============================================================
// Helpers
// ============================================================

/** Returns true if a template has valid timing information (either start/end times OR duration). */
function hasValidTimes(template: SessionTemplate): boolean {
  // Duration-based templates (new scheduling modes)
  if (template.duration_minutes && template.duration_minutes > 0) {
    return true;
  }
  
  // Fixed-time templates (legacy/traditional scheduling)
  if (!template.start_time || !template.end_time) return false;
  const start = timeToMinutes(template.start_time);
  const end = timeToMinutes(template.end_time);
  return !isNaN(start) && !isNaN(end) && start < end;
}

/** Convert a fractional hour (e.g. 9.25) to "HH:MM" string (e.g. "09:15"). */
function hourToTime(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates urgency score for a template.
 * Higher urgency = more constrained = should be assigned first.
 * 
 * Urgency = sessions_needed / (qualified_instructors × available_slots + 1)
 * 
 * @returns Urgency score (higher = more constrained, Infinity = impossible to assign)
 */
function calculateTemplateUrgency(
  template: SessionTemplate,
  instructors: Instructor[],
  programStartDate: string,
  programEndDate: string,
  blackoutDays: Set<number>
): number {
  // Count qualified instructors
  const qualifiedCount = instructors.filter(i =>
    i.is_active && skillsMatch(i.skills, template.required_skills)
  ).length;

  if (qualifiedCount === 0) return Infinity; // Most urgent - impossible to assign

  // Count sessions to generate (dates for this day_of_week in range)
  if (template.day_of_week == null) return 0; // No set day - skip urgency
  const dates = datesForDayOfWeek(programStartDate, programEndDate, template.day_of_week);
  const validDates = dates.filter(d => !blackoutDays.has(template.day_of_week!));
  const sessionsNeeded = validDates.length;

  if (sessionsNeeded === 0) return 0; // No sessions needed - lowest urgency

  // Calculate available slots per instructor (simplified: assume 8 hour days)
  // In practice this would check actual availability windows
  const avgSlotsPerInstructor = 8; // Conservative estimate

  const urgency = sessionsNeeded / (qualifiedCount * avgSlotsPerInstructor + 1);
  return urgency;
}

/**
 * Finds the specific session blocking an instructor from being assigned.
 * Used for enhanced conflict diagnostics.
 */
function findBlockingSession(
  instructorId: string,
  date: string,
  sessionWindow: TimeWindow,
  existingSessions: Session[],
  generatedSessions: DraftSession[]
): Session | DraftSession | null {
  // Check existing sessions
  for (const session of existingSessions) {
    if (session.instructor_id === instructorId && session.date === date && session.status !== 'canceled') {
      const window = toTimeWindow(session.start_time, session.end_time);
      if (timeWindowsOverlap(sessionWindow, window)) {
        return session;
      }
    }
  }
  
  // Check generated sessions
  for (const draft of generatedSessions) {
    if (draft.instructor_id === instructorId && draft.date === date) {
      const window = toTimeWindow(draft.start_time, draft.end_time);
      if (timeWindowsOverlap(sessionWindow, window)) {
        return draft;
      }
    }
  }
  
  return null;
}

// ============================================================
// Scheduling mode helpers
// ============================================================

/**
 * Computes the effective date range and optional session cap for a template
 * based on its scheduling_mode. Returns the narrowed start/end dates and
 * an optional maxSessions limit.
 */
function getTemplateDateRange(
  template: SessionTemplate,
  programStart: string,
  programEnd: string,
): { start: string; end: string; maxSessions?: number } {
  const mode = template.scheduling_mode ?? 'ongoing';

  switch (mode) {
    case 'date_range': {
      // Use template dates if specified, otherwise fall back to program dates
      const start = template.starts_on ?? programStart;
      const end = template.ends_on ?? programEnd;
      return { start, end };
    }

    case 'duration': {
      // Use template start if specified, otherwise fall back to program start
      const start = template.starts_on ?? programStart;
      const startDate = parseDate(start);
      startDate.setDate(startDate.getDate() + (template.duration_weeks ?? 0) * 7);
      const end = formatDate(startDate);
      return { start, end };
    }

    case 'session_count': {
      // Use template start if specified, otherwise fall back to program start
      const start = template.starts_on ?? programStart;
      let end = programEnd;
      if (template.within_weeks) {
        const startDate = parseDate(start);
        startDate.setDate(startDate.getDate() + template.within_weeks * 7);
        const computed = formatDate(startDate);
        end = computed <= programEnd ? computed : programEnd;
      }
      return { start, end, maxSessions: template.session_count ?? undefined };
    }

    case 'ongoing':
    default:
      return { start: programStart, end: programEnd };
  }
}

// ============================================================
// Monte Carlo attempt types & helper
// ============================================================

/** Result of a single greedy scheduling attempt. */
interface AttemptResult {
  generatedSessions: DraftSession[];
  skippedDates: SkippedDate[];
  templateStats: Map<string, TemplateStats>;
  instructorSessionCounts: Map<string, number>;
  sessionsWithWarnings: number;
  unassignedReasons: Map<string, number>;
}

/**
 * Deterministic shuffle of elements sharing the same urgency score.
 * Uses attempt number to vary tie-breaking across attempts.
 */
function shuffleTies(
  items: { template: SessionTemplate; urgency: number }[],
  attempt: number
): void {
  // Group consecutive runs of equal urgency and shuffle within each run
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && items[j].urgency === items[i].urgency) j++;
    // items[i..j) share the same urgency — shuffle them deterministically
    if (j - i > 1) {
      const slice = items.slice(i, j);
      // Simple seeded Fisher-Yates using attempt to vary the seed
      for (let k = slice.length - 1; k > 0; k--) {
        // Cheap deterministic hash: mix attempt, k, and template id
        const hash = hashSeed(attempt, k, slice[k].template.id);
        const swap = hash % (k + 1);
        [slice[k], slice[swap]] = [slice[swap], slice[k]];
      }
      for (let k = 0; k < slice.length; k++) items[i + k] = slice[k];
    }
    i = j;
  }
}

/** Simple deterministic hash for tie-breaking seed. */
function hashSeed(attempt: number, index: number, id: string): number {
  let h = attempt * 2654435761 + index * 40503;
  for (let c = 0; c < id.length; c++) {
    h = ((h << 5) - h + id.charCodeAt(c)) | 0;
  }
  return Math.abs(h);
}

/**
 * Runs a single greedy scheduling attempt.
 *
 * Each call starts with fresh mutable state (generatedSessions, session counts,
 * rotation map, etc.) so attempts are independent.
 */
function runSingleAttempt(
  attempt: number,
  validTemplates: SessionTemplate[],
  placementMap: Map<string, TemplatePlacement>,
  instructors: Instructor[],
  calendar: SchoolCalendar[],
  rules: ProgramRule[],
  existing_sessions: Session[],
  venues: Venue[],
  program: { id: string; name: string; start_date: string; end_date: string; default_venue_id: string | null; allows_mixing: boolean },
  programId: string,
  rangeStartDate: string,
  rangeEndDate: string,
  bufferSettings: BufferSettings,
): AttemptResult {
  // Fresh state for this attempt
  const calendarMap = buildCalendarMap(calendar);
  const blackoutDays = buildBlackoutDaysSet(rules);
  const generatedSessions: DraftSession[] = [];
  const instructorSessionCounts = new Map<string, number>();

  // Seed counts from existing non-draft sessions
  for (const session of existing_sessions) {
    if (session.instructor_id) {
      const count = instructorSessionCounts.get(session.instructor_id) ?? 0;
      instructorSessionCounts.set(session.instructor_id, count + 1);
    }
  }

  const templateStats = new Map<string, TemplateStats>();
  const skippedDates: SkippedDate[] = [];
  const rotationMap = createRotationMap();
  let sessionsWithWarnings = 0;
  const unassignedReasons = new Map<string, number>();

  // Group templates by effective day_of_week (placement overrides template)
  // Templates with no day_of_week and no placement are scheduled on ALL weekdays (Mon-Fri)
  const templatesByDay = new Map<number, SessionTemplate[]>();
  for (const tmpl of validTemplates) {
    const placement = placementMap.get(tmpl.id);
    const effectiveDay = placement ? placement.day_index + 1 : tmpl.day_of_week;
    if (effectiveDay != null) {
      const group = templatesByDay.get(effectiveDay) ?? [];
      group.push(tmpl);
      templatesByDay.set(effectiveDay, group);
    } else {
      // No day assigned — schedule on all weekdays (1=Mon through 5=Fri)
      for (let d = 1; d <= 5; d++) {
        const group = templatesByDay.get(d) ?? [];
        group.push(tmpl);
        templatesByDay.set(d, group);
      }
    }
  }

  // Pre-compute per-template date ranges and session limits
  const templateDateRanges = new Map<string, { start: string; end: string; maxSessions?: number }>();
  const templateSessionsGenerated = new Map<string, number>();
  for (const tmpl of validTemplates) {
    const range = getTemplateDateRange(tmpl, rangeStartDate, rangeEndDate);
    templateDateRanges.set(tmpl.id, range);
    templateSessionsGenerated.set(tmpl.id, 0);
  }

  // Track next available time slot per day for auto-time-assignment
  const dayNextSlot = new Map<string, number>(); // "YYYY-MM-DD-dayOfWeek" -> minutes since midnight

  for (const [dayOfWeek, dayTemplates] of templatesByDay) {
    const dates = datesForDayOfWeek(rangeStartDate, rangeEndDate, dayOfWeek);

    // Sort templates by urgency (most constrained first)
    const templatesWithUrgency = dayTemplates.map(tmpl => ({
      template: tmpl,
      urgency: calculateTemplateUrgency(tmpl, instructors, rangeStartDate, rangeEndDate, blackoutDays)
    }));
    templatesWithUrgency.sort((a, b) => b.urgency - a.urgency);

    // Randomize tie-breaking for Monte Carlo diversity (attempt 0 = deterministic)
    if (attempt > 0) {
      shuffleTies(templatesWithUrgency, attempt);
    }

    const processTemplates = templatesWithUrgency.map(t => t.template);

    for (const targetDate of dates) {
      // --- Check recurring blackout rules ---
      if (blackoutDays.has(dayOfWeek)) {
        for (const tmpl of processTemplates) {
          skippedDates.push({
            date: targetDate,
            template_id: tmpl.id,
            reason: 'blackout_rule',
            detail: `Day ${dayIndexToName(dayOfWeek)} is a recurring blackout`,
          });
        }
        continue;
      }

      // --- Check school calendar for this date ---
      const calendarEntries = calendarMap.get(targetDate) ?? [];
      const noSchoolEntry = calendarEntries.find(
        (e) => e.status_type === 'no_school' && e.target_instructor_id === null
      );
      if (noSchoolEntry) {
        for (const tmpl of processTemplates) {
          skippedDates.push({
            date: targetDate,
            template_id: tmpl.id,
            reason: 'no_school',
            detail: noSchoolEntry.description ?? 'No school',
          });
        }
        continue;
      }

      const earlyDismissal = calendarEntries.find(
        (e) => e.status_type === 'early_dismissal' && e.target_instructor_id === null
      );

      // Two-pass: placed templates first, then unplaced
      const placedTemplates = processTemplates.filter(t => placementMap.has(t.id));
      const unplacedTemplates = processTemplates.filter(t => !placementMap.has(t.id));

      for (const tmpl of [...placedTemplates, ...unplacedTemplates]) {
        const placement = placementMap.get(tmpl.id);
        let startTime = placement ? hourToTime(placement.start_hour) : tmpl.start_time;
        let endTime = placement
          ? hourToTime(placement.start_hour + placement.duration_hours)
          : tmpl.end_time;
        const durationMinutes = placement
          ? Math.round(placement.duration_hours * 60)
          : (tmpl.duration_minutes ?? 45);

        // Auto-assign time for flexible templates (no start_time, no placement)
        if (!startTime && !placement) {
          const dayKey = `${targetDate}-${dayOfWeek}`;
          if (!dayNextSlot.has(dayKey)) {
            // Default start: 8:00 AM (or program hours if available)
            dayNextSlot.set(dayKey, 8 * 60);
          }
          const slotStart = dayNextSlot.get(dayKey)!;
          const slotEnd = slotStart + durationMinutes;
          // Don't schedule past 3:00 PM (900 minutes)
          if (slotEnd <= 15 * 60) {
            const sh = Math.floor(slotStart / 60);
            const sm = slotStart % 60;
            const eh = Math.floor(slotEnd / 60);
            const em = slotEnd % 60;
            startTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
            endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
            dayNextSlot.set(dayKey, slotEnd);
          } else {
            // No room left in the day
            skippedDates.push({
              date: targetDate,
              template_id: tmpl.id,
              reason: 'no_time_slot',
              detail: `No available time slot (day full after ${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')})`,
            });
            continue;
          }
        }

        const effectiveTmpl = placement
          ? {
              ...tmpl,
              start_time: startTime,
              end_time: endTime,
              duration_minutes: durationMinutes,
              venue_id: placement.venue_id ?? tmpl.venue_id
            }
          : { ...tmpl, start_time: startTime, end_time: endTime, duration_minutes: durationMinutes };

        if (!templateStats.has(tmpl.id)) {
          templateStats.set(tmpl.id, {
            template_id: tmpl.id,
            day_of_week: dayOfWeek,
            grade_groups: tmpl.grade_groups,
            sessions_generated: 0,
            sessions_unassigned: 0,
          });
        }
        const stats = templateStats.get(tmpl.id)!;

        // --- Scheduling mode: date range filter ---
        const tmplRange = templateDateRanges.get(tmpl.id);
        if (tmplRange) {
          if (targetDate < tmplRange.start || targetDate > tmplRange.end) {
            continue; // Outside this template's effective date range
          }
          // Session count limit check
          if (tmplRange.maxSessions != null) {
            const generated = templateSessionsGenerated.get(tmpl.id) ?? 0;
            if (generated >= tmplRange.maxSessions) {
              continue; // Already hit session count limit
            }
          }
        }

        // --- Multi-week cycle check ---
        if (
          tmpl.week_cycle_length != null &&
          tmpl.week_cycle_length >= 2 &&
          tmpl.week_in_cycle != null
        ) {
          const weekNum = weeksSinceStart(program.start_date, targetDate);
          if (weekNum % tmpl.week_cycle_length !== tmpl.week_in_cycle) {
            skippedDates.push({
              date: targetDate,
              template_id: tmpl.id,
              reason: 'week_cycle_skip',
              detail: `Week ${weekNum % tmpl.week_cycle_length + 1} of ${tmpl.week_cycle_length}-week cycle (active on week ${tmpl.week_in_cycle + 1})`,
            });
            continue;
          }
        }

        // --- Early dismissal check ---
        if (earlyDismissal && earlyDismissal.early_dismissal_time) {
          const dismissalMinutes = timeToMinutes(earlyDismissal.early_dismissal_time);
          const sessionStartMinutes = timeToMinutes(startTime);
          if (sessionStartMinutes >= dismissalMinutes) {
            skippedDates.push({
              date: targetDate,
              template_id: tmpl.id,
              reason: 'early_dismissal',
              detail: `Session starts at ${startTime}, dismissal at ${earlyDismissal.early_dismissal_time}`,
            });
            continue;
          }
        }

        // --- Resolve venue ---
        let venueId = effectiveTmpl.venue_id ?? program.default_venue_id;

        // --- Auto-assign venue when none specified ---
        // Deterministic per template: hash the template ID to pick a consistent
        // base venue index so the same template always lands in the same venue.
        if (!venueId && venues.length > 0) {
          let hash = 0;
          for (let i = 0; i < tmpl.id.length; i++) {
            hash = ((hash << 5) - hash + tmpl.id.charCodeAt(i)) | 0;
          }
          const baseIndex = ((hash % venues.length) + venues.length) % venues.length;

          for (let offset = 0; offset < venues.length; offset++) {
            const candidateVenue = venues[(baseIndex + offset) % venues.length];
            if (isVenueBlackoutDate(candidateVenue, targetDate)) continue;
            const sessionWindow = toTimeWindow(startTime, endTime);
            if (!availabilityCoversWindow(candidateVenue.availability_json, dayOfWeek, sessionWindow)) continue;
            venueId = candidateVenue.id;
            break;
          }
        }

        // Track whether venue was auto-assigned (not from template or program default)
        const venueAutoAssigned = !effectiveTmpl.venue_id && !program.default_venue_id && !!venueId;

        // --- Check venue availability ---
        if (venueId) {
          const venue = venues.find((v) => v.id === venueId);
          if (venue) {
            if (isVenueBlackoutDate(venue, targetDate)) {
              if (venueAutoAssigned) {
                venueId = null;
              } else {
                skippedDates.push({
                  date: targetDate,
                  template_id: tmpl.id,
                  reason: 'venue_blackout',
                  detail: `Venue "${venue.name}" is blacked out on ${targetDate}`,
                });
                continue;
              }
            }

            const sessionWindow = toTimeWindow(startTime, endTime);
            if (!availabilityCoversWindow(venue.availability_json, dayOfWeek, sessionWindow)) {
              if (venueAutoAssigned) {
                venueId = null;
              } else {
                skippedDates.push({
                  date: targetDate,
                  template_id: tmpl.id,
                  reason: 'venue_unavailable',
                  detail: `Venue "${venue.name} - ${venue.space_type}" not available at ${startTime}-${endTime}`,
                });
                continue;
              }
            }

            if (!program.allows_mixing) {
              const atCapacity = checkVenueCapacity(
                venue,
                targetDate,
                startTime,
                endTime,
                existing_sessions,
                generatedSessions,
                bufferSettings
              );
              if (atCapacity) {
                if (venueAutoAssigned) {
                  venueId = null;
                } else {
                  skippedDates.push({
                    date: targetDate,
                    template_id: tmpl.id,
                    reason: 'venue_at_capacity',
                    detail: `Venue "${venue.name}" at capacity (max ${venue.max_concurrent_bookings}) at ${startTime}-${endTime}`,
                  });
                  continue;
                }
              }
            }
          }
        }

        // --- Match instructor based on template_type ---
        let matchedInstructor: Instructor | null = null;
        let schedulingNotes: string | null = null;

        const autoCtx: AutoAssignContext = {
          instructors,
          date: targetDate,
          dayOfWeek,
          calendarEntries,
          existingSessions: existing_sessions,
          generatedSessions,
          sessionCounts: instructorSessionCounts,
          bufferSettings,
        };

        switch (tmpl.template_type) {
          case 'fully_defined': {
            if (tmpl.instructor_id) {
              const instructor = instructors.find((i) => i.id === tmpl.instructor_id);
              matchedInstructor = instructor ?? null;
              if (!instructor) {
                schedulingNotes = 'Assigned instructor not found or inactive';
              }
            } else {
              const result = findBestInstructor(
                instructors, effectiveTmpl, targetDate, dayOfWeek,
                calendarEntries, existing_sessions, generatedSessions,
                instructorSessionCounts, bufferSettings
              );
              matchedInstructor = result.instructor;
              schedulingNotes = result.scheduling_notes;
            }
            break;
          }

          case 'tagged_slot': {
            const result = findInstructorForTaggedSlot(effectiveTmpl, autoCtx, rotationMap);
            matchedInstructor = result.instructor;
            schedulingNotes = result.scheduling_notes;
            break;
          }

          case 'auto_assign': {
            const result = findInstructorForAutoAssign(effectiveTmpl, autoCtx, rotationMap);
            matchedInstructor = result.instructor;
            schedulingNotes = result.scheduling_notes;
            break;
          }

          case 'time_block': {
            const result = findInstructorForTimeBlock(effectiveTmpl, autoCtx, rotationMap);
            matchedInstructor = result.instructor;
            schedulingNotes = result.scheduling_notes;
            break;
          }

          default: {
            const result = findBestInstructor(
              instructors, effectiveTmpl, targetDate, dayOfWeek,
              calendarEntries, existing_sessions, generatedSessions,
              instructorSessionCounts, bufferSettings
            );
            matchedInstructor = result.instructor;
            schedulingNotes = result.scheduling_notes;
          }
        }

        // --- Create draft session ---
        const draft: DraftSession = {
          program_id: programId,
          template_id: tmpl.id,
          instructor_id: matchedInstructor?.id ?? null,
          venue_id: venueId,
          grade_groups: tmpl.template_type === 'time_block' && tmpl.grade_groups.length === 0
            ? []
            : tmpl.grade_groups,
          date: targetDate,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: durationMinutes,
          name: null,
          status: 'draft',
          is_makeup: false,
          replaces_session_id: null,
          needs_resolution: false,
          notes: null,
          scheduling_notes: schedulingNotes,
        };

        generatedSessions.push(draft);
        stats.sessions_generated++;

        // Track for session_count mode limits
        templateSessionsGenerated.set(tmpl.id, (templateSessionsGenerated.get(tmpl.id) ?? 0) + 1);

        if (schedulingNotes) {
          sessionsWithWarnings++;
        }

        if (matchedInstructor) {
          const count = instructorSessionCounts.get(matchedInstructor.id) ?? 0;
          instructorSessionCounts.set(matchedInstructor.id, count + 1);
        } else {
          stats.sessions_unassigned++;
          const reason = schedulingNotes ?? 'No instructor available (unknown reason)';
          if (!stats.unassigned_reason) {
            stats.unassigned_reason = reason;
            stats.required_skills = tmpl.required_skills ?? [];
          }
          unassignedReasons.set(reason, (unassignedReasons.get(reason) ?? 0) + 1);
        }
      }
    }
  }

  return {
    generatedSessions,
    skippedDates,
    templateStats,
    instructorSessionCounts,
    sessionsWithWarnings,
    unassignedReasons,
  };
}

/**
 * Scores an attempt result for comparison.
 * Primary: fewest unassigned sessions. Secondary: most generated sessions.
 * Returns [primary, secondary] where lower primary is better, higher secondary is better.
 */
function scoreAttempt(result: AttemptResult): { unassigned: number; generated: number } {
  let unassigned = 0;
  for (const stats of result.templateStats.values()) {
    unassigned += stats.sessions_unassigned;
  }
  return { unassigned, generated: result.generatedSessions.length };
}

/** Number of Monte Carlo scheduling attempts to run. */
const MONTE_CARLO_ATTEMPTS = 5;

// ============================================================
// Main entry point
// ============================================================

/**
 * Runs the Best Fit auto-scheduler for a program.
 *
 * @param supabase - Supabase client (must have service role privileges for writes)
 * @param input - Contains the program_id to schedule
 * @returns SchedulerResult with counts and diagnostics
 */
export async function runScheduler(
  supabase: SupabaseClient<Database>,
  input: SchedulerInput
): Promise<SchedulerResult> {
  const { program_id, year: yearOverride, preview = false } = input;

  // ----------------------------------------------------------
  // 1. Load all required data
  // ----------------------------------------------------------
  let data: SchedulerData;
  try {
    data = await loadSchedulerData(supabase, program_id);
  } catch (err) {
    return {
      success: false,
      sessions_created: 0,
      unassigned_count: 0,
      sessions_with_warnings: 0,
      drafts_cleared: 0,
      template_stats: [],
      skipped_dates: [],
      summary: '',
      error: err instanceof Error ? err.message : 'Failed to load scheduler data',
    };
  }

  const { program, templates, calendar, rules, instructors, existing_sessions, template_placements } = data;

  // Build placement map: template_id → placement (Schedule Builder overrides)
  const placementMap = new Map<string, TemplatePlacement>();
  for (const p of template_placements) {
    placementMap.set(p.template_id, p);
  }

  // Use program date range for session generation.
  // If a year override is provided, use Jan 1 – Dec 31 of that year instead.
  const rangeStartDate = yearOverride ? `${yearOverride}-01-01` : program.start_date;
  const rangeEndDate = yearOverride ? `${yearOverride}-12-31` : program.end_date;

  // ----------------------------------------------------------
  // 1b. Load global buffer time settings
  // ----------------------------------------------------------
  const bufferSettings = await loadBufferSettings(supabase);

  if (templates.length === 0) {
    return {
      success: false,
      sessions_created: 0,
      unassigned_count: 0,
      sessions_with_warnings: 0,
      drafts_cleared: 0,
      template_stats: [],
      skipped_dates: [],
      summary: 'No active templates found for this program.',
      error: 'No active templates found for this program.',
    };
  }

  // ----------------------------------------------------------
  // 1c. Filter out templates with invalid start/end times
  // ----------------------------------------------------------
  const validTemplates = templates.filter(hasValidTimes);
  const skippedTemplates = templates.filter((t) => !hasValidTimes(t));
  if (skippedTemplates.length > 0) {
    console.warn(
      '[scheduler] Skipped templates with invalid times:',
      skippedTemplates.map((t) => t.id)
    );
  }

  if (validTemplates.length === 0) {
    return {
      success: false,
      sessions_created: 0,
      unassigned_count: 0,
      sessions_with_warnings: 0,
      drafts_cleared: 0,
      template_stats: [],
      skipped_dates: [],
      summary: 'All active templates have invalid timing (missing both duration and start/end times).',
      error: 'All active templates have invalid timing (missing both duration and start/end times).',
    };
  }

  // ----------------------------------------------------------
  // 2. Clear existing draft sessions for this program
  //    (skipped in preview mode — no DB mutations)
  // ----------------------------------------------------------
  const draftsCleared = preview ? 0 : await clearDraftSessions(supabase, program_id);

  // ----------------------------------------------------------
  // 3. Run Monte Carlo attempts (greedy scheduler with randomized tie-breaking)
  // ----------------------------------------------------------
  let bestResult: AttemptResult | null = null;
  let bestScore = { unassigned: Infinity, generated: -1 };

  for (let attempt = 0; attempt < MONTE_CARLO_ATTEMPTS; attempt++) {
    const result = runSingleAttempt(
      attempt,
      validTemplates,
      placementMap,
      instructors,
      calendar,
      rules,
      existing_sessions,
      data.venues,
      program,
      program_id,
      rangeStartDate,
      rangeEndDate,
      bufferSettings,
    );

    const score = scoreAttempt(result);

    // Better = fewer unassigned; tie-break by more generated
    if (
      !bestResult ||
      score.unassigned < bestScore.unassigned ||
      (score.unassigned === bestScore.unassigned && score.generated > bestScore.generated)
    ) {
      bestResult = result;
      bestScore = score;
    }

    // Perfect score — no need to try more attempts
    if (score.unassigned === 0) break;
  }

  // bestResult is guaranteed non-null since MONTE_CARLO_ATTEMPTS >= 1
  const {
    generatedSessions,
    skippedDates,
    templateStats,
    sessionsWithWarnings,
    unassignedReasons,
  } = bestResult!;

  // ----------------------------------------------------------
  // 4. Batch insert generated sessions
  //    (skipped in preview mode — no DB mutations)
  // ----------------------------------------------------------
  if (generatedSessions.length > 0 && !preview) {
    const insertError = await insertSessions(supabase, generatedSessions);
    if (insertError) {
      return {
        success: false,
        sessions_created: 0,
        unassigned_count: 0,
        sessions_with_warnings: 0,
        drafts_cleared: draftsCleared,
        template_stats: Array.from(templateStats.values()),
        skipped_dates: skippedDates,
        summary: '',
        error: `Failed to insert sessions: ${insertError}`,
      };
    }
  }

  // ----------------------------------------------------------
  // 5. Build result
  // ----------------------------------------------------------
  const statsArray = Array.from(templateStats.values());
  const totalCreated = generatedSessions.length;
  const totalUnassigned = statsArray.reduce((sum, s) => sum + s.sessions_unassigned, 0);

  // Build preview statistics: byVenue and byWeek
  const byVenue: Record<string, number> = {};
  const byWeek: Record<string, number> = {};
  const venueNameMap = new Map(data.venues.map((v) => [v.id, v.name]));

  for (const draft of generatedSessions) {
    // byVenue: count by venue name
    const venueName = (draft.venue_id ? venueNameMap.get(draft.venue_id) : null) ?? 'Unassigned';
    byVenue[venueName] = (byVenue[venueName] ?? 0) + 1;

    // byWeek: count by Monday of the session's week
    const sessionDate = parseDate(draft.date);
    const dayOfWk = sessionDate.getDay();
    const monday = new Date(sessionDate);
    monday.setDate(monday.getDate() - ((dayOfWk + 6) % 7));
    const weekKey = formatDate(monday);
    byWeek[weekKey] = (byWeek[weekKey] ?? 0) + 1;
  }

  // Build skip reason breakdown for diagnostics
  const skipReasonCounts = new Map<string, number>();
  for (const skip of skippedDates) {
    const count = skipReasonCounts.get(skip.reason) ?? 0;
    skipReasonCounts.set(skip.reason, count + 1);
  }
  
  const skipBreakdown = Array.from(skipReasonCounts.entries())
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ');

  // Build weekly template count breakdown by day
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const templateDayCounts = new Map<number, number>(); // day_of_week -> count
  let placedCount = 0;
  for (const tmpl of validTemplates) {
    const placement = placementMap.get(tmpl.id);
    if (placement) placedCount++;
    const effectiveDay = placement ? placement.day_index + 1 : tmpl.day_of_week;
    if (effectiveDay != null) {
      templateDayCounts.set(effectiveDay, (templateDayCounts.get(effectiveDay) ?? 0) + 1);
    }
  }
  const unplacedCount = validTemplates.length - placedCount;
  const dayBreakdown = [1, 2, 3, 4, 5]
    .map((d) => `${dayNames[d - 1]}: ${templateDayCounts.get(d) ?? 0}`)
    .join(', ');
  const templateSummary = `Schedule Builder: ${dayBreakdown} = ${validTemplates.length} total weekly templates (${placedCount} placed, ${unplacedCount} unplaced).`;

  const summary = [
    templateSummary,
    `Generated ${totalCreated} draft session${totalCreated !== 1 ? 's' : ''} for "${program.name}".`,
    totalUnassigned > 0
      ? `${totalUnassigned} session${totalUnassigned !== 1 ? 's' : ''} left unassigned — needs manual instructor assignment.`
      : 'All sessions have assigned instructors.',
    sessionsWithWarnings > 0
      ? `${sessionsWithWarnings} session${sessionsWithWarnings !== 1 ? 's' : ''} flagged with scheduling warnings.`
      : '',
    draftsCleared > 0
      ? `Cleared ${draftsCleared} previous draft${draftsCleared !== 1 ? 's' : ''} before regeneration.`
      : '',
    skippedDates.length > 0
      ? `Skipped ${skippedDates.length} date/template combination${skippedDates.length !== 1 ? 's' : ''}: ${skipBreakdown}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  // ----------------------------------------------------------
  // 6. Generate scheduling mode warnings
  // ----------------------------------------------------------
  const scheduleWarnings: ScheduleWarning[] = [];
  for (const tmpl of validTemplates) {
    const mode = tmpl.scheduling_mode ?? 'ongoing';
    if (mode === 'session_count' && tmpl.session_count) {
      const stats = templateStats.get(tmpl.id);
      const created = stats?.sessions_generated ?? 0;
      if (created < tmpl.session_count) {
        const name = tmpl.name || (tmpl.required_skills ?? []).join(', ') || 'Untitled';
        scheduleWarnings.push({
          templateId: tmpl.id,
          templateName: name,
          type: 'session_count_not_met',
          message: `Only ${created} of ${tmpl.session_count} requested sessions could be created${tmpl.within_weeks ? ` within the ${tmpl.within_weeks}-week window` : ''}. Consider extending the time window or removing blackout days.`,
          details: { requested: tmpl.session_count, created },
        });
      }
    }
  }

  return {
    success: true,
    sessions_created: totalCreated,
    unassigned_count: totalUnassigned,
    unassigned_reasons: Object.fromEntries(unassignedReasons),
    sessions_with_warnings: sessionsWithWarnings,
    drafts_cleared: draftsCleared,
    template_stats: statsArray,
    skipped_dates: skippedDates,
    summary,
    byVenue,
    byWeek,
    schedule_warnings: scheduleWarnings.length > 0 ? scheduleWarnings : undefined,
  };
}

// ============================================================
// Data loading
// ============================================================

async function loadSchedulerData(
  supabase: SupabaseClient<Database>,
  programId: string
): Promise<SchedulerData> {
  // Fetch all data in parallel
  const [
    programRes,
    templatesRes,
    calendarRes,
    rulesRes,
    instructorsRes,
    venuesRes,
    existingRes,
    placementsRes,
  ] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase
      .from('session_templates')
      .select('*')
      .eq('program_id', programId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('sort_order'),
    supabase.from('school_calendar').select('*').eq('program_id', programId),
    supabase.from('program_rules').select('*').eq('program_id', programId).eq('is_active', true),
    supabase.from('instructors').select('*').eq('is_active', true),
    supabase.from('venues').select('*'),
    // Load existing non-draft sessions for conflict detection
    supabase
      .from('sessions')
      .select('*')
      .eq('program_id', programId)
      .in('status', ['published', 'completed']),
    // Load Schedule Builder placements (may not exist yet)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('template_placements') as any)
      .select('*')
      .eq('program_id', programId),
  ]);

  if (programRes.error) throw new Error(`Program not found: ${programRes.error.message}`);
  if (templatesRes.error) throw new Error(`Failed to load templates: ${templatesRes.error.message}`);
  if (calendarRes.error) throw new Error(`Failed to load calendar: ${calendarRes.error.message}`);
  if (rulesRes.error) throw new Error(`Failed to load rules: ${rulesRes.error.message}`);
  if (instructorsRes.error) throw new Error(`Failed to load instructors: ${instructorsRes.error.message}`);
  if (venuesRes.error) throw new Error(`Failed to load venues: ${venuesRes.error.message}`);
  if (existingRes.error) throw new Error(`Failed to load existing sessions: ${existingRes.error.message}`);
  // Placements are optional — table may not exist yet
  const placements: TemplatePlacement[] =
    placementsRes.error ? [] : (placementsRes.data ?? []);

  return {
    program: programRes.data,
    templates: templatesRes.data ?? [],
    calendar: calendarRes.data ?? [],
    rules: rulesRes.data ?? [],
    instructors: instructorsRes.data ?? [],
    venues: venuesRes.data ?? [],
    existing_sessions: existingRes.data ?? [],
    template_placements: placements,
  };
}

// ============================================================
// Buffer time settings
// ============================================================

interface BufferSettings {
  buffer_time_enabled: boolean;
  buffer_time_minutes: number;
}

/** Buffer settings that disable all buffer — used for venue auto-assignment
 *  so back-to-back sessions can share the same venue without artificial gaps. */
const NO_BUFFER: BufferSettings = { buffer_time_enabled: false, buffer_time_minutes: 0 };

async function loadBufferSettings(
  supabase: SupabaseClient<Database>
): Promise<BufferSettings> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('settings') as any)
      .select('buffer_time_enabled, buffer_time_minutes')
      .limit(1)
      .single();

    if (data) {
      return {
        buffer_time_enabled: data.buffer_time_enabled ?? false,
        buffer_time_minutes: data.buffer_time_minutes ?? 15,
      };
    }
  } catch {
    // Fall through to defaults
  }
  return { buffer_time_enabled: false, buffer_time_minutes: 15 };
}

// ============================================================
// Draft management
// ============================================================

/** Deletes all draft sessions for a program in small batches to avoid statement timeout. */
async function clearDraftSessions(
  supabase: SupabaseClient<Database>,
  programId: string
): Promise<number> {
  const BATCH = 200;
  let totalDeleted = 0;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: batch, error: fetchErr } = await (supabase.from('sessions') as any)
      .select('id')
      .eq('program_id', programId)
      .eq('status', 'draft')
      .range(0, BATCH - 1);

    if (fetchErr) {
      console.error('Failed to fetch draft session IDs:', fetchErr.message);
      break;
    }

    if (!batch || batch.length === 0) break;

    const ids = batch.map((s: { id: string }) => s.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (supabase.from('sessions') as any)
      .delete()
      .in('id', ids);

    if (delErr) {
      console.error('Failed to delete draft batch:', delErr.message);
      break;
    }

    totalDeleted += ids.length;
    if (ids.length < BATCH) break;
  }

  return totalDeleted;
}

/** Batch inserts sessions in chunks to avoid payload limits. */
async function insertSessions(
  supabase: SupabaseClient<Database>,
  sessions: DraftSession[]
): Promise<string | null> {
  const BATCH_SIZE = 500;

  for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
    const batch = sessions.slice(i, i + BATCH_SIZE);
    // Cast needed: Supabase client v2.97+ generic inference doesn't resolve
    // our re-exported SessionInsert through the Database type chain.
    // The shape is structurally identical to Database['public']['Tables']['sessions']['Insert'].
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any).insert(batch);
    if (error) {
      return `Batch insert failed at offset ${i}: ${(error as { message: string }).message}`;
    }
  }

  return null;
}

// ============================================================
// Venue conflict & capacity detection
// ============================================================

/**
 * Checks if a venue's blackout_dates array includes the target date.
 */
function isVenueBlackoutDate(venue: Venue, date: string): boolean {
  if (!venue.blackout_dates || venue.blackout_dates.length === 0) return false;
  return venue.blackout_dates.includes(date);
}

/**
 * Checks if a venue has reached its max_concurrent_bookings for a given
 * date/time window. Respects buffer_minutes by expanding the time window
 * used for overlap detection.
 *
 * Returns true if the venue is at capacity (booking should be blocked).
 */
function checkVenueCapacity(
  venue: Venue,
  date: string,
  startTime: string,
  endTime: string,
  existingSessions: Session[],
  generatedSessions: DraftSession[],
  bufferSettings: BufferSettings
): boolean {
  // Use the greater of venue-level buffer and global buffer (when enabled)
  const venueBuffer = venue.buffer_minutes ?? 0;
  const globalBuffer =
    bufferSettings.buffer_time_enabled ? bufferSettings.buffer_time_minutes : 0;
  const bufferMinutes = Math.max(venueBuffer, globalBuffer);
  const maxConcurrent = venue.max_concurrent_bookings ?? 1;

  // Expand the session window by buffer minutes on each side
  const rawWindow = toTimeWindow(startTime, endTime);
  const bufferedWindow: TimeWindow = {
    start_minutes: rawWindow.start_minutes - bufferMinutes,
    end_minutes: rawWindow.end_minutes + bufferMinutes,
  };

  let overlapCount = 0;

  // Count overlapping existing non-draft sessions
  for (const session of existingSessions) {
    if (
      session.venue_id === venue.id &&
      session.date === date &&
      session.status !== 'canceled'
    ) {
      const existingWindow = toTimeWindow(session.start_time, session.end_time);
      if (timeWindowsOverlap(bufferedWindow, existingWindow)) {
        overlapCount++;
      }
    }
  }

  // Count overlapping sessions generated in this run
  for (const draft of generatedSessions) {
    if (draft.venue_id === venue.id && draft.date === date) {
      const draftWindow = toTimeWindow(draft.start_time, draft.end_time);
      if (timeWindowsOverlap(bufferedWindow, draftWindow)) {
        overlapCount++;
      }
    }
  }

  return overlapCount >= maxConcurrent;
}

// ============================================================
// Instructor matching (Best Fit)
// ============================================================

/**
 * Finds the best instructor for a session slot.
 *
 * Selection criteria (in order):
 *  1. Has all required skills
 *  2. Available on this day/time (availability_json)
 *  3. Not already booked at this date/time
 *  4. Not blocked by an instructor_exception calendar entry
 *  5. Prefer instructor with fewest assigned sessions (load balancing)
 *
 * Returns null if no instructor matches (session will be "Unassigned").
 */
function findBestInstructor(
  instructors: Instructor[],
  template: SessionTemplate,
  date: string,
  dayOfWeek: number,
  calendarEntries: SchoolCalendar[],
  existingSessions: Session[],
  generatedSessions: DraftSession[],
  sessionCounts: Map<string, number>,
  bufferSettings: BufferSettings
): { instructor: Instructor | null; scheduling_notes: string | null } {
  const sessionWindow = toTimeWindow(template.start_time, template.end_time);
  const candidates: InstructorCandidate[] = [];

  // Track qualified instructors (have the right skills) and why they were rejected
  const qualifiedRejections: { name: string; reason: string }[] = [];
  let unqualifiedCount = 0;

  for (const instructor of instructors) {
    const name = `${instructor.first_name} ${instructor.last_name}`;

    // 1. Skills check
    if (!skillsMatch(instructor.skills, template.required_skills)) {
      unqualifiedCount++;
      continue;
    }

    // This instructor IS qualified — track why they can't be assigned

    // 2. Availability check — instructor's weekly availability must cover this time window
    if (!availabilityCoversWindow(instructor.availability_json, dayOfWeek, sessionWindow)) {
      qualifiedRejections.push({ name, reason: 'not available at this time' });
      continue;
    }

    // 3. Double-booking check — instructor can't be in two places at once
    if (isInstructorBooked(instructor.id, date, sessionWindow, existingSessions, generatedSessions, bufferSettings)) {
      // Find WHICH session is blocking them for better diagnostics
      const blockingSession = findBlockingSession(instructor.id, date, sessionWindow, existingSessions, generatedSessions);
      const blockingDetail = blockingSession
        ? `teaching ${blockingSession.grade_groups?.join('/') || 'class'} ${blockingSession.start_time.slice(0, 5)}-${blockingSession.end_time.slice(0, 5)}`
        : 'already booked';
      qualifiedRejections.push({ name, reason: blockingDetail });
      continue;
    }

    // 4. Instructor-specific calendar exception check
    const hasException = calendarEntries.some(
      (e) =>
        e.status_type === 'instructor_exception' &&
        e.target_instructor_id === instructor.id
    );
    if (hasException) {
      qualifiedRejections.push({ name, reason: 'calendar exception' });
      continue;
    }

    // All checks passed — this instructor is a candidate
    candidates.push({
      instructor,
      session_count: sessionCounts.get(instructor.id) ?? 0,
    });
  }

  if (candidates.length === 0) {
    const required = template.required_skills ?? [];
    const timeSlot = `${template.start_time?.slice(0, 5) ?? '?'}–${template.end_time?.slice(0, 5) ?? '?'}`;
    const day = dayIndexToName(dayOfWeek);

    if (qualifiedRejections.length === 0 && unqualifiedCount > 0) {
      // Nobody has the skill at all
      const notes = `No instructor with ${required.join(', ')} skills`;
      return { instructor: null, scheduling_notes: notes };
    }

    if (qualifiedRejections.length > 0) {
      // Qualified instructors exist but can't make it — this is the actionable info
      const byReason = new Map<string, string[]>();
      for (const r of qualifiedRejections) {
        const names = byReason.get(r.reason) ?? [];
        names.push(r.name);
        byReason.set(r.reason, names);
      }

      const parts: string[] = [];
      for (const [reason, names] of byReason) {
        parts.push(`${names.join(', ')} — ${reason}`);
      }

      const notes = `${qualifiedRejections.length} qualified instructor${qualifiedRejections.length > 1 ? 's' : ''} for ${required.join(', ')} can't teach ${day} ${timeSlot}: ${parts.join('; ')}`;
      return { instructor: null, scheduling_notes: notes };
    }

    return { instructor: null, scheduling_notes: 'No active instructors in the system' };
  }

  // 5. Load balancing — pick the candidate with the fewest sessions
  candidates.sort((a, b) => a.session_count - b.session_count);
  return { instructor: candidates[0].instructor, scheduling_notes: null };
}

/**
 * Checks if an instructor is already booked at a given date and overlapping time.
 * When buffer time is enabled, expands the session window by buffer_time_minutes
 * on each side to prevent back-to-back bookings.
 */
function isInstructorBooked(
  instructorId: string,
  date: string,
  sessionWindow: TimeWindow,
  existingSessions: Session[],
  generatedSessions: DraftSession[],
  bufferSettings: BufferSettings
): boolean {
  // Apply buffer time padding when enabled
  const bufferMinutes =
    bufferSettings.buffer_time_enabled ? bufferSettings.buffer_time_minutes : 0;
  const bufferedWindow: TimeWindow = {
    start_minutes: sessionWindow.start_minutes - bufferMinutes,
    end_minutes: sessionWindow.end_minutes + bufferMinutes,
  };

  // Check existing non-draft sessions
  for (const session of existingSessions) {
    if (
      session.instructor_id === instructorId &&
      session.date === date &&
      session.status !== 'canceled'
    ) {
      const existingWindow = toTimeWindow(session.start_time, session.end_time);
      if (timeWindowsOverlap(bufferedWindow, existingWindow)) {
        return true;
      }
    }
  }

  // Check sessions generated in this run
  for (const draft of generatedSessions) {
    if (draft.instructor_id === instructorId && draft.date === date) {
      const draftWindow = toTimeWindow(draft.start_time, draft.end_time);
      if (timeWindowsOverlap(bufferedWindow, draftWindow)) {
        return true;
      }
    }
  }

  return false;
}
