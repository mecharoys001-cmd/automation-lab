import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';


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

    // Verify program access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tag } = await (supabase.from('tags') as any)
      .select('program_id, category')
      .eq('id', id)
      .single();

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (!tag.program_id) {
      return NextResponse.json({ error: 'Tag has no program association' }, { status: 403 });
    }

    const accessErr = await requireProgramAccess(auth.user, tag.program_id);
    if (accessErr) return accessErr;

    const body = await request.json();
    console.log('[PATCH /api/tags] received body:', JSON.stringify(body));

    const updateData: { name?: string; description?: string | null; emoji?: string | null; category?: string | null } = {};
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
    const hasCategory = 'category' in body;
    if (hasCategory) {
      updateData.category = body.category && typeof body.category === 'string' && body.category.trim()
        ? body.category.trim()
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
    if (error && (hasDescription || hasEmoji || hasCategory) && (error.code === '42703' || error.message?.includes('column'))) {
      console.warn('[PATCH /api/tags] v2 columns missing — falling back without emoji/description/category');
      const updateBasic = { ...updateData };
      delete updateBasic.description;
      delete updateBasic.emoji;
      delete updateBasic.category;
      if (Object.keys(updateBasic).length === 0) {
        return NextResponse.json({
          tag: null,
          warning: 'Description/emoji/category fields unavailable — run migration to enable.',
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
      ...(v2ColumnsSkipped && { warning: 'Description/emoji/category fields unavailable — run migration to enable.' }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify program access before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagToDelete } = await (supabase.from('tags') as any)
      .select('program_id, category')
      .eq('id', id)
      .single();

    if (!tagToDelete?.program_id) {
      return NextResponse.json({ error: 'Tag not found or has no program association' }, { status: 403 });
    }

    const accessErr = await requireProgramAccess(auth.user, tagToDelete.program_id);
    if (accessErr) return accessErr;

    const force = request.nextUrl.searchParams.get('force') === 'true';

    // Check if tag is in use via session_tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase.from('session_tags') as any)
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const usageCount = count ?? 0;

    if (usageCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `Tag is used by ${usageCount} session(s). Use force delete to remove it from all sessions.`,
          usageCount,
        },
        { status: 409 }
      );
    }

    // If force deleting, remove from all junction tables first
    if (force) {
      if (usageCount > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: unlinkError } = await (supabase.from('session_tags') as any)
          .delete()
          .eq('tag_id', id);

        if (unlinkError) {
          return NextResponse.json({ error: `Failed to unlink sessions: ${unlinkError.message}` }, { status: 500 });
        }
      }

      // Clean up staff_tags if the table exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: staffErr } = await (supabase.from('staff_tags') as any)
        .delete()
        .eq('tag_id', id);
      if (staffErr && staffErr.code !== '42P01') {
        // 42P01 = relation does not exist — ignore if table not yet created
        console.warn('[DELETE /api/tags] staff_tags cleanup warning:', staffErr.message);
      }

      // Clean up venue_tags if the table exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: venueErr } = await (supabase.from('venue_tags') as any)
        .delete()
        .eq('tag_id', id);
      if (venueErr && venueErr.code !== '42P01') {
        console.warn('[DELETE /api/tags] venue_tags cleanup warning:', venueErr.message);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tags') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, removedFromSessions: usageCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
