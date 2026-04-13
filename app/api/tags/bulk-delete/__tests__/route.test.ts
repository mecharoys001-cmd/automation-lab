import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Shared mock state ──────────────────────────────────────────────────────

let mockAdminUser: { id: string; email: string } | null = {
  id: 'admin-1',
  email: 'admin@example.com',
};
let mockAdminError: unknown = null;

const PROGRAM_ID = 'prog-1';

// Data that the mock supabase will return
let mockTagRows: { id: string; name: string; program_id: string }[] = [];
let mockSessionTagRows: { tag_id: string }[] = [];
let mockDeleteError: unknown = null;
let mockSessionTagDeleteError: unknown = null;

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
  requireMinRole: () => null,
  requireProgramAccess: async () => null,
}));

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === 'tags') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => ({
              eq: () =>
                Promise.resolve({
                  data: mockTagRows.filter((t) => ids.includes(t.id)),
                  error: null,
                }),
            }),
          }),
          delete: () => ({
            in: () => Promise.resolve({ error: mockDeleteError }),
          }),
        };
      }
      if (table === 'session_tags') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: mockSessionTagRows.filter((r) => ids.includes(r.tag_id)),
                error: null,
              }),
          }),
          delete: () => ({
            in: () => Promise.resolve({ error: mockSessionTagDeleteError }),
          }),
        };
      }
      // staff_tags / venue_tags — silently succeed
      return {
        delete: () => ({
          in: () => Promise.resolve({ error: null }),
        }),
      };
    },
  }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/tags/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/tags/bulk-delete', () => {
  beforeEach(() => {
    mockAdminUser = { id: 'admin-1', email: 'admin@example.com' };
    mockAdminError = null;
    mockDeleteError = null;
    mockSessionTagDeleteError = null;
    mockTagRows = [
      { id: 'tag-1', name: 'Piano', program_id: PROGRAM_ID },
      { id: 'tag-2', name: 'Strings', program_id: PROGRAM_ID },
      { id: 'tag-3', name: 'Brass', program_id: PROGRAM_ID },
    ];
    mockSessionTagRows = [];
  });

  it('rejects empty tag_ids', async () => {
    const res = await POST(makeRequest({ tag_ids: [], program_id: PROGRAM_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tag_ids/);
  });

  it('rejects missing program_id', async () => {
    const res = await POST(makeRequest({ tag_ids: ['tag-1'] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/program_id/);
  });

  it('returns 404 if some tags not found', async () => {
    const res = await POST(
      makeRequest({ tag_ids: ['tag-1', 'nonexistent'], program_id: PROGRAM_ID })
    );
    expect(res.status).toBe(404);
  });

  it('deletes unused tags successfully', async () => {
    const res = await POST(
      makeRequest({ tag_ids: ['tag-1', 'tag-2'], program_id: PROGRAM_ID })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(2);
    expect(body.removedFromSessions).toBe(0);
  });

  it('returns 409 when tags are in use and force is not set', async () => {
    mockSessionTagRows = [{ tag_id: 'tag-1' }, { tag_id: 'tag-1' }];
    const res = await POST(
      makeRequest({ tag_ids: ['tag-1', 'tag-2'], program_id: PROGRAM_ID })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.tagsInUse).toBe(1);
    expect(body.totalSessionLinks).toBe(2);
  });

  it('force deletes tags that are in use', async () => {
    mockSessionTagRows = [{ tag_id: 'tag-1' }, { tag_id: 'tag-1' }, { tag_id: 'tag-2' }];
    const res = await POST(
      makeRequest({ tag_ids: ['tag-1', 'tag-2'], program_id: PROGRAM_ID, force: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(2);
    expect(body.removedFromSessions).toBe(3);
  });

  it('rejects unauthenticated requests', async () => {
    mockAdminUser = null;
    mockAdminError = true;
    const res = await POST(
      makeRequest({ tag_ids: ['tag-1'], program_id: PROGRAM_ID })
    );
    expect(res.status).toBe(403);
  });
});
