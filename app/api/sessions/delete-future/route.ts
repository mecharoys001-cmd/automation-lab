import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up the session to get its template_id, date, and program_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: lookupError } = await (supabase.from('sessions') as any)
      .select('id, template_id, date, program_id')
      .eq('id', sessionId)
      .single();

    if (lookupError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify program access
    if (session.program_id) {
      const accessErr = await requireProgramAccess(auth.user, session.program_id);
      if (accessErr) return accessErr;
    }

    if (!session.template_id) {
      return NextResponse.json({ error: 'Session has no template — use single delete instead' }, { status: 400 });
    }

    // Delete all sessions with the same template_id where date >= this session's date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deleted, error: deleteError } = await (supabase.from('sessions') as any)
      .delete()
      .eq('template_id', session.template_id)
      .gte('date', session.date)
      .select('id');

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ success: true, deleted: deleted?.length ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
