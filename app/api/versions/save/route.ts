/**
 * POST /api/versions/save?year=YYYY
 *
 * Create a new schedule version snapshot for the given year.
 * Auto-rotates through slots 1–5 (oldest gets overwritten).
 *
 * Body (optional):
 *   { status?: "draft" | "published" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { ScheduleSnapshot } from '@/types/database';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (!yearParam || isNaN(Number(yearParam))) {
      return NextResponse.json(
        { error: 'year query parameter is required (e.g. ?year=2026)' },
        { status: 400 }
      );
    }

    const year = Number(yearParam);
    const programId = searchParams.get('program_id');

    if (programId) {
      const accessErr = await requireProgramAccess(auth.user, programId);
      if (accessErr) return accessErr;
    }

    // Parse optional status from body
    let status: 'draft' | 'published' = 'draft';
    try {
      const body = await request.json();
      if (body.status === 'published') status = 'published';
    } catch {
      // No body or invalid JSON — default to draft
    }

    // ── Build snapshot ───────────────────────────────────────
    const snapshot = await buildSnapshot(supabase, year, programId);

    // ── Determine next version slot (1-5 rotation) ───────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('schedule_versions') as any)
      .select('version_number, created_at')
      .eq('year', year)
      .order('version_number', { ascending: true });

    const usedSlots: number[] = (existing ?? []).map(
      (v: { version_number: number }) => v.version_number
    );

    const allowOverwrite = searchParams.get('allow_overwrite') === 'true';

    let nextSlot: number;
    if (usedSlots.length < 5) {
      // Find first unused slot 1-5
      nextSlot = [1, 2, 3, 4, 5].find((n) => !usedSlots.includes(n)) ?? 1;
    } else if (!allowOverwrite) {
      // All 5 slots used and overwrite not explicitly allowed
      const sorted = [...(existing ?? [])].sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      return NextResponse.json(
        {
          error: `All 5 version slots for ${year} are full. The oldest version (v${sorted[0].version_number}) would be overwritten.`,
          code: 'SLOTS_FULL',
          oldest_version_number: sorted[0].version_number,
        },
        { status: 409 }
      );
    } else {
      // All 5 slots used — overwrite the oldest (explicitly allowed)
      const sorted = [...(existing ?? [])].sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      nextSlot = sorted[0].version_number;
    }

    // ── UPSERT into the slot ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: version, error } = await (supabase.from('schedule_versions') as any)
      .upsert(
        {
          year,
          version_number: nextSlot,
          snapshot,
          status,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'year,version_number' }
      )
      .select('id, year, version_number, status, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    console.error('Version save error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSnapshot(supabase: any, year: number, programId: string | null): Promise<ScheduleSnapshot> {
  // Determine date range for the year
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Fetch all scheduling data in parallel
  const [
    sessionsRes,
    sessionTagsRes,
    templatesRes,
    calendarRes,
    settingsRes,
    instructorsRes,
    venuesRes,
    tagsRes,
  ] = await Promise.all([
    // Sessions for this year
    (supabase.from('sessions') as any)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate),
    // Session tags for sessions in this year (fetch all, filter client-side)
    (supabase.from('session_tags') as any).select('*'),
    // Event templates (not year-scoped — include all)
    (supabase.from('session_templates') as any).select('*'),
    // School calendar for this year
    (supabase.from('school_calendar') as any)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate),
    // Settings (single row)
    (supabase.from('settings') as any).select('*').limit(1).single(),
    // Reference data — preserved on revert (scoped to program if provided)
    programId
      ? (supabase.from('staff') as any).select('*').eq('program_id', programId)
      : (supabase.from('staff') as any).select('*'),
    programId
      ? (supabase.from('venues') as any).select('*').eq('program_id', programId)
      : (supabase.from('venues') as any).select('*'),
    programId
      ? (supabase.from('tags') as any).select('*').eq('program_id', programId)
      : (supabase.from('tags') as any).select('*'),
  ]);

  const sessions = sessionsRes.data ?? [];
  const sessionIds = new Set(sessions.map((s: { id: string }) => s.id));

  // Filter session_tags to only those belonging to sessions in this year
  const sessionTags = (sessionTagsRes.data ?? []).filter(
    (st: { session_id: string }) => sessionIds.has(st.session_id)
  );

  return {
    sessions,
    session_tags: sessionTags,
    session_templates: templatesRes.data ?? [],
    school_calendar: calendarRes.data ?? [],
    settings: settingsRes.data ?? null,
    instructors: instructorsRes.data ?? [],
    venues: venuesRes.data ?? [],
    tags: tagsRes.data ?? [],
  };
}
