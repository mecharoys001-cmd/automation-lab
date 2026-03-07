/**
 * DELETE /api/sessions/bulk
 *
 * Deletes all sessions for a given program.
 *
 * Query params:
 *   - program_id (required): UUID of the program whose sessions should be deleted
 *
 * Response: { success: true, deleted: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Get count first, then delete in one statement.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase.from('sessions') as any)
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId)
      .eq('status', 'draft');

    if (countError) {
      return NextResponse.json(
        { error: `Failed to count sessions: ${countError.message}` },
        { status: 500 },
      );
    }

    // Single bulk DELETE — PostgREST executes as one SQL statement server-side.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from('sessions') as any)
      .delete()
      .eq('program_id', programId)
      .eq('status', 'draft');

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete sessions: ${deleteError.message}` },
        { status: 500 },
      );
    }

    const totalDeleted = count ?? 0;

    trackScheduleChange();
    return NextResponse.json({ success: true, deleted: totalDeleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
