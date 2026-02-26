/**
 * Symphonix Scheduler — Auto-Assignment Module
 *
 * Handles instructor assignment for non-fully-defined template types:
 *   - tagged_slot:  skill matching + availability + rotation
 *   - auto_assign:  availability + load balancing + rotation
 *   - time_block:   same as auto_assign (grade_groups may be empty)
 *
 * Rotation modes:
 *   - consistent: same instructor for all sessions from this template
 *   - rotate:     cycle through qualified instructors week by week
 */

import type {
  Instructor,
  SessionTemplate,
  Session,
  SchoolCalendar,
  TimeWindow,
  InstructorCandidate,
} from './types';
import type { DraftSession } from './types';
import {
  toTimeWindow,
  timeWindowsOverlap,
  availabilityCoversWindow,
  skillsMatch,
} from './utils';

// ============================================================
// Types
// ============================================================

/** Context needed for instructor auto-assignment */
export interface AutoAssignContext {
  instructors: Instructor[];
  date: string;
  dayOfWeek: number;
  calendarEntries: SchoolCalendar[];
  existingSessions: Session[];
  generatedSessions: DraftSession[];
  sessionCounts: Map<string, number>;
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number };
}

/** Result of an auto-assignment attempt */
export interface AutoAssignResult {
  instructor: Instructor | null;
  /** Warning message when no instructor could be assigned */
  scheduling_notes: string | null;
}

// ============================================================
// Rotation state
// ============================================================

/**
 * Tracks rotation state per template.
 * For 'consistent' mode: stores the locked-in instructor id.
 * For 'rotate' mode: stores the current index into the qualified list.
 */
export interface RotationState {
  /** Instructor locked for 'consistent' mode (null if not yet determined) */
  consistent_instructor_id: string | null;
  /** Current rotation index for 'rotate' mode */
  rotate_index: number;
  /** Ordered list of qualified instructor IDs for rotation */
  qualified_ids: string[];
}

/** Creates a fresh rotation state map */
export function createRotationMap(): Map<string, RotationState> {
  return new Map();
}

// ============================================================
// Partial skill matching
// ============================================================

/**
 * Case-insensitive partial match for skills.
 * An instructor skill "Percussion" matches a required skill tag "Percussion Sessions".
 * Each required skill must be partially matched by at least one instructor skill.
 *
 * @param instructorSkills - The instructor's listed skills
 * @param requiredSkills - Skills required by the template
 * @returns true if every required skill has a partial match
 */
export function skillsMatchPartial(
  instructorSkills: string[] | null,
  requiredSkills: string[] | null
): boolean {
  if (!requiredSkills || requiredSkills.length === 0) return true;
  if (!instructorSkills || instructorSkills.length === 0) return false;

  const lowerInstructorSkills = instructorSkills.map((s) => s.toLowerCase());
  return requiredSkills.every((required) => {
    const lowerRequired = required.toLowerCase();
    return lowerInstructorSkills.some(
      (skill) => lowerRequired.includes(skill) || skill.includes(lowerRequired)
    );
  });
}

// ============================================================
// Core filtering
// ============================================================

/**
 * Filters instructors by active status, availability, and double-booking.
 * Shared logic used by all auto-assignment functions.
 */
function filterAvailableInstructors(
  instructors: Instructor[],
  template: SessionTemplate,
  ctx: AutoAssignContext
): InstructorCandidate[] {
  const sessionWindow = toTimeWindow(template.start_time, template.end_time);
  const candidates: InstructorCandidate[] = [];

  for (const instructor of instructors) {
    if (!instructor.is_active) continue;

    // Availability check
    if (!availabilityCoversWindow(instructor.availability_json, ctx.dayOfWeek, sessionWindow)) {
      continue;
    }

    // Double-booking check
    if (isInstructorBooked(instructor.id, ctx.date, sessionWindow, ctx.existingSessions, ctx.generatedSessions, ctx.bufferSettings)) {
      continue;
    }

    // Instructor-specific calendar exception
    const hasException = ctx.calendarEntries.some(
      (e) =>
        e.status_type === 'instructor_exception' &&
        e.target_instructor_id === instructor.id
    );
    if (hasException) continue;

    candidates.push({
      instructor,
      session_count: ctx.sessionCounts.get(instructor.id) ?? 0,
    });
  }

  return candidates;
}

/**
 * Checks if an instructor is already booked at a given date and overlapping time.
 * Respects buffer time settings.
 */
function isInstructorBooked(
  instructorId: string,
  date: string,
  sessionWindow: TimeWindow,
  existingSessions: Session[],
  generatedSessions: DraftSession[],
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number }
): boolean {
  const bufferMinutes = bufferSettings.buffer_time_enabled ? bufferSettings.buffer_time_minutes : 0;
  const bufferedWindow: TimeWindow = {
    start_minutes: sessionWindow.start_minutes - bufferMinutes,
    end_minutes: sessionWindow.end_minutes + bufferMinutes,
  };

  for (const session of existingSessions) {
    if (
      session.instructor_id === instructorId &&
      session.date === date &&
      session.status !== 'canceled'
    ) {
      const existingWindow = toTimeWindow(session.start_time, session.end_time);
      if (timeWindowsOverlap(bufferedWindow, existingWindow)) return true;
    }
  }

  for (const draft of generatedSessions) {
    if (draft.instructor_id === instructorId && draft.date === date) {
      const draftWindow = toTimeWindow(draft.start_time, draft.end_time);
      if (timeWindowsOverlap(bufferedWindow, draftWindow)) return true;
    }
  }

  return false;
}

// ============================================================
// Selection with rotation
// ============================================================

/**
 * Selects an instructor from candidates, respecting the template's rotation mode.
 *
 * @param candidates - Pre-filtered instructor candidates
 * @param template - The session template (for rotation_mode)
 * @param rotationMap - Mutable rotation state map
 * @returns The selected instructor, or null if no candidates
 */
function selectWithRotation(
  candidates: InstructorCandidate[],
  template: SessionTemplate,
  rotationMap: Map<string, RotationState>
): Instructor | null {
  if (candidates.length === 0) return null;

  let state = rotationMap.get(template.id);

  if (template.rotation_mode === 'consistent') {
    // Consistent mode: lock to the same instructor for all sessions from this template
    if (state?.consistent_instructor_id) {
      const locked = candidates.find((c) => c.instructor.id === state!.consistent_instructor_id);
      if (locked) return locked.instructor;
      // Locked instructor unavailable for this slot — fall through to pick best available
    }

    // Pick by load balancing (fewest sessions)
    candidates.sort((a, b) => a.session_count - b.session_count);
    const selected = candidates[0].instructor;

    // Lock this instructor for future slots from this template
    rotationMap.set(template.id, {
      consistent_instructor_id: selected.id,
      rotate_index: 0,
      qualified_ids: candidates.map((c) => c.instructor.id),
    });

    return selected;
  }

  // Rotate mode: cycle through qualified instructors
  if (!state) {
    // Sort by session count initially for fair starting order
    candidates.sort((a, b) => a.session_count - b.session_count);
    state = {
      consistent_instructor_id: null,
      rotate_index: 0,
      qualified_ids: candidates.map((c) => c.instructor.id),
    };
    rotationMap.set(template.id, state);
  }

  // Try to pick the next instructor in the rotation order
  const { qualified_ids } = state;
  for (let i = 0; i < qualified_ids.length; i++) {
    const idx = (state.rotate_index + i) % qualified_ids.length;
    const targetId = qualified_ids[idx];
    const match = candidates.find((c) => c.instructor.id === targetId);
    if (match) {
      // Advance rotation index for next call
      state.rotate_index = (idx + 1) % qualified_ids.length;
      return match.instructor;
    }
  }

  // All rotation candidates unavailable — pick best available by load
  candidates.sort((a, b) => a.session_count - b.session_count);
  return candidates[0].instructor;
}

// ============================================================
// Public API — Template-type-specific finders
// ============================================================

/**
 * Finds an instructor for a tagged_slot template.
 * Uses partial skill matching against the template's required_skills,
 * then filters by availability and applies rotation logic.
 *
 * @param template - The session template with required_skills
 * @param ctx - Auto-assignment context (instructors, date, etc.)
 * @param rotationMap - Mutable rotation state map
 * @returns Assignment result with instructor or warning
 */
export function findInstructorForTaggedSlot(
  template: SessionTemplate,
  ctx: AutoAssignContext,
  rotationMap: Map<string, RotationState>
): AutoAssignResult {
  // Filter by partial skill match first
  const skillFiltered = ctx.instructors.filter((i) =>
    skillsMatchPartial(i.skills, template.required_skills)
  );

  if (skillFiltered.length === 0) {
    return {
      instructor: null,
      scheduling_notes: `No instructor with matching skills (${(template.required_skills ?? []).join(', ')}) found`,
    };
  }

  // Then apply availability + booking filters
  const candidates = filterAvailableInstructors(
    skillFiltered,
    template,
    ctx
  );

  const selected = selectWithRotation(candidates, template, rotationMap);

  if (!selected) {
    return {
      instructor: null,
      scheduling_notes: `No available instructor with skills (${(template.required_skills ?? []).join(', ')}) on this date`,
    };
  }

  return { instructor: selected, scheduling_notes: null };
}

/**
 * Finds an instructor for an auto_assign template.
 * Uses availability + load balancing + rotation (no skill filtering).
 *
 * @param template - The session template
 * @param ctx - Auto-assignment context
 * @param rotationMap - Mutable rotation state map
 * @returns Assignment result with instructor or warning
 */
export function findInstructorForAutoAssign(
  template: SessionTemplate,
  ctx: AutoAssignContext,
  rotationMap: Map<string, RotationState>
): AutoAssignResult {
  const candidates = filterAvailableInstructors(
    ctx.instructors,
    template,
    ctx
  );

  const selected = selectWithRotation(candidates, template, rotationMap);

  if (!selected) {
    return {
      instructor: null,
      scheduling_notes: 'No available instructor for auto-assignment on this date',
    };
  }

  return { instructor: selected, scheduling_notes: null };
}

/**
 * Finds an instructor for a time_block template.
 * Same logic as auto_assign — availability + load balancing + rotation.
 * Time blocks may have empty grade_groups (handled by the engine).
 *
 * @param template - The session template
 * @param ctx - Auto-assignment context
 * @param rotationMap - Mutable rotation state map
 * @returns Assignment result with instructor or warning
 */
export function findInstructorForTimeBlock(
  template: SessionTemplate,
  ctx: AutoAssignContext,
  rotationMap: Map<string, RotationState>
): AutoAssignResult {
  return findInstructorForAutoAssign(template, ctx, rotationMap);
}
