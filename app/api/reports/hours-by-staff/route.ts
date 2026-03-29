/**
 * GET /api/reports/hours-by-staff
 *
 * Sum duration_minutes where status IN (completed, published),
 * grouped by staff member. Supports date range filters.
 *
 * Query params:
 *   - start_date (optional) YYYY-MM-DD
 *   - end_date   (optional) YYYY-MM-DD
 *   - program_id (optional) UUID
 *
 * Returns: { success, data: [{ staff_id, name, total_hours }] }
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
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const programId = searchParams.get('program_id');

    if (programId) {
      const accessErr = await requireProgramAccess(auth.user, programId);
      if (accessErr) return accessErr;
    }

    const supabase = createServiceClient();

    // Fetch sessions with staff relation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select(`
        duration_minutes,
        staff:staff (id, first_name, last_name)
      `)
      .in('status', ['completed', 'published'])
      .not('staff_id', 'is', null);

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

    // Aggregate by staff member
    const staffMinutes = new Map<string, { name: string; total: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (sessions ?? []) as any[]) {
      const member = s.staff as { id: string; first_name: string; last_name: string } | null;
      if (!member) continue;
      const existing = staffMinutes.get(member.id) ?? {
        name: `${member.first_name} ${member.last_name}`,
        total: 0,
      };
      existing.total += s.duration_minutes;
      staffMinutes.set(member.id, existing);
    }

    const data = Array.from(staffMinutes.entries())
      .map(([id, info]) => ({
        staff_id: id,
        name: info.name,
        total_hours: Math.round((info.total / 60) * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Reports hours-by-staff API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
