import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireProgramAccess } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-service';

// ── GET: Pending time off count for sidebar attention dot ──────────────────

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
    const { count, error } = await (supabase.from('staff_time_off_requests') as any)
      .select('id', { count: 'exact', head: true })
      .eq('program_id', programId)
      .eq('status', 'pending');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
