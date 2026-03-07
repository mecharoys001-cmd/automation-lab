/**
 * POST /api/sessions/bulk-assign
 *
 * Assigns instructors to multiple sessions in a single request.
 *
 * Body: { assignments: Array<{ id: string; instructor_id: string | null }> }
 *
 * Response: { updated: number, failed: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

const MAX_BATCH_SIZE = 5000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignments } = body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: 'assignments array is required and must not be empty' },
        { status: 400 },
      );
    }

    if (assignments.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many assignments. Maximum is ${MAX_BATCH_SIZE}` },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    let updated = 0;
    let failed = 0;

    const CHUNK_SIZE = 50;
    for (let i = 0; i < assignments.length; i += CHUNK_SIZE) {
      const chunk = assignments.slice(i, i + CHUNK_SIZE);

      const results = await Promise.allSettled(
        chunk.map(async (item: { id: string; instructor_id: string | null }) => {
          if (!item.id) throw new Error('Missing session id');

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('sessions') as any)
            .update({ instructor_id: item.instructor_id })
            .eq('id', item.id);

          if (error) throw error;
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') updated++;
        else failed++;
      }
    }

    trackScheduleChange();
    return NextResponse.json({ updated, failed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
