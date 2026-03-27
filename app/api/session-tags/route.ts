import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.session_id || !body.tag_id) {
      return NextResponse.json(
        { error: 'session_id and tag_id are required' },
        { status: 400 }
      );
    }

    // Verify program access via the session's program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sess } = await (supabase.from('sessions') as any)
      .select('program_id')
      .eq('id', body.session_id)
      .single();
    if (sess?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, sess.program_id);
      if (accessErr) return accessErr;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_tags') as any)
      .insert({ session_id: body.session_id, tag_id: body.tag_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This tag is already assigned to this session' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session_tag: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.session_id || !body.tag_id) {
      return NextResponse.json(
        { error: 'session_id and tag_id are required' },
        { status: 400 }
      );
    }

    // Verify program access via the session's program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sess } = await (supabase.from('sessions') as any)
      .select('program_id')
      .eq('id', body.session_id)
      .single();
    if (sess?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, sess.program_id);
      if (accessErr) return accessErr;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('session_tags') as any)
      .delete()
      .eq('session_id', body.session_id)
      .eq('tag_id', body.tag_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
