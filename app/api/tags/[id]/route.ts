import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    console.log('[PATCH /api/tags] received body:', JSON.stringify(body));

    const updateData: { name?: string; description?: string | null; emoji?: string | null } = {};
    if (body.name && typeof body.name === 'string' && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    const hasDescription = 'description' in body;
    if (hasDescription) {
      updateData.description = body.description && typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;
    }
    const hasEmoji = 'emoji' in body;
    if (hasEmoji) {
      updateData.emoji = body.emoji && typeof body.emoji === 'string' && body.emoji.trim()
        ? body.emoji.trim()
        : null;
    }

    console.log('[PATCH /api/tags] updateData:', JSON.stringify(updateData));

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (supabase.from('tags') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    console.log('[PATCH /api/tags] supabase response:', JSON.stringify({ data, error }));

    // If v2 columns don't exist yet, retry without them
    let v2ColumnsSkipped = false;
    if (error && (hasDescription || hasEmoji) && (error.code === '42703' || error.message?.includes('column'))) {
      console.warn('[PATCH /api/tags] v2 columns missing — falling back without emoji/description');
      const { description: _d, emoji: _e, ...updateBasic } = updateData;
      if (Object.keys(updateBasic).length === 0) {
        return NextResponse.json({
          tag: null,
          warning: 'Description/emoji fields unavailable — run migration to enable.',
        }, { status: 422 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (supabase.from('tags') as any)
        .update(updateBasic)
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
      v2ColumnsSkipped = !error;
    }

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[PATCH /api/tags] final response tag:', JSON.stringify(data));

    return NextResponse.json({
      tag: data,
      ...(v2ColumnsSkipped && { warning: 'Description/emoji fields unavailable — run migration to enable.' }),
    });
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

    // Check if tag is in use via session_tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase.from('session_tags') as any)
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete tag: it is used by ${count} session(s). Remove it from all sessions first.` },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tags') as any)
      .delete()
      .eq('id', id);

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
