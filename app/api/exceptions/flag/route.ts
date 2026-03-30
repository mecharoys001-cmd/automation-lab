/**
 * POST /api/exceptions/flag
 *
 * When a school_calendar entry is added/edited with status_type of
 * 'no_school', 'early_dismissal', or 'instructor_exception', this
 * endpoint flags all affected published sessions with needs_resolution = true.
 *
 * Request body: { calendar_entry_id: string }
 *   — The ID of the school_calendar entry that triggered the exception.
 *
 * Logic:
 *   - no_school:             all published sessions on that date
 *   - early_dismissal:       published sessions at/after dismissal time
 *   - instructor_exception:  that instructor's published sessions on that date
 *
 * Auth: Uses Supabase service role key (admin-only server operation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import type { SchoolCalendar } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Flagging exceptions requires admin role
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

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

    // Verify program access
    const accessErr = await requireProgramAccess(auth.user, entry.program_id);
    if (accessErr) return accessErr;

    // 2. Build the query to find affected published sessions
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
        // Only sessions at or after dismissal time
        if (entry.early_dismissal_time) {
          query = query.gte('start_time', entry.early_dismissal_time);
        }
        break;

      case 'instructor_exception':
        // Only that instructor's sessions
        if (entry.target_instructor_id) {
          query = query.eq('staff_id', entry.target_instructor_id);
        }
        break;
    }

    // 3. Execute the update
    const { data: updated, error: updateError } = await query.select('id');

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to flag sessions: ${updateError.message}` },
        { status: 500 }
      );
    }

    const flaggedCount = updated?.length ?? 0;

    return NextResponse.json({
      success: true,
      flagged_count: flaggedCount,
      calendar_entry_id: entry.id,
      status_type: entry.status_type,
      date: entry.date,
      summary: flaggedCount > 0
        ? `Flagged ${flaggedCount} session${flaggedCount !== 1 ? 's' : ''} for resolution.`
        : 'No published sessions affected on this date.',
    });
  } catch (err) {
    console.error('Exception flag API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
