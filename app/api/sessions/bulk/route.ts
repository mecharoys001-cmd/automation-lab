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

    // Batch delete in chunks to avoid statement timeout
    const BATCH_SIZE = 1000;
    let totalDeleted = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Fetch a batch of session IDs to delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batch, error: fetchError } = await (supabase.from('sessions') as any)
        .select('id')
        .eq('program_id', programId)
        .eq('status', 'draft')
        .limit(BATCH_SIZE);

      if (fetchError) {
        return NextResponse.json(
          { error: `Failed to fetch sessions: ${fetchError.message}` },
          { status: 500 },
        );
      }

      if (!batch || batch.length === 0) {
        break; // No more sessions to delete
      }

      const ids = batch.map((s: { id: string }) => s.id);

      // Delete this batch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase.from('sessions') as any)
        .delete()
        .in('id', ids);

      if (deleteError) {
        return NextResponse.json(
          { error: `Failed to delete batch: ${deleteError.message}` },
          { status: 500 },
        );
      }

      totalDeleted += ids.length;

      // If we got fewer than BATCH_SIZE, we're done
      if (batch.length < BATCH_SIZE) {
        break;
      }
    }

    trackScheduleChange();
    return NextResponse.json({ success: true, deleted: totalDeleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
