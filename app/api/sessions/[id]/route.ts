import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('sessions') as any)
      .update(body)
      .eq('id', id)
      .select(`
        *,
        instructor:instructors(*),
        venue:venues(*),
        session_tags(tag:tags(*))
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten session_tags into tags array
    const { session_tags, ...rest } = data as Record<string, unknown>;
    const tags = Array.isArray(session_tags)
      ? (session_tags as Record<string, unknown>[]).map((st) => st.tag).filter(Boolean)
      : [];

    trackScheduleChange();
    return NextResponse.json({ session: { ...rest, tags } });
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
    const { id } = await params;
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
