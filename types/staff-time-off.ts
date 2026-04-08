/**
 * Staff Time Off — Domain Types
 *
 * Shared types for time off requests, admin review, and impact warnings.
 * Kept separate from the existing scheduler Exceptions conflict system.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type TimeOffRequestType = 'full_day' | 'partial_day' | 'multi_day';

export type TimeOffRequestStatus = 'pending' | 'approved' | 'denied';

// ── Core request ───────────────────────────────────────────────────────────

export interface StaffTimeOffRequest {
  id: string;
  program_id: string;
  staff_id: string;
  request_type: TimeOffRequestType;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  start_time: string | null;  // HH:MM (partial_day only)
  end_time: string | null;    // HH:MM (partial_day only)
  note: string;
  status: TimeOffRequestStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Enriched request (admin review with staff name) ────────────────────────

export interface TimeOffRequestWithStaff extends StaffTimeOffRequest {
  staff_first_name: string;
  staff_last_name: string;
}

// ── Impact warning (Schedule Preview) ──────────────────────────────────────

export interface TimeOffImpactWarning {
  staffName: string;
  staffId: string;
  timeOffId: string;
  timeOffStart: string;
  timeOffEnd: string;
  timeOffType: TimeOffRequestType;
  templateId: string;
  templateName: string;
  missedSessions: number;
  totalSessions: number;
  missedPercentage: number;
  severity: 'low' | 'medium' | 'high';
}
