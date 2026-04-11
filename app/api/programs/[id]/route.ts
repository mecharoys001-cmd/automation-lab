import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { trackScheduleChange } from '@/lib/track-change';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;

    const accessErr = await requireProgramAccess(auth.user, id);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('programs') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ program: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const accessErr = await requireProgramAccess(auth.user, id);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();
    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('programs') as any)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ program: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const accessErr = await requireProgramAccess(auth.user, id);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // Delete child records in FK-safe order before removing the program row.
    // This avoids timeout on cascading deletes for large programs.

    // 1. school_calendar (references staff/instructors)
    const { error: calErr } = await sb
      .from('school_calendar')
      .delete()
      .eq('program_id', id);

    if (calErr) {
      return NextResponse.json(
        { error: `Failed to delete calendar entries: ${calErr.message}` },
        { status: 500 },
      );
    }

    // 2. sessions (batched RPC to handle thousands of rows)
    const { data: sessionsDeleted, error: sessErr } = await sb
      .rpc('delete_all_sessions_batched', { p_program_id: id, p_batch_size: 5000 });

    if (sessErr) {
      return NextResponse.json(
        { error: `Failed to delete sessions: ${sessErr.message}` },
        { status: 500 },
      );
    }

    // 3. session_templates
    const { error: tmplErr } = await sb
      .from('session_templates')
      .delete()
      .eq('program_id', id);

    if (tmplErr) {
      return NextResponse.json(
        { error: `Failed to delete templates: ${tmplErr.message}` },
        { status: 500 },
      );
    }

    // 4. notification_log rows for this program's staff
    const { data: staffRows, error: staffLookupErr } = await sb
      .from('staff')
      .select('id')
      .eq('program_id', id);

    if (staffLookupErr) {
      return NextResponse.json(
        { error: `Failed to load staff before deletion: ${staffLookupErr.message}` },
        { status: 500 },
      );
    }

    const staffIds = (staffRows ?? []).map((row: { id: string }) => row.id);
    if (staffIds.length > 0) {
      const { error: notifErr } = await sb
        .from('notification_log')
        .delete()
        .in('instructor_id', staffIds);

      if (notifErr) {
        return NextResponse.json(
          { error: `Failed to delete notification log rows: ${notifErr.message}` },
          { status: 500 },
        );
      }
    }

    // 5. staff / instructors
    const { error: staffErr } = await sb
      .from('staff')
      .delete()
      .eq('program_id', id);

    if (staffErr) {
      return NextResponse.json(
        { error: `Failed to delete staff: ${staffErr.message}` },
        { status: 500 },
      );
    }

    // 6. venues
    const { error: venueErr } = await sb
      .from('venues')
      .delete()
      .eq('program_id', id);

    if (venueErr) {
      return NextResponse.json(
        { error: `Failed to delete venues: ${venueErr.message}` },
        { status: 500 },
      );
    }

    // 6. tags
    const { error: tagErr } = await sb
      .from('tags')
      .delete()
      .eq('program_id', id);

    if (tagErr) {
      return NextResponse.json(
        { error: `Failed to delete tags: ${tagErr.message}` },
        { status: 500 },
      );
    }

    // 7. Finally, delete the now-empty program row
    const { error } = await sb
      .from('programs')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ((sessionsDeleted ?? 0) > 0) {
      trackScheduleChange();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
