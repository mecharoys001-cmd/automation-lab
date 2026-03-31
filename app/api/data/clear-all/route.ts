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
import { requireAdmin, requireMasterAdmin, requireProgramAccess } from '@/lib/api-auth';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Destructive: only master admins can clear all data
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // 1. Delete school_calendar entries scoped to this program (they reference instructors)
    const { data: calData, error: calErr } = await sb
      .from('school_calendar')
      .delete()
      .eq('program_id', programId)
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

    // 3. Delete event templates scoped to this program
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

    // 4. Delete instructors scoped to this program
    const { data: instrData, error: instrErr } = await sb
      .from('staff')
      .delete()
      .eq('program_id', programId)
      .select('id');

    if (instrErr) {
      return NextResponse.json(
        { error: `Failed to delete instructors: ${instrErr.message}` },
        { status: 500 },
      );
    }

    // 5. Delete venues scoped to this program
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

    // 6. Delete tags scoped to this program EXCEPT Event Type and Space Types (those are default categories)
    const PRESERVED_CATEGORIES = ['Event Type', 'Space Types'];
    const { data: tagData, error: tagErr } = await sb
      .from('tags')
      .delete()
      .eq('program_id', programId)
      .not('category', 'in', `(${PRESERVED_CATEGORIES.map(c => `"${c}"`).join(',')})`)
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
