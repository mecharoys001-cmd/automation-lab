/**
 * GET /api/exceptions/substitute-candidates?session_id=<uuid>
 *
 * Returns eligible substitute instructors for a flagged session.
 * Filters by:
 *   1. Active status
 *   2. Skills matching the session template's required_skills
 *   3. Availability covering the session's day/time window
 *   4. No double-booking on the session date
 *   5. Excludes the session's current instructor
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { Session, Instructor } from '@/types/database';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch the session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawSession, error: sessionError } = await (supabase.from('sessions') as any)
      .select('*')
      .eq('id', sessionId)
      .single();
    const session = rawSession as Session | null;

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch all active instructors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawInstructors, error: instError } = await (supabase.from('instructors') as any)
      .select('id, first_name, last_name, skills, availability_json, is_active')
      .eq('is_active', true)
      .order('last_name');

    if (instError || !rawInstructors) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch instructors' },
        { status: 500 }
      );
    }

    let candidates = rawInstructors as Pick<Instructor, 'id' | 'first_name' | 'last_name' | 'skills' | 'availability_json' | 'is_active'>[];

    // Filter: skills match (if session has a template with required_skills)
    if (session.template_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tmplData } = await (supabase.from('session_templates') as any)
        .select('required_skills')
        .eq('id', session.template_id)
        .single();
      const tmpl = tmplData as { required_skills: string[] | null } | null;

      if (tmpl?.required_skills && tmpl.required_skills.length > 0) {
        const required = tmpl.required_skills;
        candidates = candidates.filter((c) => {
          if (!c.skills) return false;
          return required.every((skill: string) => c.skills!.includes(skill));
        });
      }
    }

    // Filter: availability covers session window
    const sessionDay = new Date(session.date + 'T00:00:00').getDay();
    const dayName = DAY_NAMES[sessionDay];
    const sessionStartMin = timeToMinutes(session.start_time);
    const sessionEndMin = timeToMinutes(session.end_time);

    candidates = candidates.filter((c) => {
      if (!c.availability_json) return true;
      const avail = c.availability_json as Record<string, { start: string; end: string }[]>;
      const blocks = avail[dayName];
      if (!blocks || blocks.length === 0) return false;
      return blocks.some((block: { start: string; end: string }) => {
        const blockStart = timeToMinutes(block.start);
        const blockEnd = timeToMinutes(block.end);
        return blockStart <= sessionStartMin && blockEnd >= sessionEndMin;
      });
    });

    // Filter: not double-booked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conflicts } = await (supabase.from('sessions') as any)
      .select('instructor_id, start_time, end_time')
      .eq('date', session.date)
      .neq('status', 'canceled')
      .neq('id', session.id);

    if (conflicts) {
      const bookedInstructors = new Set<string>();
      for (const c of conflicts as { instructor_id: string | null; start_time: string; end_time: string }[]) {
        if (!c.instructor_id) continue;
        const cStart = timeToMinutes(c.start_time);
        const cEnd = timeToMinutes(c.end_time);
        if (sessionStartMin < cEnd && sessionEndMin > cStart) {
          bookedInstructors.add(c.instructor_id);
        }
      }
      candidates = candidates.filter((c) => !bookedInstructors.has(c.id));
    }

    // Exclude the original instructor
    if (session.instructor_id) {
      candidates = candidates.filter((c) => c.id !== session.instructor_id);
    }

    return NextResponse.json({
      success: true,
      candidates: candidates.map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        skills: c.skills,
      })),
    });
  } catch (err) {
    console.error('Substitute candidates API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
