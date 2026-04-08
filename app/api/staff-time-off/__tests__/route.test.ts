import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock modules before importing the route ────────────────────────────────

let mockUser: { email: string } | null = { email: 'alice@example.com' };
let mockStaffRows: Record<string, unknown>[] = [];
let mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockSelectResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
  }),
}));

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === 'staff') {
        return {
          select: () => ({
            ilike: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: mockStaffRows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'staff_time_off_requests') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve(mockInsertResult),
            }),
          }),
          select: () => ({
            eq: (_col: string, _val: string) => ({
              eq: () => ({
                order: () => Promise.resolve(mockSelectResult),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

// ── Import the route handlers after mocks ──────────────────────────────────

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown, query?: string): NextRequest {
  const url = `http://localhost:3000/api/staff-time-off${query ? `?${query}` : ''}`;
  if (method === 'GET') {
    return new NextRequest(url, { method });
  }
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const STAFF_ID = 'staff-111';
const PROGRAM_ID = 'prog-222';

const baseStaff = {
  id: STAFF_ID,
  first_name: 'Alice',
  last_name: 'Smith',
  email: 'alice@example.com',
  program_id: PROGRAM_ID,
  is_active: true,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/staff-time-off', () => {
  beforeEach(() => {
    mockUser = { email: 'alice@example.com' };
    mockStaffRows = [baseStaff];
    mockInsertResult = {
      data: { id: 'req-1', status: 'pending', ...baseStaff },
      error: null,
    };
  });

  it('creates a full_day request', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'full_day',
      start_date: '2026-05-01',
      note: 'Personal day',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.request).toBeDefined();
  });

  it('creates a partial_day request', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'partial_day',
      start_date: '2026-05-01',
      start_time: '09:00',
      end_time: '12:00',
      note: 'Dentist appointment',
    }));
    expect(res.status).toBe(201);
  });

  it('creates a multi_day request', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'multi_day',
      start_date: '2026-05-01',
      end_date: '2026-05-05',
      note: 'Vacation',
    }));
    expect(res.status).toBe(201);
  });

  it('returns 400 when partial_day missing times', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'partial_day',
      start_date: '2026-05-01',
      note: 'Missing times',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start_time.*end_time/i);
  });

  it('returns 400 when partial_day end_time <= start_time', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'partial_day',
      start_date: '2026-05-01',
      start_time: '14:00',
      end_time: '09:00',
      note: 'Bad times',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when multi_day end_date before start_date', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'multi_day',
      start_date: '2026-05-05',
      end_date: '2026-05-01',
      note: 'Bad range',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when note is empty', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'full_day',
      start_date: '2026-05-01',
      note: '',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest('POST', {
      request_type: 'full_day',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const res = await POST(makeRequest('POST', {
      request_type: 'full_day',
      start_date: '2026-05-01',
      note: 'Day off',
    }));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/staff-time-off', () => {
  beforeEach(() => {
    mockUser = { email: 'alice@example.com' };
    mockStaffRows = [baseStaff];
    mockSelectResult = {
      data: [
        { id: 'req-1', status: 'pending', submitted_at: '2026-05-01T10:00:00Z' },
        { id: 'req-2', status: 'approved', submitted_at: '2026-04-15T08:00:00Z' },
      ],
      error: null,
    };
  });

  it('returns own requests sorted newest first', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(2);
  });

  it('returns empty state', async () => {
    mockSelectResult = { data: [], error: null };
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(0);
  });

  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });
});
