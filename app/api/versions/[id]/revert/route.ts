/**
 * POST /api/versions/:id/revert
 *
 * Smart revert: replace scheduling data from a version snapshot,
 * preserve reference data (instructors, venues, tags).
 *
 * Steps:
 *   1. Load snapshot from schedule_versions
 *   2. DELETE all sessions, session_tags, session_templates, school_calendar for that year
 *   3. INSERT sessions/templates/calendar from snapshot
 *   4. UPDATE settings from snapshot
 *   5. PRESERVE instructors, venues, tags (don't touch)
 *   6. If snapshot status=published, set all restored sessions to published
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { ScheduleSnapshot } from '@/types/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // ── 1. Load the version ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: version, error: fetchErr } = await (supabase.from('schedule_versions') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !version) {
      return NextResponse.json(
        { error: fetchErr?.message ?? 'Version not found' },
        { status: 404 }
      );
    }

    const snapshot = version.snapshot as ScheduleSnapshot;
    const year = version.year as number;
    const isPublished = version.status === 'published';
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // ── 2. DELETE current scheduling data for this year ──────

    // Get session IDs for this year (needed to delete session_tags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentSessions } = await (supabase.from('sessions') as any)
      .select('id')
      .gte('date', startDate)
      .lte('date', endDate);

    const currentSessionIds = (currentSessions ?? []).map((s: { id: string }) => s.id);

    // Delete session_tags for these sessions
    if (currentSessionIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('session_tags') as any)
        .delete()
        .in('session_id', currentSessionIds);
    }

    // Delete sessions for this year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sessions') as any)
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    // Delete all session_templates (not year-scoped)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('session_templates') as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

    // Delete school_calendar entries for this year
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('school_calendar') as any)
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);

    // ── 3. INSERT data from snapshot ─────────────────────────

    // Restore sessions
    if (snapshot.sessions?.length > 0) {
      const sessions = snapshot.sessions.map((s) => ({
        ...s,
        status: isPublished ? 'published' : s.status,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: sessErr } = await (supabase.from('sessions') as any)
        .insert(sessions);

      if (sessErr) {
        console.error('Revert: sessions insert error:', sessErr.message);
        return NextResponse.json(
          { error: `Failed to restore sessions: ${sessErr.message}` },
          { status: 500 }
        );
      }
    }

    // Restore session_tags
    if (snapshot.session_tags?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: stErr } = await (supabase.from('session_tags') as any)
        .insert(snapshot.session_tags);

      if (stErr) {
        console.error('Revert: session_tags insert error:', stErr.message);
      }
    }

    // Restore session_templates
    if (snapshot.session_templates?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: tmplErr } = await (supabase.from('session_templates') as any)
        .insert(snapshot.session_templates);

      if (tmplErr) {
        console.error('Revert: session_templates insert error:', tmplErr.message);
      }
    }

    // Restore school_calendar
    if (snapshot.school_calendar?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: calErr } = await (supabase.from('school_calendar') as any)
        .insert(snapshot.school_calendar);

      if (calErr) {
        console.error('Revert: school_calendar insert error:', calErr.message);
      }
    }

    // ── 4. UPDATE settings from snapshot ─────────────────────
    if (snapshot.settings) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentSettings } = await (supabase.from('settings') as any)
        .select('id')
        .limit(1)
        .single();

      if (currentSettings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('settings') as any)
          .update({
            buffer_time_enabled: snapshot.settings.buffer_time_enabled,
            buffer_time_minutes: snapshot.settings.buffer_time_minutes,
            last_modified_at: new Date().toISOString(),
          })
          .eq('id', currentSettings.id);
      }
    }

    // ── 5. instructors, venues, tags are PRESERVED ───────────
    //    (we intentionally don't touch them)

    return NextResponse.json({
      success: true,
      message: `Reverted to version ${version.version_number} from ${version.created_at}`,
      sessionsRestored: snapshot.sessions?.length ?? 0,
      templatesRestored: snapshot.session_templates?.length ?? 0,
    });
  } catch (err) {
    console.error('Version revert error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
