import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireProgramAccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-service';

const VALID_REVIEW_STATUSES = ['approved', 'denied'] as const;

// ── GET: List time off requests for admin review ───────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff_time_off_requests') as any)
      .select('*, staff:staff_id(first_name, last_name)')
      .eq('program_id', programId)
      .order('submitted_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten staff join for easier UI consumption
    const requests = (data ?? []).map((r: Record<string, unknown>) => {
      const staff = r.staff as { first_name: string; last_name: string } | null;
      return {
        ...r,
        staff_first_name: staff?.first_name ?? '',
        staff_last_name: staff?.last_name ?? '',
      };
    });

    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// ── PATCH: Approve or deny a time off request ──────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, status, review_note, program_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!VALID_REVIEW_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_REVIEW_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }
    if (program_id) {
      const accessErr = await requireProgramAccess(auth.user, program_id);
      if (accessErr) return accessErr;
    }

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff_time_off_requests') as any)
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user.id,
        review_note: review_note ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
