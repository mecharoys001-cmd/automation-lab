/**
 * Symphonix Scheduler — Constraint Propagation Module
 *
 * Implements constraint satisfaction techniques to:
 *  - Pre-compute possible instructors for each session (domain calculation)
 *  - Propagate constraints to detect conflicts early (arc consistency)
 *  - Order sessions by constraint tightness (smallest domain first)
 *
 * This prevents greedy assignment from painting itself into corners by
 * detecting impossibilities before wasting assignments.
 */

import type {
  SessionTemplate,
  Instructor,
  Session,
  SchoolCalendar,
  TimeWindow,
} from './types';
import {
  toTimeWindow,
  timeWindowsOverlap,
  availabilityCoversWindow,
  skillsMatch,
} from './utils';

// ============================================================
// Types
// ============================================================

/**
 * A session slot that needs instructor assignment
 */
export interface SessionSlot {
  /** Unique ID for this slot (template_id + date + start_time) */
  id: string;
  template_id: string;
  date: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  required_skills: string[];
  grade_groups: string[];
}

/**
 * Domain: set of possible instructors for a session slot
 */
export type Domain = Set<string>; // instructor IDs

/**
 * Constraint propagation result
 */
export interface PropagationResult {
  /** Domains after propagation (session_id → instructor_ids) */
  domains: Map<string, Domain>;
  /** Sessions with empty domains (impossible to assign) */
  impossible: SessionSlot[];
  /** Sessions ordered by domain size (smallest first) */
  ordered: SessionSlot[];
}

// ============================================================
// Domain Calculation
// ============================================================

/**
 * Calculates initial domains for all session slots.
 * For each session, determines which instructors COULD teach it based on:
 *  - Skills
 *  - Availability
 *  - No existing conflicts
 */
export function calculateDomains(
  slots: SessionSlot[],
  instructors: Instructor[],
  existingSessions: Session[],
  calendarEntries: Map<string, SchoolCalendar[]>,
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number }
): Map<string, Domain> {
  const domains = new Map<string, Domain>();

  for (const slot of slots) {
    const possible = new Set<string>();
    const sessionWindow = toTimeWindow(slot.start_time, slot.end_time);

    for (const instructor of instructors) {
      if (!instructor.is_active) continue;

      // 1. Skills check
      if (!skillsMatch(instructor.skills, slot.required_skills)) {
        continue;
      }

      // 2. Availability check
      if (!availabilityCoversWindow(instructor.availability_json, slot.day_of_week, sessionWindow)) {
        continue;
      }

      // 3. Calendar exception check
      const dateCalendar = calendarEntries.get(slot.date) ?? [];
      const hasException = dateCalendar.some(
        (e) =>
          e.status_type === 'instructor_exception' &&
          e.target_instructor_id === instructor.id
      );
      if (hasException) continue;

      // 4. Existing session conflict check
      if (hasExistingConflict(instructor.id, slot.date, sessionWindow, existingSessions, bufferSettings)) {
        continue;
      }

      // Instructor is possible for this slot
      possible.add(instructor.id);
    }

    domains.set(slot.id, possible);
  }

  return domains;
}

/**
 * Checks if an instructor has an existing session that conflicts with this slot.
 */
function hasExistingConflict(
  instructorId: string,
  date: string,
  sessionWindow: TimeWindow,
  existingSessions: Session[],
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number }
): boolean {
  const bufferMinutes = bufferSettings.buffer_time_enabled ? bufferSettings.buffer_time_minutes : 0;
  const bufferedWindow: TimeWindow = {
    start_minutes: sessionWindow.start_minutes - bufferMinutes,
    end_minutes: sessionWindow.end_minutes + bufferMinutes,
  };

  for (const session of existingSessions) {
    if (session.instructor_id === instructorId && session.date === date && session.status !== 'canceled') {
      const existingWindow = toTimeWindow(session.start_time, session.end_time);
      if (timeWindowsOverlap(bufferedWindow, existingWindow)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================
// Arc Consistency (AC-3 Algorithm)
// ============================================================

/**
 * Applies arc consistency to reduce domains by propagating constraints.
 * 
 * Key insight: If instructor I can ONLY teach session S (domain size = 1),
 * then remove I from all other sessions' domains on the same date/time.
 * 
 * Repeat until no more reductions are possible.
 */
export function propagateConstraints(
  slots: SessionSlot[],
  domains: Map<string, Domain>,
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number }
): Map<string, Domain> {
  // Clone domains for mutation
  const workingDomains = new Map<string, Domain>();
  for (const [slotId, domain] of domains) {
    workingDomains.set(slotId, new Set(domain));
  }

  let changed = true;
  let iteration = 0;
  const maxIterations = 100; // Safety limit

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    // Find sessions with singleton domains (only one possible instructor)
    for (const slot of slots) {
      const domain = workingDomains.get(slot.id);
      if (!domain || domain.size !== 1) continue;

      const onlyInstructor = Array.from(domain)[0];
      const sessionWindow = toTimeWindow(slot.start_time, slot.end_time);

      // Remove this instructor from all conflicting sessions
      for (const otherSlot of slots) {
        if (otherSlot.id === slot.id) continue; // Skip self
        if (otherSlot.date !== slot.date) continue; // Different day - no conflict

        const otherWindow = toTimeWindow(otherSlot.start_time, otherSlot.end_time);
        if (sessionsConflict(sessionWindow, otherWindow, bufferSettings)) {
          const otherDomain = workingDomains.get(otherSlot.id);
          if (otherDomain && otherDomain.has(onlyInstructor)) {
            otherDomain.delete(onlyInstructor);
            changed = true;
          }
        }
      }
    }
  }

  console.log(`[constraint-propagation] Arc consistency converged in ${iteration} iterations`);

  return workingDomains;
}

/**
 * Checks if two session windows conflict (considering buffer time).
 */
function sessionsConflict(
  windowA: TimeWindow,
  windowB: TimeWindow,
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number }
): boolean {
  const bufferMinutes = bufferSettings.buffer_time_enabled ? bufferSettings.buffer_time_minutes : 0;
  const bufferedA: TimeWindow = {
    start_minutes: windowA.start_minutes - bufferMinutes,
    end_minutes: windowA.end_minutes + bufferMinutes,
  };

  return timeWindowsOverlap(bufferedA, windowB);
}

// ============================================================
// Session Ordering
// ============================================================

/**
 * Orders sessions by domain size (smallest first = most constrained).
 * Sessions with smaller domains should be assigned first to avoid dead ends.
 */
export function orderByDomainSize(
  slots: SessionSlot[],
  domains: Map<string, Domain>
): SessionSlot[] {
  return [...slots].sort((a, b) => {
    const domainA = domains.get(a.id) ?? new Set();
    const domainB = domains.get(b.id) ?? new Set();
    
    // Smallest domain first (most constrained)
    if (domainA.size !== domainB.size) {
      return domainA.size - domainB.size;
    }

    // Tie-breaker: earlier date first
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    // Tie-breaker: earlier time first
    return a.start_time.localeCompare(b.start_time);
  });
}

// ============================================================
// Public API
// ============================================================

/**
 * Main entry point: computes domains, propagates constraints, and orders sessions.
 * 
 * @param slots - Session slots that need instructor assignment
 * @param instructors - Available instructors
 * @param existingSessions - Already published/completed sessions
 * @param calendarEntries - School calendar by date
 * @param bufferSettings - Buffer time configuration
 * @returns Propagation result with domains and ordered sessions
 */
export function runConstraintPropagation(
  slots: SessionSlot[],
  instructors: Instructor[],
  existingSessions: Session[],
  calendarEntries: Map<string, SchoolCalendar[]>,
  bufferSettings: { buffer_time_enabled: boolean; buffer_time_minutes: number }
): PropagationResult {
  console.log(`[constraint-propagation] Analyzing ${slots.length} session slots...`);

  // Step 1: Calculate initial domains
  const initialDomains = calculateDomains(
    slots,
    instructors,
    existingSessions,
    calendarEntries,
    bufferSettings
  );

  // Step 2: Apply arc consistency
  const propagatedDomains = propagateConstraints(
    slots,
    initialDomains,
    bufferSettings
  );

  // Step 3: Identify impossible sessions (empty domains)
  const impossible: SessionSlot[] = [];
  for (const slot of slots) {
    const domain = propagatedDomains.get(slot.id);
    if (!domain || domain.size === 0) {
      impossible.push(slot);
    }
  }

  if (impossible.length > 0) {
    console.log(`[constraint-propagation] Found ${impossible.length} impossible sessions (no valid instructors)`);
  }

  // Step 4: Order sessions by domain size
  const ordered = orderByDomainSize(slots, propagatedDomains);

  // Log domain size distribution
  const domainSizes = slots.map(s => propagatedDomains.get(s.id)?.size ?? 0);
  const avgDomain = domainSizes.reduce((a, b) => a + b, 0) / domainSizes.length;
  const minDomain = Math.min(...domainSizes);
  const maxDomain = Math.max(...domainSizes);
  console.log(`[constraint-propagation] Domain sizes: avg=${avgDomain.toFixed(1)}, min=${minDomain}, max=${maxDomain}`);

  return {
    domains: propagatedDomains,
    impossible,
    ordered,
  };
}
