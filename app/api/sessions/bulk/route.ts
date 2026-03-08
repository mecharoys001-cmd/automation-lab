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

// Allow up to 60s for bulk deletes (Vercel Pro/Enterprise)
export const maxDuration = 60;

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

    // Batch delete using paginated ID fetches to avoid both:
    //   - Supabase max_rows cap (1000) on SELECT
    //   - PostgreSQL statement_timeout on large single DELETEs
    // PostgREST .in() has a URL length limit — 200 UUIDs ≈ 7KB, well under the ~8KB cap
    const BATCH = 200;
    let totalDeleted = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Fetch a page of IDs using .range() to bypass max_rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batch, error: fetchErr } = await (supabase.from('sessions') as any)
        .select('id')
        .eq('program_id', programId)
        .eq('status', 'draft')
        .range(0, BATCH - 1);

      if (fetchErr) {
        return NextResponse.json(
          { error: `Failed to fetch sessions: ${fetchErr.message}` },
          { status: 500 },
        );
      }

      if (!batch || batch.length === 0) break;

      const ids = batch.map((s: { id: string }) => s.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase.from('sessions') as any)
        .delete()
        .in('id', ids);

      if (delErr) {
        return NextResponse.json(
          { error: `Failed to delete batch: ${delErr.message}` },
          { status: 500 },
        );
      }

      totalDeleted += ids.length;
      if (ids.length < BATCH) break;
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
