/**
 * GET /api/sessions
 * POST /api/sessions
 *
 * GET: Fetches sessions with related data (instructor, venue, tags).
 * POST: Creates a new session with concurrent booking validation.
 *
 * GET query params:
 *   - program_id (optional): UUID to filter sessions by program
 *   - instructor_email (optional): email to filter sessions by instructor
 *   - date (optional): filter sessions by exact date (YYYY-MM-DD)
 *   - start_date (optional): filter sessions on or after this date (YYYY-MM-DD)
 *   - end_date (optional): filter sessions on or before this date (YYYY-MM-DD)
 *   - status (optional): filter sessions by status
 *   - exclude_status (optional): exclude sessions with this status
 *   - exclude_id (optional): exclude a specific session by ID
 *
 * Response: { sessions: SessionWithRelations[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { skillsMatch, parseDate, formatDate } from '@/lib/scheduler/utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    const instructorEmail = searchParams.get('instructor_email');
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const statusFilter = searchParams.get('status');
    const excludeStatus = searchParams.get('exclude_status');
    const excludeId = searchParams.get('exclude_id');
    const templateId = searchParams.get('template_id');
    const instructorIdParam = searchParams.get('instructor_id');

    // If filtering by instructor email, resolve to instructor_id first
    let instructorId: string | null = null;
    if (instructorEmail) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: instructor, error: instrError } = await (supabase.from('instructors') as any)
        .select('id')
        .eq('email', instructorEmail.trim().toLowerCase())
        .maybeSingle();

      if (instrError) {
        return NextResponse.json(
          { error: `Failed to look up instructor: ${(instrError as { message: string }).message}` },
          { status: 500 }
        );
      }

      if (!instructor) {
        return NextResponse.json(
          { error: 'No instructor found with that email address' },
          { status: 404 }
        );
      }

      instructorId = (instructor as { id: string }).id;
    }

    // Build query with relations via Supabase's PostgREST syntax.
    // Supabase enforces a server-side max_rows (default 1000) that cannot
    // be overridden by the client .limit(). We paginate with .range() to
    // fetch all matching rows regardless of the server cap.

    function buildQuery() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from('sessions') as any)
        .select(`
          *,
          instructor:instructors(*),
          venue:venues(*),
          template:session_templates(*),
          session_tags(tag:tags(*))
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (programId && programId !== 'all') q = q.eq('program_id', programId);
      if (instructorId) q = q.eq('instructor_id', instructorId);
      if (date) q = q.eq('date', date);
      if (startDate && endDate) q = q.gte('date', startDate).lte('date', endDate);
      if (statusFilter) q = q.eq('status', statusFilter);
      if (excludeStatus) q = q.neq('status', excludeStatus);
      if (excludeId) q = q.neq('id', excludeId);
      if (templateId) q = q.eq('template_id', templateId);
      if (instructorIdParam === 'null') q = q.is('instructor_id', null);
      else if (instructorIdParam) q = q.eq('instructor_id', instructorIdParam);
      return q;
    }

    // Paginate to bypass Supabase max_rows cap (typically 1000)
    const PAGE_SIZE = 1000;
    const MAX_ROWS = 50000; // safety cap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];
    let offset = 0;

    while (offset < MAX_ROWS) {
      const { data: page, error: pageError } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);

      if (pageError) {
        return NextResponse.json(
          { error: `Failed to fetch sessions: ${pageError.message}` },
          { status: 500 }
        );
      }

      if (!page || page.length === 0) break;
      result.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Flatten the session_tags junction into a tags array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = (result as any[]).map((session: Record<string, unknown>) => {
      const { session_tags, ...rest } = session;
      const tags = Array.isArray(session_tags)
        ? session_tags.map((st: Record<string, unknown>) => st.tag).filter(Boolean)
        : [];
      return { ...rest, tags };
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('Sessions API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    // Validate concurrent booking capacity if venue is specified
    if (body.venue_id && body.date && body.start_time && body.end_time && body.status !== 'canceled') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: venue } = await (supabase.from('venues') as any)
        .select('max_concurrent_bookings')
        .eq('id', body.venue_id)
        .single();

      if (venue) {
        const maxConcurrent = venue.max_concurrent_bookings ?? 1;

        // Count existing non-canceled sessions at this venue/date/time
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error: countError } = await (supabase.from('sessions') as any)
          .select('*', { count: 'exact', head: true })
          .eq('venue_id', body.venue_id)
          .eq('date', body.date)
          .neq('status', 'canceled')
          .lt('start_time', body.end_time)
          .gt('end_time', body.start_time);

        if (countError) {
          return NextResponse.json(
            { error: `Failed to check venue capacity: ${countError.message}` },
            { status: 500 }
          );
        }

        if ((count ?? 0) >= maxConcurrent) {
          return NextResponse.json(
            { error: `Venue has reached its maximum of ${maxConcurrent} concurrent booking(s) for this time slot` },
            { status: 409 }
          );
        }
      }
    }

    // Validate instructor has required skills for the session's template subject
    if (body.instructor_id && body.template_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template } = await (supabase.from('session_templates') as any)
        .select('required_skills')
        .eq('id', body.template_id)
        .single();

      if (template?.required_skills?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: instructor } = await (supabase.from('instructors') as any)
          .select('skills')
          .eq('id', body.instructor_id)
          .single();

        if (instructor && !skillsMatch(instructor.skills, template.required_skills)) {
          return NextResponse.json(
            { error: `Instructor does not teach the required subject(s): ${template.required_skills.join(', ')}. Assign an instructor with matching skills.` },
            { status: 400 }
          );
        }
      }
    }

    // ---------------------------------------------------------------
    // Recurrence: generate multiple session dates if specified
    // ---------------------------------------------------------------
    const recurrence = body.recurrence as {
      type?: string;
      interval_weeks?: number;
      session_count?: number;
      until_date?: string;
    } | undefined;

    // Strip recurrence and rotation from the insert body — they're not DB columns
    delete body.recurrence;
    const rotationInstructorIds = body.rotation_instructor_ids as string[] | undefined;
    delete body.rotation_instructor_ids;

    if (recurrence && recurrence.type && recurrence.type !== 'none') {
      // Determine interval in days and stop condition
      const intervalDays =
        recurrence.type === 'weekly' ? 7
          : recurrence.type === 'every_x_weeks' ? (recurrence.interval_weeks ?? 2) * 7
            : 7; // default weekly for count/until modes

      const maxSessions =
        recurrence.type === 'for_x_sessions' ? (recurrence.session_count ?? 4) : 200;

      // Fetch program end date to bound generation
      let programEndDate: string | null = null;
      if (body.program_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prog } = await (supabase.from('programs') as any)
          .select('end_date')
          .eq('id', body.program_id)
          .single();
        if (prog) programEndDate = prog.end_date;
      }

      // Fetch school calendar blackout dates for this program
      const blackoutDates = new Set<string>();
      if (body.program_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: calEntries } = await (supabase.from('school_calendar') as any)
          .select('date, status_type')
          .eq('program_id', body.program_id)
          .eq('status_type', 'no_school');
        if (calEntries) {
          for (const entry of calEntries) {
            blackoutDates.add(entry.date);
          }
        }
      }

      const untilDate = recurrence.type === 'until_date' && recurrence.until_date
        ? recurrence.until_date : null;

      // Generate dates
      const dates: string[] = [];
      const startDate = parseDate(body.date);
      const cursor = new Date(startDate);

      while (dates.length < maxSessions) {
        const dateStr = formatDate(cursor);

        // Stop if past program end
        if (programEndDate && dateStr > programEndDate) break;
        // Stop if past until_date
        if (untilDate && dateStr > untilDate) break;

        // Skip blackout days
        if (!blackoutDates.has(dateStr)) {
          dates.push(dateStr);
        }

        cursor.setDate(cursor.getDate() + intervalDays);
      }

      if (dates.length === 0) {
        return NextResponse.json(
          { error: 'No valid dates found for the recurrence rule (all dates are blackout days or outside program range)' },
          { status: 400 }
        );
      }

      // Build session rows for each date, rotating instructors if specified
      const rows = dates.map((d, idx) => {
        const row = { ...body, date: d };
        if (rotationInstructorIds && rotationInstructorIds.length >= 2) {
          row.instructor_id = rotationInstructorIds[idx % rotationInstructorIds.length];
        }
        return row;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('sessions') as any)
        .insert(rows)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      trackScheduleChange();
      return NextResponse.json(
        { sessions: data, count: data?.length ?? 0 },
        { status: 201 }
      );
    }

    // ---------------------------------------------------------------
    // Single session (no recurrence)
    // ---------------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('sessions') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ session: data }, { status: 201 });
  } catch (err) {
    console.error('Sessions POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
