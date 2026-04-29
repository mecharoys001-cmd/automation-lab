import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { skillsMatch } from '@/lib/scheduler/utils';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { logSchedulerActivity } from '@/lib/activity-log';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

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

    if (!data.program_id) {
      return NextResponse.json({ error: 'Template has no program association' }, { status: 403 });
    }

    const accessErr = await requireProgramAccess(auth.user, data.program_id);
    if (accessErr) return accessErr;

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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

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

    if ('name' in body && String(body.name).trim().length > 200) {
      return NextResponse.json(
        { error: 'Template name must be 200 characters or less' },
        { status: 400 }
      );
    }
    // venue_id is optional — generator can auto-assign

    // Fetch existing template data for validation context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('session_templates') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!existing.program_id) {
      return NextResponse.json({ error: 'Template has no program association' }, { status: 403 });
    }

    const accessErr = await requireProgramAccess(auth.user, existing.program_id);
    if (accessErr) return accessErr;

    // Merge body with existing data for validation
    const merged = { ...existing, ...body };

    // Validate scheduling mode fields using merged data
    if (body.scheduling_mode || existing.scheduling_mode) {
      const mode = merged.scheduling_mode;
      if (mode === 'date_range') {
        if (!merged.starts_on || !merged.ends_on) {
          return NextResponse.json(
            { error: 'Date Range mode requires both a start and end date' },
            { status: 400 }
          );
        }
        if (merged.starts_on > merged.ends_on) {
          return NextResponse.json(
            { error: 'Start date must be before end date' },
            { status: 400 }
          );
        }
      } else if (mode === 'duration') {
        if (!merged.starts_on || !merged.duration_weeks || merged.duration_weeks < 1) {
          return NextResponse.json(
            { error: 'Duration mode requires a start date and number of weeks' },
            { status: 400 }
          );
        }
      } else if (mode === 'session_count') {
        if (!merged.starts_on || !merged.session_count || merged.session_count < 1) {
          return NextResponse.json(
            { error: 'Session Count mode requires a start date and number of sessions' },
            { status: 400 }
          );
        }
      }
    }

    // Normalize empty strings to null
    if (body.instructor_id === '') body.instructor_id = null;
    if (body.venue_id === '') body.venue_id = null;

    // Active templates only require a name — all other fields are optional
    // and can be resolved by the scheduler/generator at placement time.

    // Validate staff has required skills for this template's subject
    const instructorId = body.instructor_id;
    const requiredSkills = body.required_skills;
    if (instructorId !== undefined || requiredSkills !== undefined) {
      // If instructor_id was explicitly sent (even as null), use it; otherwise fall back to existing
      const finalInstructorId = instructorId !== undefined ? instructorId : existing?.instructor_id;
      const finalSkills = requiredSkills ?? existing?.required_skills;

      if (finalInstructorId && finalSkills?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: instructor } = await (supabase.from('staff') as any)
          .select('skills')
          .eq('id', finalInstructorId)
          .single();

        if (instructor && !skillsMatch(instructor.skills, finalSkills)) {
          return NextResponse.json(
            { error: `Staff member does not teach the required subject(s): ${finalSkills.join(', ')}. Assign a staff member with matching skills or update their skills.` },
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
    logSchedulerActivity({
      user: auth.user,
      action: 'update_template',
      entityName: data?.name ?? existing.name ?? null,
      programId: existing.program_id,
    });
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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = createServiceClient();

    // Verify program access before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tmpl } = await (supabase.from('session_templates') as any)
      .select('program_id, name')
      .eq('id', id)
      .single();

    if (!tmpl?.program_id) {
      return NextResponse.json({ error: 'Template not found or has no program association' }, { status: 403 });
    }

    const accessErr = await requireProgramAccess(auth.user, tmpl.program_id);
    if (accessErr) return accessErr;

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
    logSchedulerActivity({
      user: auth.user,
      action: 'delete_template',
      entityName: tmpl.name ?? null,
      programId: tmpl.program_id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
