import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { skillsMatch } from '@/lib/scheduler/utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .select('*, venue:venues(*)')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    // Validate required fields if being updated
    if ('name' in body && (!body.name || !String(body.name).trim())) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    // venue_id is optional — generator can auto-assign

    // Validate scheduling mode fields if being updated
    if (body.scheduling_mode) {
      const mode = body.scheduling_mode;
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
    }

    // Validate instructor has required skills for this template's subject
    const instructorId = body.instructor_id;
    const requiredSkills = body.required_skills;
    if (instructorId !== undefined || requiredSkills !== undefined) {
      // If only one field is being updated, fetch the other from the existing template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase.from('session_templates') as any)
        .select('instructor_id, required_skills')
        .eq('id', id)
        .single();

      const finalInstructorId = instructorId ?? existing?.instructor_id;
      const finalSkills = requiredSkills ?? existing?.required_skills;

      if (finalInstructorId && finalSkills?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: instructor } = await (supabase.from('instructors') as any)
          .select('skills')
          .eq('id', finalInstructorId)
          .single();

        if (instructor && !skillsMatch(instructor.skills, finalSkills)) {
          return NextResponse.json(
            { error: `Instructor does not teach the required subject(s): ${finalSkills.join(', ')}. Assign an instructor with matching skills or update the instructor's skills.` },
            { status: 400 }
          );
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .update(body)
      .eq('id', id)
      .select('*, venue:venues(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Orphan sessions that reference this template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sessions') as any)
      .update({ template_id: null })
      .eq('template_id', id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('session_templates') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
