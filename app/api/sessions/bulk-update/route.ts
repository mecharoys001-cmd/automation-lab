/**
 * POST /api/sessions/bulk-update
 *
 * Updates multiple sessions in a single request.
 *
 * Body: { updates: Array<{ id: string; date?: string; start_time?: string; end_time?: string; notes?: string }> }
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
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array is required and must not be empty' },
        { status: 400 },
      );
    }

    if (updates.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many updates. Maximum is ${MAX_BATCH_SIZE}` },
        { status: 400 },
      );
    }

    const allowedFields = ['date', 'start_time', 'end_time', 'notes'];
    const supabase = createServiceClient();

    let updated = 0;
    let failed = 0;

    // Process updates concurrently but in controlled batches to avoid overwhelming DB
    const CHUNK_SIZE = 50;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);

      const results = await Promise.allSettled(
        chunk.map(async (item: { id: string; [key: string]: unknown }) => {
          if (!item.id) throw new Error('Missing session id');

          // Only pick allowed fields that are actually provided
          const patch: Record<string, unknown> = {};
          for (const field of allowedFields) {
            if (field in item) {
              patch[field] = item[field];
            }
          }

          if (Object.keys(patch).length === 0) return; // nothing to update

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('sessions') as any)
            .update(patch)
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
