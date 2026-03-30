/**
 * POST /api/exceptions/resolve
 *
 * Resolves a flagged session using one of three resolution types:
 *
 *   1. "substitute"        — Assign a substitute instructor
 *      Body: { session_id, resolution_type: "substitute", instructor_id }
 *      Validates: matching skills, availability, not double-booked
 *
 *   2. "cancel"            — Cancel the session
 *      Body: { session_id, resolution_type: "cancel" }
 *
 *   3. "cancel_reschedule" — Cancel + create draft makeup on makeup_date
 *      Body: { session_id, resolution_type: "cancel_reschedule", makeup_date }
 *      Creates new draft session with replaces_session_id link
 *
 * Auth: Uses Supabase service role key (admin-only server operation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import type { Session, Instructor } from '@/types/database';

type ResolutionType = 'substitute' | 'cancel' | 'cancel_reschedule';

const VALID_RESOLUTION_TYPES: ResolutionType[] = ['substitute', 'cancel', 'cancel_reschedule'];

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Exception resolution (substitute, cancel, reschedule) requires admin role
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { session_id, resolution_type, instructor_id, makeup_date } = body as {
      session_id?: string;
      resolution_type?: string;
      instructor_id?: string;
      makeup_date?: string;
    };

    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid session_id' },
        { status: 400 }
      );
    }
    if (!resolution_type || !VALID_RESOLUTION_TYPES.includes(resolution_type as ResolutionType)) {
      return NextResponse.json(
        { success: false, error: 'resolution_type must be "substitute", "cancel", or "cancel_reschedule"' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch the session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawSession, error: sessionError } = await (supabase.from('sessions') as any)
      .select('*')
      .eq('id', session_id)
      .single();
    const session = rawSession as Session | null;

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify program access
    const accessErr = await requireProgramAccess(auth.user, session.program_id);
    if (accessErr) return accessErr;

    if (!session.needs_resolution) {
      return NextResponse.json(
        { success: false, error: 'Session is not flagged for resolution' },
        { status: 422 }
      );
    }

    switch (resolution_type as ResolutionType) {
      // ----------------------------------------------------------
      // SUBSTITUTE: Assign substitute instructor with validation
      // ----------------------------------------------------------
      case 'substitute': {
        if (!instructor_id || typeof instructor_id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Missing instructor_id for substitute resolution' },
            { status: 400 }
          );
        }

        // Fetch the substitute instructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rawInstructor, error: instError } = await (supabase.from('staff') as any)
          .select('*')
          .eq('id', instructor_id)
          .eq('is_active', true)
          .single();
        const instructor = rawInstructor as Instructor | null;

        if (instError || !instructor) {
          return NextResponse.json(
            { success: false, error: 'Instructor not found or inactive' },
            { status: 404 }
          );
        }

        // Validate skills match (if session has a template with required_skills)
        if (session.template_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: tmplData } = await (supabase.from('session_templates') as any)
            .select('required_skills')
            .eq('id', session.template_id)
            .single();
          const tmpl = tmplData as { required_skills: string[] | null } | null;

          if (tmpl?.required_skills && tmpl.required_skills.length > 0) {
            const instructorSkills = instructor.skills ?? [];
            const missingSkills = tmpl.required_skills.filter(
              (skill: string) => !instructorSkills.includes(skill)
            );
            if (missingSkills.length > 0) {
              return NextResponse.json(
                { success: false, error: `Instructor missing required skills: ${missingSkills.join(', ')}` },
                { status: 422 }
              );
            }
          }
        }

        // Validate availability covers session window
        const sessionDay = new Date(session.date + 'T00:00:00').getDay();
        const dayName = DAY_NAMES[sessionDay];
        const sessionStartMin = timeToMinutes(session.start_time);
        const sessionEndMin = timeToMinutes(session.end_time);

        if (instructor.availability_json) {
          const avail = instructor.availability_json as Record<string, { start: string; end: string }[]>;
          const blocks = avail[dayName];
          if (!blocks || blocks.length === 0) {
            return NextResponse.json(
              { success: false, error: `Instructor not available on ${dayName}` },
              { status: 422 }
            );
          }
          const hasCoverage = blocks.some((block) => {
            const blockStart = timeToMinutes(block.start);
            const blockEnd = timeToMinutes(block.end);
            return blockStart <= sessionStartMin && blockEnd >= sessionEndMin;
          });
          if (!hasCoverage) {
            return NextResponse.json(
              { success: false, error: 'Instructor availability does not cover the session time window' },
              { status: 422 }
            );
          }
        }

        // Validate not already booked (no double-booking)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: conflicts } = await (supabase.from('sessions') as any)
          .select('id, start_time, end_time')
          .eq('staff_id', instructor_id)
          .eq('date', session.date)
          .neq('status', 'canceled')
          .neq('id', session.id);

        if (conflicts && conflicts.length > 0) {
          const hasOverlap = conflicts.some((c: { start_time: string; end_time: string }) => {
            const cStart = timeToMinutes(c.start_time);
            const cEnd = timeToMinutes(c.end_time);
            return sessionStartMin < cEnd && sessionEndMin > cStart;
          });
          if (hasOverlap) {
            return NextResponse.json(
              { success: false, error: 'Instructor is already booked during this time slot' },
              { status: 422 }
            );
          }
        }

        // All validations passed — assign the substitute
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('sessions') as any)
          .update({
            staff_id: instructor_id,
            needs_resolution: false,
          })
          .eq('id', session_id);

        if (updateError) {
          return NextResponse.json(
            { success: false, error: `Failed to assign substitute: ${updateError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          resolution_type: 'substitute',
          session_id,
          instructor_id,
          summary: `Substitute instructor ${instructor.first_name} ${instructor.last_name} assigned.`,
        });
      }

      // ----------------------------------------------------------
      // CANCEL: Cancel the session
      // ----------------------------------------------------------
      case 'cancel': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('sessions') as any)
          .update({
            status: 'canceled',
            needs_resolution: false,
          })
          .eq('id', session_id);

        if (updateError) {
          return NextResponse.json(
            { success: false, error: `Failed to cancel session: ${updateError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          resolution_type: 'cancel',
          session_id,
          summary: 'Session canceled.',
        });
      }

      // ----------------------------------------------------------
      // CANCEL_RESCHEDULE: Cancel + create draft makeup on makeup_date
      // ----------------------------------------------------------
      case 'cancel_reschedule': {
        if (!makeup_date || typeof makeup_date !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Missing makeup_date for cancel_reschedule resolution' },
            { status: 400 }
          );
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(makeup_date)) {
          return NextResponse.json(
            { success: false, error: 'makeup_date must be in YYYY-MM-DD format' },
            { status: 400 }
          );
        }

        // 1. Cancel the original session
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: cancelError } = await (supabase.from('sessions') as any)
          .update({
            status: 'canceled',
            needs_resolution: false,
          })
          .eq('id', session_id);

        if (cancelError) {
          return NextResponse.json(
            { success: false, error: `Failed to cancel session: ${cancelError.message}` },
            { status: 500 }
          );
        }

        // 2. Create the makeup draft session on the specified makeup_date
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: makeupSession, error: insertError } = await (supabase.from('sessions') as any)
          .insert({
            program_id: session.program_id,
            template_id: session.template_id,
            staff_id: session.staff_id,
            venue_id: session.venue_id,
            grade_groups: session.grade_groups,
            date: makeup_date,
            start_time: session.start_time,
            end_time: session.end_time,
            duration_minutes: session.duration_minutes,
            status: 'draft' as const,
            is_makeup: true,
            replaces_session_id: session.id,
            needs_resolution: false,
            notes: `Makeup for canceled session on ${session.date}`,
          })
          .select('id')
          .single();

        if (insertError) {
          return NextResponse.json(
            { success: false, error: `Session canceled but makeup creation failed: ${insertError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          resolution_type: 'cancel_reschedule',
          session_id,
          makeup_session_id: makeupSession?.id ?? null,
          makeup_date,
          summary: `Session canceled. Draft makeup created for ${makeup_date}.`,
        });
      }
    }
  } catch (err) {
    console.error('Exception resolve API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
