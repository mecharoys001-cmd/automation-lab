import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { isLockedTagCategory, getLockedCategoryReason } from '@/lib/tag-locking';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { category, program_id } = body as {
      category?: string;
      program_id?: string;
    };

    if (!category?.trim()) {
      return NextResponse.json(
        { error: 'category is required' },
        { status: 400 }
      );
    }

    if (!program_id) {
      return NextResponse.json(
        { error: 'program_id is required' },
        { status: 400 }
      );
    }

    const accessErr = await requireProgramAccess(auth.user, program_id);
    if (accessErr) return accessErr;

    const trimmed = category.trim();

    // Protect core categories from deletion
    if (isLockedTagCategory(trimmed)) {
      return NextResponse.json(
        { error: getLockedCategoryReason(trimmed) },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();

    // Find all tags in this category for this program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagsInCategory, error: fetchError } = await (supabase.from('tags') as any)
      .select('id')
      .eq('category', trimmed)
      .eq('program_id', program_id);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const tagIds: string[] = (tagsInCategory ?? []).map((t: { id: string }) => t.id);

    if (tagIds.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Clean up all junction tables for these tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: sessionErr } = await (supabase.from('session_tags') as any)
      .delete()
      .in('tag_id', tagIds);
    if (sessionErr) {
      return NextResponse.json({ error: `Failed to unlink sessions: ${sessionErr.message}` }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: staffErr } = await (supabase.from('staff_tags') as any)
      .delete()
      .in('tag_id', tagIds);
    if (staffErr && staffErr.code !== '42P01') {
      console.warn('[DELETE /api/tags/categories/delete] staff_tags cleanup warning:', staffErr.message);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: venueErr } = await (supabase.from('venue_tags') as any)
      .delete()
      .in('tag_id', tagIds);
    if (venueErr && venueErr.code !== '42P01') {
      console.warn('[DELETE /api/tags/categories/delete] venue_tags cleanup warning:', venueErr.message);
    }

    // Delete all tags in the category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from('tags') as any)
      .delete()
      .eq('category', trimmed)
      .eq('program_id', program_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: tagIds.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
