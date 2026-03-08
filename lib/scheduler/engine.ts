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

/** Returns true if a template has valid, non-empty start and end times. */
function hasValidTimes(template: SessionTemplate): boolean {
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
      summary: 'All active templates have invalid start/end times.',
      error: 'All active templates have invalid start/end times.',
    };
  }

  // ----------------------------------------------------------
  // 2. Clear existing draft sessions for this program
  //    (skipped in preview mode — no DB mutations)
  // ----------------------------------------------------------
  const draftsCleared = preview ? 0 : await clearDraftSessions(supabase, program_id);

  // ----------------------------------------------------------
  // 3. Build lookup structures
  // ----------------------------------------------------------
  const calendarMap = buildCalendarMap(calendar);
  const blackoutDays = buildBlackoutDaysSet(rules);

  // Track sessions we're generating (for intra-run conflict detection)
  const generatedSessions: DraftSession[] = [];
  // Track instructor session counts for load balancing
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
  // Rotation state for auto-assignment (per template)
  const rotationMap = createRotationMap();
  // Counter for sessions with scheduling warnings
  let sessionsWithWarnings = 0;

  // ----------------------------------------------------------
  // 4. Generate sessions: iterate templates × dates
  // ----------------------------------------------------------

  // Group templates by effective day_of_week (placement overrides template)
  const templatesByDay = new Map<number, SessionTemplate[]>();
  for (const tmpl of validTemplates) {
    const placement = placementMap.get(tmpl.id);
    const effectiveDay = placement ? placement.day_index : tmpl.day_of_week;
    const group = templatesByDay.get(effectiveDay) ?? [];
    group.push(tmpl);
    templatesByDay.set(effectiveDay, group);
  }

  for (const [dayOfWeek, dayTemplates] of templatesByDay) {
    // Generate all dates for this day-of-week within the program date range
    const dates = datesForDayOfWeek(rangeStartDate, rangeEndDate, dayOfWeek);

    // Sort templates by sort_order for consistent processing
    dayTemplates.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    for (const targetDate of dates) {
      // --- Check recurring blackout rules ---
      if (blackoutDays.has(dayOfWeek)) {
        for (const tmpl of dayTemplates) {
          skippedDates.push({
            date: targetDate,
            template_id: tmpl.id,
            reason: 'blackout_rule',
            detail: `Day ${dayIndexToName(dayOfWeek)} is a recurring blackout`,
          });
        }
        continue; // Skip entire day
      }

      // --- Check school calendar for this date ---
      const calendarEntries = calendarMap.get(targetDate) ?? [];
      const noSchoolEntry = calendarEntries.find(
        (e) => e.status_type === 'no_school' && e.target_instructor_id === null
      );
      if (noSchoolEntry) {
        for (const tmpl of dayTemplates) {
          skippedDates.push({
            date: targetDate,
            template_id: tmpl.id,
            reason: 'no_school',
            detail: noSchoolEntry.description ?? 'No school',
          });
        }
        continue; // Skip entire day
      }

      // Find early dismissal entry (if any) for this date
      const earlyDismissal = calendarEntries.find(
        (e) => e.status_type === 'early_dismissal' && e.target_instructor_id === null
      );

      // --- Process each template for this date ---
      for (const tmpl of dayTemplates) {
        // --- Resolve effective times from Schedule Builder placement ---
        // When a placement exists, override the template's day/time so all
        // downstream logic (venue checks, instructor matching, draft creation)
        // uses the Schedule Builder values.
        const placement = placementMap.get(tmpl.id);
        const startTime = placement ? hourToTime(placement.start_hour) : tmpl.start_time;
        const endTime = placement
          ? hourToTime(placement.start_hour + placement.duration_hours)
          : tmpl.end_time;
        const durationMinutes = placement
          ? Math.round(placement.duration_hours * 60)
          : tmpl.duration_minutes;

        // Create an effective template with resolved times so auto-assign
        // functions see the correct values without modifying the original.
        const effectiveTmpl = placement
          ? {
              ...tmpl,
              start_time: startTime,
              end_time: endTime,
              duration_minutes: durationMinutes,
              venue_id: placement.venue_id ?? tmpl.venue_id
            }
          : tmpl;

        // Initialize template stats
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
        // Use effective template (which includes placement overrides) for venue resolution
        const venueId = effectiveTmpl.venue_id ?? program.default_venue_id;

        // --- Check venue availability ---
        if (venueId) {
          const venue = data.venues.find((v) => v.id === venueId);
          if (venue) {
            // Check venue blackout dates
            if (isVenueBlackoutDate(venue, targetDate)) {
              skippedDates.push({
                date: targetDate,
                template_id: tmpl.id,
                reason: 'venue_blackout',
                detail: `Venue "${venue.name}" is blacked out on ${targetDate}`,
              });
              continue;
            }

            const sessionWindow = toTimeWindow(startTime, endTime);
            if (!availabilityCoversWindow(venue.availability_json, dayOfWeek, sessionWindow)) {
              skippedDates.push({
                date: targetDate,
                template_id: tmpl.id,
                reason: 'venue_unavailable',
                detail: `Venue "${venue.name} - ${venue.space_type}" not available at ${startTime}-${endTime}`,
              });
              continue;
            }

            // Check venue capacity (respects buffer_minutes and max_concurrent_bookings)
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
            // Use the template's pre-assigned instructor
            if (tmpl.instructor_id) {
              const instructor = instructors.find((i) => i.id === tmpl.instructor_id);
              matchedInstructor = instructor ?? null;
              if (!instructor) {
                schedulingNotes = 'Assigned instructor not found or inactive';
              }
            } else {
              // Fallback to best-fit matching for legacy templates without instructor_id
              matchedInstructor = findBestInstructor(
                instructors,
                effectiveTmpl,
                targetDate,
                dayOfWeek,
                calendarEntries,
                existing_sessions,
                generatedSessions,
                instructorSessionCounts,
                bufferSettings
              );
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
            // Unknown template type — fall back to best-fit
            matchedInstructor = findBestInstructor(
              instructors,
              effectiveTmpl,
              targetDate,
              dayOfWeek,
              calendarEntries,
              existing_sessions,
              generatedSessions,
              instructorSessionCounts,
              bufferSettings
            );
          }
        }

        // --- Create draft session ---
        const draft: DraftSession = {
          program_id: program_id,
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
          status: 'draft',
          is_makeup: false,
          replaces_session_id: null,
          needs_resolution: false,
          notes: null,
          scheduling_notes: schedulingNotes,
        };

        generatedSessions.push(draft);
        stats.sessions_generated++;

        if (schedulingNotes) {
          sessionsWithWarnings++;
        }

        if (matchedInstructor) {
          // Update load-balancing count
          const count = instructorSessionCounts.get(matchedInstructor.id) ?? 0;
          instructorSessionCounts.set(matchedInstructor.id, count + 1);
        } else {
          stats.sessions_unassigned++;
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 5. Batch insert generated sessions
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
  // 6. Build result
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

  const summary = [
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
      ? `Skipped ${skippedDates.length} date/template combination${skippedDates.length !== 1 ? 's' : ''} (blackouts, early dismissals, conflicts).`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    success: true,
    sessions_created: totalCreated,
    unassigned_count: totalUnassigned,
    sessions_with_warnings: sessionsWithWarnings,
    drafts_cleared: draftsCleared,
    template_stats: statsArray,
    skipped_dates: skippedDates,
    summary,
    byVenue,
    byWeek,
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
  const BATCH = 2000;
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
): Instructor | null {
  const sessionWindow = toTimeWindow(template.start_time, template.end_time);
  const candidates: InstructorCandidate[] = [];
  const rejections: { name: string; reason: string }[] = [];

  for (const instructor of instructors) {
    const name = `${instructor.first_name} ${instructor.last_name}`;

    // 1. Skills check
    if (!skillsMatch(instructor.skills, template.required_skills)) {
      rejections.push({ name, reason: `skills [${(instructor.skills ?? []).join(', ')}] don't match required [${(template.required_skills ?? []).join(', ')}]` });
      continue;
    }

    // 2. Availability check — instructor's weekly availability must cover this time window
    if (!availabilityCoversWindow(instructor.availability_json, dayOfWeek, sessionWindow)) {
      rejections.push({ name, reason: `not available day=${dayOfWeek} time=${template.start_time ?? 'null'}-${template.end_time ?? 'null'}` });
      continue;
    }

    // 3. Double-booking check — instructor can't be in two places at once
    if (isInstructorBooked(instructor.id, date, sessionWindow, existingSessions, generatedSessions, bufferSettings)) {
      rejections.push({ name, reason: 'already booked' });
      continue;
    }

    // 4. Instructor-specific calendar exception check
    const hasException = calendarEntries.some(
      (e) =>
        e.status_type === 'instructor_exception' &&
        e.target_instructor_id === instructor.id
    );
    if (hasException) {
      rejections.push({ name, reason: 'calendar exception' });
      continue;
    }

    // All checks passed — this instructor is a candidate
    candidates.push({
      instructor,
      session_count: sessionCounts.get(instructor.id) ?? 0,
    });
  }

  if (candidates.length === 0) {
    console.log(
      `[scheduler] findBestInstructor FAILED — template requires [${(template.required_skills ?? []).join(', ')}] ` +
      `on ${date} (day ${dayOfWeek}) ${template.start_time ?? 'null'}-${template.end_time ?? 'null'}. ` +
      `Rejections: ${rejections.map(r => `${r.name}: ${r.reason}`).join('; ')}`
    );
    return null;
  }

  // 5. Load balancing — pick the candidate with the fewest sessions
  candidates.sort((a, b) => a.session_count - b.session_count);
  return candidates[0].instructor;
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
