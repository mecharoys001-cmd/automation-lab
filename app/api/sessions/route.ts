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

    // Build query with relations via Supabase's PostgREST syntax
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select(`
        *,
        instructor:instructors(*),
        venue:venues(*),
        template:session_templates(*),
        session_tags(tag:tags(*))
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(50000); // Override Supabase default (1000); date-range filtering keeps actual result sets small

    if (programId && programId !== 'all') {
      query = query.eq('program_id', programId);
    }

    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    }

    if (date) {
      query = query.eq('date', date);
    }

    // Date range filtering (start_date/end_date take precedence over exact date)
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (excludeStatus) {
      query = query.neq('status', excludeStatus);
    }

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    if (templateId) {
      query = query.eq('template_id', templateId);
    }

    if (instructorIdParam === 'null') {
      query = query.is('instructor_id', null);
    } else if (instructorIdParam) {
      query = query.eq('instructor_id', instructorIdParam);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch sessions: ${error.message}` },
        { status: 500 }
      );
    }

    const result = data ?? [];

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
