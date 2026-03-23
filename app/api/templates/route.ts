import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { skillsMatch } from '@/lib/scheduler/utils';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    
    console.log('[Templates API] GET request for program:', programId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('session_templates') as any)
      .select('*, venue:venues(*)')
      .order('day_of_week')
      .order('sort_order');

    if (programId) {
      query = query.eq('program_id', programId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Debug: log venue assignments
    const venueStats = (data ?? []).reduce((acc: Record<string, number>, t: any) => {
      const venueName = t.venue?.name ?? 'NULL';
      acc[venueName] = (acc[venueName] ?? 0) + 1;
      return acc;
    }, {});
    console.log('[Templates API] Templates by venue:', venueStats, 'Total:', (data ?? []).length);

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .delete()
      .eq('program_id', programId)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete templates: ${error.message}` },
        { status: 500 },
      );
    }

    const deleted = data?.length ?? 0;
    if (deleted > 0) {
      trackScheduleChange();
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    // Default template_type and rotation_mode for backward compatibility
    if (!body.template_type) body.template_type = 'fully_defined';
    if (!body.rotation_mode) body.rotation_mode = 'consistent';

    // Validate required fields: name and venue
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    // venue_id is optional — generator can auto-assign

    // Validate scheduling mode fields
    const mode = body.scheduling_mode ?? 'ongoing';
    if (mode === 'date_range') {
      if (!body.starts_on || !body.ends_on) {
        return NextResponse.json(
          { error: 'Date Range mode requires both a start and end date' },
          { status: 400 }
        );
      }
      if (body.starts_on > body.ends_on) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }
    } else if (mode === 'duration') {
      if (!body.starts_on || !body.duration_weeks || body.duration_weeks < 1) {
        return NextResponse.json(
          { error: 'Duration mode requires a start date and number of weeks' },
          { status: 400 }
        );
      }
    } else if (mode === 'session_count') {
      if (!body.starts_on || !body.session_count || body.session_count < 1) {
        return NextResponse.json(
          { error: 'Session Count mode requires a start date and number of sessions' },
          { status: 400 }
        );
      }
    }

    // Normalize empty strings to null
    if (body.instructor_id === '') body.instructor_id = null;
    if (body.venue_id === '') body.venue_id = null;

    // Prevent creating an Active template that is incomplete
    if (body.is_active === true) {
      const missing: string[] = [];
      if (!body.name || !String(body.name).trim()) missing.push('Name');
      if (body.day_of_week == null) missing.push('Day of Week');
      if (!body.instructor_id) missing.push('Staff');
      if (!body.venue_id) missing.push('Venue');
      if (!body.grade_groups?.length) missing.push('Grade Groups');
      if (!body.required_skills?.length) missing.push('Subject / Event Type');

      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Cannot activate template — missing required fields: ${missing.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate staff has required skills for this template's subject
    if (body.instructor_id && body.required_skills?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: instructor } = await (supabase.from('instructors') as any)
        .select('skills')
        .eq('id', body.instructor_id)
        .single();

      if (instructor && !skillsMatch(instructor.skills, body.required_skills)) {
        return NextResponse.json(
          { error: `Staff member does not teach the required subject(s): ${body.required_skills.join(', ')}. Assign a staff member with matching skills or update their skills.` },
          { status: 400 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .insert(body)
      .select('*, venue:venues(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
