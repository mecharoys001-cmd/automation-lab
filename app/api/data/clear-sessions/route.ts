/**
 * DELETE /api/data/clear-sessions?program_id=XXX
 *
 * Deletes ONLY sessions for a program (including session_tags via cascade).
 * Templates, instructors, venues, and tags are preserved.
 *
 * Response: { success: true, counts: { sessions: number } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { requireAdmin } from '@/lib/api-auth';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Delete all sessions using the PostgreSQL batch-delete function
    // to avoid Supabase/PostgREST timeouts on large datasets.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: totalDeleted, error } = await (supabase as any)
      .rpc('delete_all_sessions_batched', { p_program_id: programId, p_batch_size: 5000 });

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete sessions: ${error.message}` },
        { status: 500 },
      );
    }

    if (totalDeleted > 0) {
      trackScheduleChange();
    }

    return NextResponse.json({
      success: true,
      counts: { sessions: totalDeleted ?? 0 },
    });
  } catch (err) {
    console.error('Clear-sessions API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
