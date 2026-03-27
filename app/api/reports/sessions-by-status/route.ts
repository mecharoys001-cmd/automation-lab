/**
 * GET /api/reports/sessions-by-status
 *
 * Count sessions grouped by status.
 * Supports program_id and date range filters.
 *
 * Query params:
 *   - program_id  (optional) UUID
 *   - start_date  (optional) YYYY-MM-DD
 *   - end_date    (optional) YYYY-MM-DD
 *
 * Returns: { success, data: [{ status, count }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

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
    const programId = searchParams.get('program_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (programId) {
      const accessErr = await requireProgramAccess(auth.user, programId);
      if (accessErr) return accessErr;
    }

    const supabase = createServiceClient();

    // Fetch sessions with just status and id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select('status');

    if (programId) query = query.eq('program_id', programId);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data: sessions, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch sessions: ${error.message}` },
        { status: 500 }
      );
    }

    // Count by status
    const statusCounts = new Map<string, number>();
    for (const s of (sessions ?? []) as { status: string }[]) {
      statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
    }

    const data = Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Reports sessions-by-status API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
