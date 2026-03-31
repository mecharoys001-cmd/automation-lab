/**
 * GET /api/reports/hours-by-tag
 *
 * Join sessions -> session_tags -> tags.
 * Sum duration_minutes where status IN (completed, published),
 * grouped by program_id and tag_id.
 *
 * Query params:
 *   - start_date  (optional) YYYY-MM-DD
 *   - end_date    (optional) YYYY-MM-DD
 *   - program_id  (optional) UUID
 *
 * Returns: { success, data: [{ program_name, tag_name, total_hours }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireAdmin, requireMinRole, requireProgramAccess, getAccessibleProgramIds } from '@/lib/api-auth';

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const programId = searchParams.get('program_id');

    let accessibleProgramIds: string[] | null = null;
    if (programId) {
      const accessErr = await requireProgramAccess(auth.user, programId);
      if (accessErr) return accessErr;
    } else {
      accessibleProgramIds = await getAccessibleProgramIds(auth.user);
    }

    const supabase = createServiceClient();

    // Fetch sessions with program + tags relations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select(`
        duration_minutes,
        program_id,
        program:programs (id, name),
        session_tags (
          tag:tags (id, name)
        )
      `)
      .in('status', ['completed', 'published']);

    if (programId) query = query.eq('program_id', programId);
    else if (accessibleProgramIds !== null) query = query.in('program_id', accessibleProgramIds);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data: sessions, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch sessions: ${error.message}` },
        { status: 500 }
      );
    }

    // Aggregate by program_id + tag_id
    const key = (programId: string, tagId: string) => `${programId}::${tagId}`;
    const tagMinutes = new Map<string, { program_name: string; tag_name: string; total: number }>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (sessions ?? []) as any[]) {
      const program = s.program as { id: string; name: string } | null;
      const programName = program?.name ?? 'Unknown';
      const tags = (s.session_tags ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((st: any) => st.tag as { id: string; name: string } | null)
        .filter(Boolean) as { id: string; name: string }[];

      for (const tag of tags) {
        const k = key(s.program_id, tag.id);
        const existing = tagMinutes.get(k) ?? { program_name: programName, tag_name: tag.name, total: 0 };
        existing.total += s.duration_minutes;
        tagMinutes.set(k, existing);
      }
    }

    const data = Array.from(tagMinutes.values())
      .map((info) => ({
        program_name: info.program_name,
        tag_name: info.tag_name,
        total_hours: Math.round((info.total / 60) * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Reports hours-by-tag API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
