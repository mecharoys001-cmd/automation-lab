import { describe, it, expect } from 'vitest';
import { calculateTimeOffImpact } from '../time-off-impact';
import type { StaffTimeOffRequest } from '@/types/staff-time-off';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<StaffTimeOffRequest> = {}): StaffTimeOffRequest {
  return {
    id: 'req-1',
    program_id: 'prog-1',
    staff_id: 'staff-1',
    request_type: 'full_day',
    start_date: '2026-05-01',
    end_date: '2026-05-01',
    start_time: null,
    end_time: null,
    note: 'Day off',
    status: 'approved',
    submitted_at: '2026-04-01T00:00:00Z',
    reviewed_at: '2026-04-02T00:00:00Z',
    reviewed_by: 'admin-1',
    review_note: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-02T00:00:00Z',
    ...overrides,
  };
}

interface StaffInfo {
  id: string;
  name: string;
}

interface ScheduledSession {
  date: string;
  start_time: string;
  end_time: string;
  template_id: string;
  template_name: string;
  staff_id: string;
}

// A staff member assigned to a weekly template with 4 sessions in May
const STAFF: StaffInfo = { id: 'staff-1', name: 'Alice Smith' };

const MAY_SESSIONS: ScheduledSession[] = [
  { date: '2026-05-01', start_time: '09:00', end_time: '10:00', template_id: 'tpl-1', template_name: 'Piano Mon', staff_id: 'staff-1' },
  { date: '2026-05-08', start_time: '09:00', end_time: '10:00', template_id: 'tpl-1', template_name: 'Piano Mon', staff_id: 'staff-1' },
  { date: '2026-05-15', start_time: '09:00', end_time: '10:00', template_id: 'tpl-1', template_name: 'Piano Mon', staff_id: 'staff-1' },
  { date: '2026-05-22', start_time: '09:00', end_time: '10:00', template_id: 'tpl-1', template_name: 'Piano Mon', staff_id: 'staff-1' },
];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('calculateTimeOffImpact', () => {
  it('detects a full-day overlap with one session', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({ start_date: '2026-05-01', end_date: '2026-05-01' })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(result).toHaveLength(1);
    expect(result[0].missedSessions).toBe(1);
    expect(result[0].totalSessions).toBe(4);
    expect(result[0].missedPercentage).toBeCloseTo(0.25);
    expect(result[0].severity).toBe('low');
  });

  it('returns no warnings when time off does not overlap any sessions', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({ start_date: '2026-06-01', end_date: '2026-06-01' })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(result).toHaveLength(0);
  });

  it('ignores denied requests', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({ status: 'denied' })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(result).toHaveLength(0);
  });

  it('ignores pending requests', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({ status: 'pending' })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(result).toHaveLength(0);
  });

  it('handles multi-day overlap covering multiple sessions', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({
        request_type: 'multi_day',
        start_date: '2026-05-01',
        end_date: '2026-05-15',
      })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(result).toHaveLength(1);
    expect(result[0].missedSessions).toBe(3); // May 1, 8, 15
    expect(result[0].totalSessions).toBe(4);
    expect(result[0].missedPercentage).toBeCloseTo(0.75);
    expect(result[0].severity).toBe('high');
  });

  it('handles partial-day overlap', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({
        request_type: 'partial_day',
        start_date: '2026-05-01',
        end_date: '2026-05-01',
        start_time: '09:00',
        end_time: '09:30',
      })],
      MAY_SESSIONS,
      [STAFF],
    );
    // Session 09:00-10:00 overlaps with time off 09:00-09:30
    expect(result).toHaveLength(1);
    expect(result[0].missedSessions).toBe(1);
  });

  it('partial-day does not overlap when times do not intersect', () => {
    const result = calculateTimeOffImpact(
      [makeRequest({
        request_type: 'partial_day',
        start_date: '2026-05-01',
        end_date: '2026-05-01',
        start_time: '14:00',
        end_time: '15:00',
      })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(result).toHaveLength(0);
  });

  it('assigns correct severity levels', () => {
    // Low: < 33%
    const low = calculateTimeOffImpact(
      [makeRequest({ start_date: '2026-05-01', end_date: '2026-05-01' })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(low[0].severity).toBe('low');

    // Medium: 33-66%
    const medium = calculateTimeOffImpact(
      [makeRequest({
        request_type: 'multi_day',
        start_date: '2026-05-01',
        end_date: '2026-05-08',
      })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(medium[0].severity).toBe('medium');

    // High: > 66%
    const high = calculateTimeOffImpact(
      [makeRequest({
        request_type: 'multi_day',
        start_date: '2026-05-01',
        end_date: '2026-05-22',
      })],
      MAY_SESSIONS,
      [STAFF],
    );
    expect(high[0].severity).toBe('high');
  });
});
