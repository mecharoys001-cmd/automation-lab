/**
 * GET /api/sessions/stats
 *
 * Returns session counts grouped by status for the stats panel.
 * Optionally filters by program_id.
 *
 * Query params:
 *   - program_id (optional): UUID to filter by program
 *
 * Response: { total, draft, published, canceled, completed, unassigned }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireAdmin, requireProgramAccess } from '@/lib/api-auth';

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

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (programId) {
      const accessErr = await requireProgramAccess(auth.user, programId);
      if (accessErr) return accessErr;
    }

    // Build base query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseQuery = (supabase.from('sessions') as any).select('id, status, instructor_id');
    if (programId) {
      baseQuery = baseQuery.eq('program_id', programId);
    }

    const { data, error } = await baseQuery;

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch session stats: ${error.message}` },
        { status: 500 }
      );
    }

    const sessions: { id: string; status: string; instructor_id: string | null }[] = data ?? [];

    const stats = {
      total: sessions.length,
      draft: sessions.filter((s) => s.status === 'draft').length,
      published: sessions.filter((s) => s.status === 'published').length,
      canceled: sessions.filter((s) => s.status === 'canceled').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      unassigned: sessions.filter((s) => s.instructor_id === null && s.status !== 'canceled').length,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error('Session stats API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
