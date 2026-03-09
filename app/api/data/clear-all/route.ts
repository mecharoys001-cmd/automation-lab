/**
 * DELETE /api/data/clear-all?program_id=XXX
 *
 * Nuclear option: deletes ALL data across the system.
 * Deletion order respects FK constraints:
 * 1. school_calendar (references instructors)
 * 2. sessions + session_tags
 * 3. templates
 * 4. instructors (safe after calendar + sessions deleted)
 * 5. venues (global)
 * 6. tags (global)
 *
 * Response: { success: true, counts: { calendar, sessions, templates, instructors, venues, tags } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // 1. Delete ALL school_calendar entries first (they reference instructors)
    const { data: calData, error: calErr } = await sb
      .from('school_calendar')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (calErr) {
      return NextResponse.json(
        { error: `Failed to delete calendar entries: ${calErr.message}` },
        { status: 500 },
      );
    }

    // 2. Delete sessions (uses batched RPC to handle large datasets)
    const { data: sessionsDeleted, error: sessErr } = await sb
      .rpc('delete_all_sessions_batched', { p_program_id: programId, p_batch_size: 5000 });

    if (sessErr) {
      return NextResponse.json(
        { error: `Failed to delete sessions: ${sessErr.message}` },
        { status: 500 },
      );
    }

    // 3. Delete ALL event templates
    const { data: tmplData, error: tmplErr } = await sb
      .from('session_templates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (tmplErr) {
      return NextResponse.json(
        { error: `Failed to delete templates: ${tmplErr.message}` },
        { status: 500 },
      );
    }

    // 4. Delete instructors (global — sessions/calendar already deleted above)
    const { data: instrData, error: instrErr } = await sb
      .from('instructors')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (instrErr) {
      return NextResponse.json(
        { error: `Failed to delete instructors: ${instrErr.message}` },
        { status: 500 },
      );
    }

    // 5. Delete venues (global — no program_id column)
    const { data: venueData, error: venueErr } = await sb
      .from('venues')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (venueErr) {
      return NextResponse.json(
        { error: `Failed to delete venues: ${venueErr.message}` },
        { status: 500 },
      );
    }

    // 5. Delete tags (global — not program-scoped)
    const { data: tagData, error: tagErr } = await sb
      .from('tags')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (tagErr) {
      return NextResponse.json(
        { error: `Failed to delete tags: ${tagErr.message}` },
        { status: 500 },
      );
    }

    const counts = {
      calendar: calData?.length ?? 0,
      sessions: sessionsDeleted ?? 0,
      templates: tmplData?.length ?? 0,
      instructors: instrData?.length ?? 0,
      venues: venueData?.length ?? 0,
      tags: tagData?.length ?? 0,
    };

    if (counts.sessions > 0 || counts.templates > 0) {
      trackScheduleChange();
    }

    return NextResponse.json({ success: true, counts });
  } catch (err) {
    console.error('Clear-all API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
