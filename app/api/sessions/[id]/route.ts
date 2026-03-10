import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { skillsMatch } from '@/lib/scheduler/utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    // Validate instructor has required skills for the session's template subject
    if (body.instructor_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: session } = await (supabase.from('sessions') as any)
        .select('template_id')
        .eq('id', id)
        .single();

      if (session?.template_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: template } = await (supabase.from('session_templates') as any)
          .select('required_skills')
          .eq('id', session.template_id)
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
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('sessions') as any)
      .update(body)
      .eq('id', id)
      .select(`
        *,
        instructor:instructors(*),
        venue:venues(*),
        session_tags(tag:tags(*))
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten session_tags into tags array
    const { session_tags, ...rest } = data as Record<string, unknown>;
    const tags = Array.isArray(session_tags)
      ? (session_tags as Record<string, unknown>[]).map((st) => st.tag).filter(Boolean)
      : [];

    trackScheduleChange();
    return NextResponse.json({ session: { ...rest, tags } });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any)
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
