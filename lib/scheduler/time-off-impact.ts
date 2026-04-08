/**
 * Staff Time Off Impact Calculator
 *
 * Computes how approved time off requests affect scheduled sessions
 * without automatically disqualifying staff from assignments.
 * Produces warning rows for the Exceptions Impact table in Schedule Preview.
 */

import type { StaffTimeOffRequest, TimeOffImpactWarning } from '@/types/staff-time-off';

// ── Public types for callers ────────────────────────────────────────────────

export interface ScheduledSession {
  date: string;        // YYYY-MM-DD
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  template_id: string;
  template_name: string;
  staff_id: string;
}

export interface StaffInfo {
  id: string;
  name: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function timesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) &&
         timeToMinutes(bStart) < timeToMinutes(aEnd);
}

function severity(pct: number): 'low' | 'medium' | 'high' {
  if (pct > 0.66) return 'high';
  if (pct > 0.33) return 'medium';
  return 'low';
}

// ── Core calculator ─────────────────────────────────────────────────────────

/**
 * Calculate the impact of approved time off on scheduled sessions.
 *
 * Only processes approved requests. Groups sessions by (staff, template)
 * and computes missed count / percentage per group.
 */
export function calculateTimeOffImpact(
  requests: StaffTimeOffRequest[],
  sessions: ScheduledSession[],
  staffList: StaffInfo[],
): TimeOffImpactWarning[] {
  // Only approved requests create impact
  const approved = requests.filter((r) => r.status === 'approved');
  if (approved.length === 0) return [];

  const staffMap = new Map(staffList.map((s) => [s.id, s.name]));
  const warnings: TimeOffImpactWarning[] = [];

  // Group sessions by staff + template
  const groups = new Map<string, ScheduledSession[]>();
  for (const s of sessions) {
    const key = `${s.staff_id}::${s.template_id}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }

  // For each approved request, check which session groups are affected
  for (const req of approved) {
    // Build per-group missed counts
    const affectedGroups = new Map<string, { missed: number; total: number; templateName: string; templateId: string }>();

    for (const [key, groupSessions] of groups) {
      const staffId = key.split('::')[0];
      if (staffId !== req.staff_id) continue;

      let missed = 0;
      for (const sess of groupSessions) {
        if (sessionOverlapsTimeOff(sess, req)) {
          missed++;
        }
      }

      if (missed > 0) {
        const templateId = groupSessions[0].template_id;
        const templateName = groupSessions[0].template_name;
        affectedGroups.set(key, {
          missed,
          total: groupSessions.length,
          templateName,
          templateId,
        });
      }
    }

    // Emit a warning for each affected group
    for (const [, group] of affectedGroups) {
      const pct = group.total > 0 ? group.missed / group.total : 0;
      warnings.push({
        staffName: staffMap.get(req.staff_id) ?? 'Unknown',
        staffId: req.staff_id,
        timeOffId: req.id,
        timeOffStart: req.start_date,
        timeOffEnd: req.end_date,
        timeOffType: req.request_type,
        templateId: group.templateId,
        templateName: group.templateName,
        missedSessions: group.missed,
        totalSessions: group.total,
        missedPercentage: pct,
        severity: severity(pct),
      });
    }
  }

  return warnings;
}

// ── Overlap detection ───────────────────────────────────────────────────────

function sessionOverlapsTimeOff(
  session: ScheduledSession,
  request: StaffTimeOffRequest,
): boolean {
  const sessDate = session.date;

  // Date must fall within the request's range
  if (sessDate < request.start_date || sessDate > request.end_date) {
    return false;
  }

  // For partial_day, also check time overlap
  if (request.request_type === 'partial_day' && request.start_time && request.end_time) {
    return timesOverlap(
      session.start_time, session.end_time,
      request.start_time, request.end_time,
    );
  }

  // full_day and multi_day: date overlap is sufficient
  return true;
}
