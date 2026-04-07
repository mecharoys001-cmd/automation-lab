/**
 * Regression tests for program duplication — copyResources()
 *
 * Bug: staff insert errors were silently swallowed because the returned
 * error was never checked, causing the route to return success with 0 staff.
 * Additionally, bio and start_year columns were not included in the select.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { copyResources, CopyOptions } from './copy-resources';

// ── Mock supabase client ─────────────────────────────────────────────

type Call = { table: string; method: string; args?: unknown[] };

let calls: Call[] = [];
let tableResults: Record<string, { selectData: unknown; selectError: unknown; insertData: unknown; insertError: unknown }> = {};

function setTableResult(
  table: string,
  opts: { selectData?: unknown; selectError?: unknown; insertData?: unknown; insertError?: unknown }
) {
  tableResults[table] = {
    selectData: opts.selectData ?? null,
    selectError: opts.selectError ?? null,
    insertData: opts.insertData ?? null,
    insertError: opts.insertError ?? null,
  };
}

function makeSupabase() {
  return {
    from(table: string) {
      calls.push({ table, method: 'from' });
      const t = tableResults[table] ?? { selectData: null, selectError: null, insertData: null, insertError: null };
      return {
        select(cols?: string) {
          calls.push({ table, method: 'select', args: [cols] });
          const result = { data: t.selectData, error: t.selectError };
          return {
            eq(_col: string, _val: string) {
              calls.push({ table, method: 'select.eq', args: [_col, _val] });
              const awaitable = {
                ...result,
                in(_col2: string, _vals: string[]) {
                  calls.push({ table, method: 'select.eq.in', args: [_col2, _vals] });
                  return Promise.resolve(result);
                },
                then: (res: (v: unknown) => void) => Promise.resolve(result).then(res),
              };
              return awaitable;
            },
          };
        },
        insert(rows: unknown) {
          calls.push({ table, method: 'insert', args: [rows] });
          const insertResult = { data: t.insertData, error: t.insertError };
          return {
            select(cols?: string) {
              calls.push({ table, method: 'insert.select', args: [cols] });
              return Promise.resolve(insertResult);
            },
          };
        },
      };
    },
  };
}

// ── Test data ────────────────────────────────────────────────────────

const sourceStaff = [
  {
    id: 'staff-1',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    phone: '555-1234',
    skills: ['math'],
    availability_json: null,
    is_active: true,
    on_call: false,
    notes: null,
    bio: 'Experienced teacher',
    start_year: 2020,
  },
  {
    id: 'staff-2',
    first_name: 'Bob',
    last_name: 'Jones',
    email: null,
    phone: null,
    skills: null,
    availability_json: null,
    is_active: true,
    on_call: false,
    notes: 'Part-time',
    bio: null,
    start_year: null,
  },
];

// ── Tests ────────────────────────────────────────────────────────────

describe('copyResources — staff duplication', () => {
  beforeEach(() => {
    calls = [];
    tableResults = {};
  });

  it('should throw when staff insert returns an error (not silently succeed)', async () => {
    setTableResult('staff', {
      selectData: sourceStaff,
      insertError: {
        message: 'trigger function "grant_scheduler_access_on_staff_add" failed',
        code: 'P0001',
      },
    });

    const opts: CopyOptions = {
      copy_staff: true,
      copy_venues: false,
      copy_tags: false,
      copy_templates: false,
    };

    await expect(
      copyResources(makeSupabase(), 'source-1', 'new-1', opts)
    ).rejects.toThrow('Failed to copy staff');
  });

  it('should include bio and start_year in the staff SELECT', async () => {
    setTableResult('staff', {
      selectData: sourceStaff,
      insertData: [{ id: 'new-staff-1' }, { id: 'new-staff-2' }],
    });

    const opts: CopyOptions = {
      copy_staff: true,
      copy_venues: false,
      copy_tags: false,
      copy_templates: false,
    };

    const result = await copyResources(makeSupabase(), 'source-1', 'new-1', opts);
    expect(result.counts.staff).toBe(2);

    // Verify the SELECT column list includes bio and start_year
    const staffSelect = calls.find((c) => c.table === 'staff' && c.method === 'select');
    expect(staffSelect).toBeDefined();
    const cols = staffSelect!.args![0] as string;
    expect(cols).toContain('bio');
    expect(cols).toContain('start_year');
  });

  it('should throw when staff fetch returns an error', async () => {
    setTableResult('staff', {
      selectError: { message: 'connection refused' },
    });

    const opts: CopyOptions = {
      copy_staff: true,
      copy_venues: false,
      copy_tags: false,
      copy_templates: false,
    };

    await expect(
      copyResources(makeSupabase(), 'source-1', 'new-1', opts)
    ).rejects.toThrow('Failed to fetch staff');
  });

  it('should succeed and return counts when staff copy works', async () => {
    setTableResult('staff', {
      selectData: sourceStaff,
      insertData: [{ id: 'new-staff-1' }, { id: 'new-staff-2' }],
    });

    const opts: CopyOptions = {
      copy_staff: true,
      copy_venues: false,
      copy_tags: false,
      copy_templates: false,
    };

    const result = await copyResources(makeSupabase(), 'source-1', 'new-1', opts);
    expect(result.counts.staff).toBe(2);
    expect(result.staffIdMap.get('staff-1')).toBe('new-staff-1');
    expect(result.staffIdMap.get('staff-2')).toBe('new-staff-2');
  });

  it('should propagate bio and start_year values in inserted rows', async () => {
    setTableResult('staff', {
      selectData: sourceStaff,
      insertData: [{ id: 'new-staff-1' }, { id: 'new-staff-2' }],
    });

    const opts: CopyOptions = {
      copy_staff: true,
      copy_venues: false,
      copy_tags: false,
      copy_templates: false,
    };

    await copyResources(makeSupabase(), 'source-1', 'new-1', opts);

    // Check the insert payload includes bio and start_year
    const insertCall = calls.find((c) => c.table === 'staff' && c.method === 'insert');
    expect(insertCall).toBeDefined();
    const rows = insertCall!.args![0] as Record<string, unknown>[];
    expect(rows[0]).toHaveProperty('bio', 'Experienced teacher');
    expect(rows[0]).toHaveProperty('start_year', 2020);
    expect(rows[1]).toHaveProperty('bio', null);
    expect(rows[1]).toHaveProperty('start_year', null);
    // old IDs should NOT be in the payload
    expect(rows[0]).not.toHaveProperty('id');
  });
});
