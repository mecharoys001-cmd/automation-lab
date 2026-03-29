/**
 * GET /api/reports/hours-by-instructor
 *
 * Sum duration_minutes where status IN (completed, published),
 * grouped by instructor. Supports date range filters.
 *
 * Query params:
 *   - start_date (optional) YYYY-MM-DD
 *   - end_date   (optional) YYYY-MM-DD
 *   - program_id (optional) UUID
 *
 * Returns: { success, data: [{ instructor_id, name, total_hours }] }
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

    // Fetch sessions with instructor relation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select(`
        duration_minutes,
        instructor:instructors (id, first_name, last_name)
      `)
      .in('status', ['completed', 'published'])
      .not('instructor_id', 'is', null);

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

    // Aggregate by instructor
    const instructorMinutes = new Map<string, { name: string; total: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (sessions ?? []) as any[]) {
      const inst = s.instructor as { id: string; first_name: string; last_name: string } | null;
      if (!inst) continue;
      const existing = instructorMinutes.get(inst.id) ?? {
        name: `${inst.first_name} ${inst.last_name}`,
        total: 0,
      };
      existing.total += s.duration_minutes;
      instructorMinutes.set(inst.id, existing);
    }

    const data = Array.from(instructorMinutes.entries())
      .map(([id, info]) => ({
        instructor_id: id,
        name: info.name,
        total_hours: Math.round((info.total / 60) * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Reports hours-by-instructor API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
