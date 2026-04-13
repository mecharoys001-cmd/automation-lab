import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { tag_ids, program_id, force } = body as {
      tag_ids: string[];
      program_id: string;
      force?: boolean;
    };

    if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
      return NextResponse.json({ error: 'tag_ids array is required and must not be empty' }, { status: 400 });
    }

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, program_id);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();

    // Verify all tags belong to this program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagsToDelete, error: fetchErr } = await (supabase.from('tags') as any)
      .select('id, name, program_id')
      .in('id', tag_ids)
      .eq('program_id', program_id);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const foundIds = new Set((tagsToDelete ?? []).map((t: { id: string }) => t.id));
    const missingIds = tag_ids.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `${missingIds.length} tag(s) not found or do not belong to this program` },
        { status: 404 }
      );
    }

    // Check usage counts for all tags via session_tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usageRows, error: usageErr } = await (supabase.from('session_tags') as any)
      .select('tag_id')
      .in('tag_id', tag_ids);

    if (usageErr) {
      return NextResponse.json({ error: usageErr.message }, { status: 500 });
    }

    // Build per-tag usage counts
    const usageCounts: Record<string, number> = {};
    for (const row of usageRows ?? []) {
      usageCounts[row.tag_id] = (usageCounts[row.tag_id] || 0) + 1;
    }

    const tagsInUse = tag_ids.filter((id) => (usageCounts[id] || 0) > 0);
    const totalSessionLinks = tagsInUse.reduce((sum, id) => sum + (usageCounts[id] || 0), 0);

    if (tagsInUse.length > 0 && !force) {
      return NextResponse.json(
        {
          error: `${tagsInUse.length} tag(s) are in use by sessions. Use force to remove them.`,
          tagsInUse: tagsInUse.length,
          totalSessionLinks,
          usageCounts,
        },
        { status: 409 }
      );
    }

    // If force, remove from all junction tables first
    if (force && tagsInUse.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: unlinkError } = await (supabase.from('session_tags') as any)
        .delete()
        .in('tag_id', tag_ids);

      if (unlinkError) {
        return NextResponse.json({ error: `Failed to unlink sessions: ${unlinkError.message}` }, { status: 500 });
      }

      // Clean up staff_tags
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: staffErr } = await (supabase.from('staff_tags') as any)
        .delete()
        .in('tag_id', tag_ids);
      if (staffErr && staffErr.code !== '42P01') {
        console.warn('[POST /api/tags/bulk-delete] staff_tags cleanup warning:', staffErr.message);
      }

      // Clean up venue_tags
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: venueErr } = await (supabase.from('venue_tags') as any)
        .delete()
        .in('tag_id', tag_ids);
      if (venueErr && venueErr.code !== '42P01') {
        console.warn('[POST /api/tags/bulk-delete] venue_tags cleanup warning:', venueErr.message);
      }
    }

    // Delete all tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteErr } = await (supabase.from('tags') as any)
      .delete()
      .in('id', tag_ids);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: tag_ids.length,
      removedFromSessions: totalSessionLinks,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
