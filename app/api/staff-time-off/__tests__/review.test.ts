import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Shared mock state ──────────────────────────────────────────────────────

let mockAdminUser: { id: string; email: string; roleLevel: string } | null = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleLevel: 'master',
};
let mockAdminError: unknown = null;

let mockReviewRows: Record<string, unknown>[] = [];
let mockReviewError: unknown = null;
let mockUpdateResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockPendingCount = 0;

vi.mock('@/lib/api-auth', () => ({
  requireAdmin: async () => {
    if (mockAdminError || !mockAdminUser) {
      return {
        user: null,
        error: { status: 403, json: async () => ({ error: 'Forbidden' }) },
      };
    }
    return { user: mockAdminUser, error: null };
  },
  requireProgramAccess: async () => null,
}));

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === 'staff_time_off_requests') {
        return {
          select: (cols?: string) => {
            // Pending count query
            if (cols === 'id' || cols?.includes('count')) {
              return {
                eq: () => ({
                  eq: () => Promise.resolve({ count: mockPendingCount, error: null }),
                }),
              };
            }
            // Review list (with staff join)
            return {
              eq: (_col: string, _val: string) => ({
                order: () => Promise.resolve({ data: mockReviewRows, error: mockReviewError }),
              }),
            };
          },
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve(mockUpdateResult),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { NextRequest } from 'next/server';

// We import each route's handler separately
const reviewModule = await import('../../staff-time-off/review/route');
const pendingModule = await import('../../staff-time-off/pending/route');

function makeRequest(method: string, body?: unknown, query?: string): NextRequest {
  const base = method === 'GET' && query
    ? `http://localhost:3000/api/staff-time-off/review?${query}`
    : 'http://localhost:3000/api/staff-time-off/review';
  return new NextRequest(base, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makePendingRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/staff-time-off/pending?${query}`, { method: 'GET' });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/staff-time-off/review', () => {
  beforeEach(() => {
    mockAdminUser = { id: 'admin-1', email: 'admin@example.com', roleLevel: 'master' };
    mockAdminError = null;
    mockReviewRows = [
      { id: 'req-1', status: 'pending', staff_first_name: 'Alice', staff_last_name: 'Smith' },
      { id: 'req-2', status: 'approved', staff_first_name: 'Bob', staff_last_name: 'Jones' },
    ];
    mockReviewError = null;
  });

  it('returns pending and resolved requests for a program', async () => {
    const res = await reviewModule.GET(makeRequest('GET', undefined, 'program_id=prog-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(2);
  });

  it('rejects non-admin users', async () => {
    mockAdminUser = null;
    const res = await reviewModule.GET(makeRequest('GET', undefined, 'program_id=prog-1'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/staff-time-off/review', () => {
  beforeEach(() => {
    mockAdminUser = { id: 'admin-1', email: 'admin@example.com', roleLevel: 'master' };
    mockAdminError = null;
    mockUpdateResult = {
      data: { id: 'req-1', status: 'approved', reviewed_at: '2026-04-08T12:00:00Z', reviewed_by: 'admin-1' },
      error: null,
    };
  });

  it('approves a request', async () => {
    const res = await reviewModule.PATCH(makeRequest('PATCH', {
      id: 'req-1',
      status: 'approved',
      program_id: 'prog-1',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe('approved');
  });

  it('denies a request', async () => {
    mockUpdateResult = {
      data: { id: 'req-1', status: 'denied', reviewed_at: '2026-04-08T12:00:00Z' },
      error: null,
    };
    const res = await reviewModule.PATCH(makeRequest('PATCH', {
      id: 'req-1',
      status: 'denied',
      program_id: 'prog-1',
      review_note: 'Sorry, coverage needed.',
    }));
    expect(res.status).toBe(200);
  });

  it('rejects invalid status', async () => {
    const res = await reviewModule.PATCH(makeRequest('PATCH', {
      id: 'req-1',
      status: 'cancelled',
      program_id: 'prog-1',
    }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/staff-time-off/pending', () => {
  beforeEach(() => {
    mockAdminUser = { id: 'admin-1', email: 'admin@example.com', roleLevel: 'master' };
    mockAdminError = null;
    mockPendingCount = 3;
  });

  it('returns pending count for program', async () => {
    const res = await pendingModule.GET(makePendingRequest('program_id=prog-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(3);
  });
});
