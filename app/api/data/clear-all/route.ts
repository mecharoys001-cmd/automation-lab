/**
 * DELETE /api/data/clear-all?program_id=XXX
 *
 * Deletes ALL sessions, session templates, instructors, venues, and tags.
 * Deletion order respects FK constraints (sessions → session_tags first,
 * then sessions, templates, instructors, venues, tags).
 *
 * Response: { success: true, counts: { sessions, templates, instructors, venues, tags } }
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

    // 1. Delete sessions (uses batched RPC to handle large datasets)
    const { data: sessionsDeleted, error: sessErr } = await sb
      .rpc('delete_all_sessions_batched', { p_program_id: programId, p_batch_size: 5000 });

    if (sessErr) {
      return NextResponse.json(
        { error: `Failed to delete sessions: ${sessErr.message}` },
        { status: 500 },
      );
    }

    // 2. Delete session templates
    const { data: tmplData, error: tmplErr } = await sb
      .from('session_templates')
      .delete()
      .eq('program_id', programId)
      .select('id');

    if (tmplErr) {
      return NextResponse.json(
        { error: `Failed to delete templates: ${tmplErr.message}` },
        { status: 500 },
      );
    }

    // 3. Delete instructors (global — not program-scoped)
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

    // 4. Delete venues
    const { data: venueData, error: venueErr } = await sb
      .from('venues')
      .delete()
      .eq('program_id', programId)
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
