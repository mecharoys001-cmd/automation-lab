import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { logSchedulerActivity } from '@/lib/activity-log';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('school_calendar') as any)
      .select('*, instructor:staff(id, first_name, last_name)')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Verify program access
    if (data?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, data.program_id);
      if (accessErr) return accessErr;
    }

    return NextResponse.json({ entry: data });
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
    const supabase = createServiceClient();

    // Fetch existing entry to verify program access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('school_calendar') as any)
      .select('program_id')
      .eq('id', id)
      .single();

    if (existing?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, existing.program_id);
      if (accessErr) return accessErr;
    }

    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('school_calendar') as any)
      .update(body)
      .eq('id', id)
      .select('*, instructor:staff(id, first_name, last_name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    const updatedRow = data as { description?: string | null; date?: string } | null;
    logSchedulerActivity({
      user: auth.user,
      action: 'update_calendar_entry',
      entityName: updatedRow?.description || updatedRow?.date || null,
      programId: existing?.program_id ?? null,
    });
    return NextResponse.json({ entry: data });
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
    const supabase = createServiceClient();

    // Fetch existing entry to verify program access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('school_calendar') as any)
      .select('program_id, description, date')
      .eq('id', id)
      .single();

    if (existing?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, existing.program_id);
      if (accessErr) return accessErr;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('school_calendar') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    logSchedulerActivity({
      user: auth.user,
      action: 'delete_calendar_entry',
      entityName: existing?.name ?? existing?.date ?? null,
      programId: existing?.program_id ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
