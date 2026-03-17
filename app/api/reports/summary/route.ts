/**
 * GET /api/reports/summary
 *
 * Returns aggregated reporting data for a program within a date range.
 *
 * Query params:
 *   - programId   (required) UUID
 *   - startDate   (required) YYYY-MM-DD
 *   - endDate     (required) YYYY-MM-DD
 *
 * Response:
 *   {
 *     hours_by_instructor: [{ instructor_id, name, total_minutes, total_hours }],
 *     hours_by_tag:        [{ tag_id, tag_name, total_minutes, total_hours }],
 *     sessions_by_status:  [{ status, count }],
 *     unassigned_count:    number,
 *     sessions:            SessionWithRelations[]  (for data table + CSV)
 *   }
 *
 * Auth: Uses Supabase service role key (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

interface HoursByInstructor {
  instructor_id: string;
  name: string;
  total_minutes: number;
  total_hours: number;
}

interface HoursByTag {
  tag_id: string;
  tag_name: string;
  total_minutes: number;
  total_hours: number;
}

interface SessionsByStatus {
  status: string;
  count: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!programId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required params: programId, startDate, endDate' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch sessions with relations in the date range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessions, error: sessionsError } = await (supabase.from('sessions') as any)
      .select(`
        *,
        instructor:instructors (id, first_name, last_name, email, skills),
        venue:venues (id, name, space_type),
        template:session_templates (id, grade_groups, required_skills)
      `)
      .eq('program_id', programId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('start_time');

    if (sessionsError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch sessions: ${sessionsError.message}` },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSessions: any[] = sessions ?? [];

    // Fetch session_tags for these sessions
    const sessionIds = allSessions.map((s: { id: string }) => s.id);
    const tagMap = new Map<string, { tag_id: string; tag_name: string }[]>();

    if (sessionIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessionTags } = await (supabase.from('session_tags') as any)
        .select(`
          session_id,
          tag:tags (id, name)
        `)
        .in('session_id', sessionIds);

      if (sessionTags) {
        for (const st of sessionTags) {
          const existing = tagMap.get(st.session_id) ?? [];
          const tag = st.tag as unknown as { id: string; name: string } | null;
          if (tag) {
            existing.push({ tag_id: tag.id, tag_name: tag.name });
          }
          tagMap.set(st.session_id, existing);
        }
      }
    }

    // ----------------------------------------------------------
    // Aggregate: Hours by Instructor
    // ----------------------------------------------------------
    const instructorMinutes = new Map<string, { name: string; total: number }>();
    for (const s of allSessions) {
      if (s.status === 'canceled') continue;
      const inst = s.instructor as unknown as { id: string; first_name: string; last_name: string } | null;
      if (!inst) continue;
      const key = inst.id;
      const existing = instructorMinutes.get(key) ?? {
        name: `${inst.first_name} ${inst.last_name}`,
        total: 0,
      };
      existing.total += s.duration_minutes;
      instructorMinutes.set(key, existing);
    }
    const hoursByInstructor: HoursByInstructor[] = Array.from(instructorMinutes.entries())
      .map(([id, data]) => ({
        instructor_id: id,
        name: data.name,
        total_minutes: data.total,
        total_hours: Math.round((data.total / 60) * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    // ----------------------------------------------------------
    // Aggregate: Hours by Tag
    // Includes BOTH session_tags (additional tags) AND
    // required_skills from templates (event types like Math, Science, etc.)
    // ----------------------------------------------------------
    const tagMinutes = new Map<string, { tag_name: string; total: number }>();
    for (const s of allSessions) {
      if (s.status === 'canceled') continue;

      // 1. Tags from session_tags junction table
      const tags = tagMap.get(s.id) ?? [];
      for (const t of tags) {
        const existing = tagMinutes.get(t.tag_id) ?? { tag_name: t.tag_name, total: 0 };
        existing.total += s.duration_minutes;
        tagMinutes.set(t.tag_id, existing);
      }

      // 2. Event types from template required_skills (these are tag names, not IDs)
      const template = s.template as unknown as { id: string; required_skills: string[] | null } | null;
      const skills = template?.required_skills ?? [];
      for (const skillName of skills) {
        // Use "skill:<name>" as key to avoid collision with tag IDs
        const key = `skill:${skillName}`;
        // Don't double-count if this skill is already in session_tags
        const alreadyCounted = tags.some(t => t.tag_name === skillName);
        if (alreadyCounted) continue;

        const existing = tagMinutes.get(key) ?? { tag_name: skillName, total: 0 };
        existing.total += s.duration_minutes;
        tagMinutes.set(key, existing);
      }
    }
    const hoursByTag: HoursByTag[] = Array.from(tagMinutes.entries())
      .map(([id, data]) => ({
        tag_id: id,
        tag_name: data.tag_name,
        total_minutes: data.total,
        total_hours: Math.round((data.total / 60) * 100) / 100,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);

    // ----------------------------------------------------------
    // Aggregate: Sessions by Status
    // ----------------------------------------------------------
    const statusCounts = new Map<string, number>();
    for (const s of allSessions) {
      statusCounts.set(s.status, (statusCounts.get(s.status) ?? 0) + 1);
    }
    const sessionsByStatus: SessionsByStatus[] = Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // ----------------------------------------------------------
    // Unassigned count (non-canceled sessions with no instructor)
    // ----------------------------------------------------------
    const unassignedCount = allSessions.filter(
      (s) => s.status !== 'canceled' && !s.instructor_id
    ).length;

    // ----------------------------------------------------------
    // Build enriched session list for table/CSV
    // ----------------------------------------------------------
    const enrichedSessions = allSessions.map((s) => {
      const inst = s.instructor as unknown as { id: string; first_name: string; last_name: string } | null;
      const venue = s.venue as unknown as { id: string; name: string; space_type: string } | null;
      const tags = tagMap.get(s.id) ?? [];
      return {
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_minutes: s.duration_minutes,
        status: s.status,
        grade_groups: s.grade_groups,
        is_makeup: s.is_makeup,
        needs_resolution: s.needs_resolution,
        instructor_name: inst ? `${inst.first_name} ${inst.last_name}` : 'Unassigned',
        venue_name: venue ? `${venue.name} - ${venue.space_type}` : 'No Venue',
        tags: [
          // Event types from template required_skills
          ...((s.template as any)?.required_skills ?? []),
          // Additional tags from session_tags (exclude duplicates)
          ...tags.map((t) => t.tag_name).filter(name => !((s.template as any)?.required_skills ?? []).includes(name)),
        ],
        notes: s.notes,
      };
    });

    return NextResponse.json({
      success: true,
      hours_by_instructor: hoursByInstructor,
      hours_by_tag: hoursByTag,
      sessions_by_status: sessionsByStatus,
      unassigned_count: unassignedCount,
      sessions: enrichedSessions,
      total_sessions: allSessions.length,
    });
  } catch (err) {
    console.error('Reports summary API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
