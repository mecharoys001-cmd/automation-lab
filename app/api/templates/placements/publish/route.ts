/**
 * POST /api/templates/placements/publish
 *
 * Converts draft template placements into actual scheduled sessions.
 * For each placement, creates a session row in the `sessions` table
 * for the upcoming week (next occurrence of each day).
 *
 * Request body:
 *   program_id: string
 *   placements: Array<{
 *     templateId: string;
 *     dayIndex: number;       // 0=Mon … 4=Fri
 *     startHour: number;      // e.g. 9.25 = 9:15 AM
 *     durationHours: number;  // e.g. 1.5 = 90 min
 *   }>
 *
 * Response: { sessions_created: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

function hourToTimeString(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get the next date for a given day-of-week index (0=Mon … 4=Fri).
 * Returns the coming occurrence starting from today.
 */
function getNextDateForDay(dayIndex: number): string {
  const now = new Date();
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat
  // Our dayIndex: 0=Mon … 4=Fri → JS day = dayIndex + 1
  const targetJsDay = dayIndex + 1;
  const currentJsDay = now.getDay();
  let diff = targetJsDay - currentJsDay;
  if (diff <= 0) diff += 7; // push to next week if day already passed
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return target.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { program_id, placements } = await request.json();

    if (!program_id || !Array.isArray(placements) || placements.length === 0) {
      return NextResponse.json(
        { error: 'program_id and a non-empty placements array are required' },
        { status: 400 },
      );
    }

    // Fetch template details so we can populate grade_groups etc.
    const templateIds = [...new Set(placements.map((p: { templateId: string }) => p.templateId))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templateData, error: tplError } = await (supabase.from('session_templates') as any)
      .select('*')
      .in('id', templateIds);

    if (tplError) {
      return NextResponse.json({ error: tplError.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateMap = new Map((templateData ?? []).map((t: any) => [t.id, t]));

    // Build session rows
    const sessionRows = placements.map(
      (p: { templateId: string; dayIndex: number; startHour: number; durationHours: number }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tpl = templateMap.get(p.templateId) as Record<string, any> | undefined;
        const startTime = hourToTimeString(p.startHour);
        const endTime = hourToTimeString(p.startHour + p.durationHours);
        const durationMinutes = Math.round(p.durationHours * 60);

        return {
          program_id,
          template_id: p.templateId,
          instructor_id: tpl?.instructor_id ?? null,
          venue_id: tpl?.venue_id ?? null,
          grade_groups: tpl?.grade_groups ?? [],
          date: getNextDateForDay(p.dayIndex),
          start_time: startTime,
          end_time: endTime,
          duration_minutes: durationMinutes,
          status: 'draft',
          is_makeup: false,
          needs_resolution: false,
        };
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: insertError } = await (supabase.from('sessions') as any)
      .insert(sessionRows)
      .select('id');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ sessions_created: created?.length ?? 0 }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
