/**
 * POST /api/exceptions/flag-sessions
 *
 * When an admin adds a blackout/exception to school_calendar, this endpoint
 * flags all affected published sessions on that date (sets needs_resolution=true).
 *
 * Request body: { calendar_entry_id: string }
 *
 * Logic by status_type:
 *   - no_school:             all published sessions on that date
 *   - early_dismissal:       only sessions starting at/after dismissal time
 *   - instructor_exception:  only that instructor's sessions on that date
 *
 * Returns: { success, flagged_session_ids, flagged_count, ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, SchoolCalendar } from '@/types/database';

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { calendar_entry_id } = body;

    if (!calendar_entry_id || typeof calendar_entry_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid calendar_entry_id' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 1. Fetch the calendar entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawEntry, error: entryError } = await (supabase.from('school_calendar') as any)
      .select('*')
      .eq('id', calendar_entry_id)
      .single();
    const entry = rawEntry as SchoolCalendar | null;

    if (entryError || !entry) {
      return NextResponse.json(
        { success: false, error: 'Calendar entry not found' },
        { status: 404 }
      );
    }

    // 2. Build query to find affected published sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .update({ needs_resolution: true })
      .eq('program_id', entry.program_id)
      .eq('date', entry.date)
      .eq('status', 'published')
      .eq('needs_resolution', false);

    switch (entry.status_type) {
      case 'no_school':
        // All published sessions on that date — no additional filter
        break;

      case 'early_dismissal':
        // Only sessions starting at or after dismissal time
        if (entry.early_dismissal_time) {
          query = query.gte('start_time', entry.early_dismissal_time);
        }
        break;

      case 'instructor_exception':
        // Only that instructor's sessions
        if (entry.target_instructor_id) {
          query = query.eq('instructor_id', entry.target_instructor_id);
        }
        break;
    }

    // 3. Execute the update and return the flagged session IDs
    const { data: updated, error: updateError } = await query.select('id');

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to flag sessions: ${updateError.message}` },
        { status: 500 }
      );
    }

    const flaggedIds = (updated ?? []).map((row: { id: string }) => row.id);

    return NextResponse.json({
      success: true,
      flagged_session_ids: flaggedIds,
      flagged_count: flaggedIds.length,
      calendar_entry_id: entry.id,
      status_type: entry.status_type,
      date: entry.date,
      summary: flaggedIds.length > 0
        ? `Flagged ${flaggedIds.length} session${flaggedIds.length !== 1 ? 's' : ''} for resolution.`
        : 'No published sessions affected on this date.',
    });
  } catch (err) {
    console.error('Exception flag-sessions API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
