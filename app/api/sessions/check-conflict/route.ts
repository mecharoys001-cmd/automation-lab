/**
 * GET /api/sessions/check-conflict
 *
 * Checks whether a venue has a scheduling conflict at the given date/time.
 *
 * Query params:
 *   - venue_id (required): UUID of the venue
 *   - date (required): YYYY-MM-DD
 *   - start_time (required): HH:MM (24h)
 *   - end_time (required): HH:MM (24h)
 *   - exclude_id (optional): session ID to exclude (for edit mode)
 *
 * Response: { conflict: boolean, conflicting_session?: { name, start_time, end_time }, venue_name?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venue_id');
    const date = searchParams.get('date');
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    const excludeId = searchParams.get('exclude_id');

    if (!venueId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required params: venue_id, date, start_time, end_time' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch venue info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: venue } = await (supabase.from('venues') as any)
      .select('name, max_concurrent_bookings')
      .eq('id', venueId)
      .single();

    if (!venue) {
      return NextResponse.json({ conflict: false });
    }

    const maxConcurrent = venue.max_concurrent_bookings ?? 1;

    // Find overlapping sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select('id, name, start_time, end_time')
      .eq('venue_id', venueId)
      .eq('date', date)
      .neq('status', 'canceled')
      .lt('start_time', endTime)
      .gt('end_time', startTime);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: conflicts } = await query;

    if ((conflicts?.length ?? 0) >= maxConcurrent) {
      const conflict = conflicts[0];
      return NextResponse.json({
        conflict: true,
        venue_name: venue.name,
        conflicting_session: {
          name: conflict.name,
          start_time: conflict.start_time,
          end_time: conflict.end_time,
        },
      });
    }

    return NextResponse.json({ conflict: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
