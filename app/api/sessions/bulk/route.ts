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

    // First count how many will be deleted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (supabase.from('sessions') as any)
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId);

    if (countError) {
      return NextResponse.json(
        { error: `Failed to count sessions: ${countError.message}` },
        { status: 500 },
      );
    }

    // Delete all sessions for this program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any)
      .delete()
      .eq('program_id', programId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ success: true, deleted: count ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
