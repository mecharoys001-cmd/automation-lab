/**
 * GET /api/reports/instructor-detail
 *
 * Returns detailed session data for a single instructor, optionally filtered
 * by date range. Provides a weekly breakdown, hours grouped by tag, and totals.
 *
 * Query params:
 *   - instructorId (required) UUID
 *   - startDate    (optional) YYYY-MM-DD
 *   - endDate      (optional) YYYY-MM-DD
 *
 * Response:
 *   {
 *     success: boolean,
 *     instructor: { id, name },
 *     weekly_breakdown: [{ week, hours, session_count }],
 *     hours_by_tag: [{ tag_name, hours, session_count }],
 *     total_hours: number,
 *     total_sessions: number
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireAdmin } from '@/lib/api-auth';

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

/** Returns the Monday (ISO week start) for a given YYYY-MM-DD date string. */
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get('instructorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!instructorId) {
      return NextResponse.json(
        { success: false, error: 'Missing required param: instructorId' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch instructor info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: instructor, error: instructorError } = await (supabase.from('instructors') as any)
      .select('id, first_name, last_name')
      .eq('id', instructorId)
      .single();

    if (instructorError || !instructor) {
      return NextResponse.json(
        { success: false, error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // Fetch sessions for this instructor (exclude canceled)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select('id, name, date, start_time, end_time, duration_minutes, status, venue:venues (id, name), template:session_templates (id, required_skills)')
      .eq('instructor_id', instructorId)
      .neq('status', 'canceled');

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    query = query.order('date');

    const { data: sessions, error: sessionsError } = await query;

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
    const tagMap = new Map<string, { tag_name: string }[]>();

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
          const tag = st.tag as unknown as { id: string; name: string } | null;
          if (!tag) continue;
          const existing = tagMap.get(st.session_id) ?? [];
          existing.push({ tag_name: tag.name });
          tagMap.set(st.session_id, existing);
        }
      }
    }

    // ----------------------------------------------------------
    // Aggregate: Weekly breakdown (week = Monday of ISO week)
    // ----------------------------------------------------------
    const weeklyMap = new Map<string, { minutes: number; count: number; sessions: { name: string; date: string; start_time: string; end_time: string; venue: string }[] }>();
    for (const s of allSessions) {
      const week = getWeekStart(s.date);
      const existing = weeklyMap.get(week) ?? { minutes: 0, count: 0, sessions: [] };
      existing.minutes += s.duration_minutes;
      existing.count += 1;
      const venue = s.venue as unknown as { name: string } | null;
      existing.sessions.push({
        name: s.name ?? 'Untitled',
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        venue: venue?.name ?? '',
      });
      weeklyMap.set(week, existing);
    }
    const weeklyBreakdown = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        hours: Math.round((data.minutes / 60) * 100) / 100,
        session_count: data.count,
        sessions: data.sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)),
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // ----------------------------------------------------------
    // Aggregate: Hours by tag
    // Includes both session_tags AND required_skills from templates
    // ----------------------------------------------------------
    const tagAgg = new Map<string, { minutes: number; count: number }>();
    for (const s of allSessions) {
      const sessionTagNames = new Set<string>();

      // 1. Tags from session_tags junction table
      const tags = tagMap.get(s.id) ?? [];
      for (const t of tags) {
        sessionTagNames.add(t.tag_name);
      }

      // 2. Event types from template required_skills
      const template = s.template as unknown as { id: string; required_skills: string[] | null } | null;
      const skills = template?.required_skills ?? [];
      for (const skillName of skills) {
        sessionTagNames.add(skillName);
      }

      // Aggregate all unique tags for this session
      for (const tagName of sessionTagNames) {
        const existing = tagAgg.get(tagName) ?? { minutes: 0, count: 0 };
        existing.minutes += s.duration_minutes;
        existing.count += 1;
        tagAgg.set(tagName, existing);
      }
    }
    const hoursByTag = Array.from(tagAgg.entries())
      .map(([tagName, data]) => ({
        tag_name: tagName,
        hours: Math.round((data.minutes / 60) * 100) / 100,
        session_count: data.count,
      }))
      .sort((a, b) => b.hours - a.hours);

    // ----------------------------------------------------------
    // Totals
    // ----------------------------------------------------------
    const totalMinutes = allSessions.reduce(
      (sum: number, s: { duration_minutes: number }) => sum + s.duration_minutes,
      0
    );

    return NextResponse.json({
      success: true,
      instructor: {
        id: instructor.id,
        name: `${instructor.first_name} ${instructor.last_name}`,
      },
      weekly_breakdown: weeklyBreakdown,
      hours_by_tag: hoursByTag,
      total_hours: Math.round((totalMinutes / 60) * 100) / 100,
      total_sessions: allSessions.length,
    });
  } catch (err) {
    console.error('Reports instructor-detail API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
