/**
 * DELETE /api/sessions/bulk
 *
 * Deletes draft sessions for a program, one week at a time to avoid
 * PostgreSQL statement_timeout. Client calls repeatedly until done.
 *
 * Query params:
 *   - program_id (required)
 *
 * Response: { success: true, deleted: number, done: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

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

    // Find the date range of remaining drafts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: range, error: rangeErr } = await (supabase.from('sessions') as any)
      .select('date')
      .eq('program_id', programId)
      .eq('status', 'draft')
      .order('date', { ascending: true })
      .limit(1)
      .single();

    if (rangeErr || !range) {
      // No drafts left
      trackScheduleChange();
      return NextResponse.json({ success: true, deleted: 0, done: true });
    }

    // Delete one day at a time — a single day's sessions (even 300+) is small
    // enough for PostgreSQL to handle without statement_timeout.
    const targetDate = range.date;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deleted, error: delErr } = await (supabase.from('sessions') as any)
      .delete()
      .eq('program_id', programId)
      .eq('status', 'draft')
      .eq('date', targetDate)
      .select('id');

    if (delErr) {
      return NextResponse.json(
        { error: `Failed to delete sessions for ${targetDate}: ${delErr.message}` },
        { status: 500 },
      );
    }

    const count = deleted?.length ?? 0;

    return NextResponse.json({
      success: true,
      deleted: count,
      done: false, // Client should call again to check for more
      date: targetDate,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
