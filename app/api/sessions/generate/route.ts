/**
 * POST /api/sessions/generate
 *
 * Generates draft sessions for the program's date range based on
 * saved template placements from the Templates page.
 *
 * Request body: { program_id: string }
 *
 * Uses the program's start_date and end_date to determine the
 * generation range (e.g. July 2025 – June 2026).
 *
 * Steps:
 *   1. Fetch program (start_date, end_date)
 *   2. Use program's start_date/end_date as generation range
 *   3. Fetch template_placements for the program
 *   4. Fetch session_templates (with instructor/venue joins) for those placements
 *   5. Fetch school_calendar blackout entries for the program
 *   6. Walk day-by-day through the entire year:
 *      - Skip weekends (Sat/Sun)
 *      - Convert JS getDay() (1-5) to day_index (0-4) for matching placements
 *      - Skip blackout dates (no_school, early_dismissal, instructor_exception)
 *      - Skip if a session already exists for the same template+date+time
 *      - Handle rotation_mode='rotate' (null out instructor on alternating weeks)
 *      - Build a draft session row
 *   7. Bulk insert sessions
 *   8. Return created sessions with joined instructor/venue/template data
 *
 * Response: { sessions: [...], total_generated: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a decimal hour (e.g. 9.25 = 9:15 AM) to "HH:MM" string. */
function hourToTimeString(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format a Date as "YYYY-MM-DD". */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { program_id } = await request.json();

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    // 1. Fetch program ---------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: program, error: progError } = await (supabase.from('programs') as any)
      .select('*')
      .eq('id', program_id)
      .single();

    if (progError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // 2. Fetch template placements ---------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: placements, error: placError } = await (supabase.from('template_placements') as any)
      .select('*')
      .eq('program_id', program_id);

    if (placError) {
      return NextResponse.json({ error: placError.message }, { status: 500 });
    }

    if (!placements || placements.length === 0) {
      return NextResponse.json(
        { error: 'No template placements found. Place templates on the weekly grid first.' },
        { status: 400 },
      );
    }

    // 3. Fetch session templates with instructor & venue -----------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateIds = [...new Set(placements.map((p: any) => p.template_id))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templates, error: tplError } = await (supabase.from('session_templates') as any)
      .select('*, venue:venues(id, name)')
      .in('id', templateIds);

    if (tplError) {
      return NextResponse.json({ error: tplError.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateMap = new Map<string, Record<string, any>>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (templates ?? []).map((t: any) => [t.id, t]),
    );

    // 4. Fetch school_calendar blackout entries --------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: blackouts } = await (supabase.from('school_calendar') as any)
      .select('*')
      .eq('program_id', program_id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blackoutMap = new Map<string, any[]>();
    for (const entry of blackouts ?? []) {
      const existing = blackoutMap.get(entry.date) || [];
      existing.push(entry);
      blackoutMap.set(entry.date, existing);
    }

    // 5. Additive upsert strategy — never delete existing sessions.
    //    Fetch ALL existing sessions (draft + non-draft) so we can skip
    //    any (template_id, date, start_time) combo that already exists.
    //    This makes "generate" safe to click multiple times without
    //    creating duplicates, and avoids expensive DELETE operations on
    //    large tables.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allExistingSessions: any[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: page } = await (supabase.from('sessions') as any)
        .select('template_id, date, start_time')
        .eq('program_id', program_id)
        .not('template_id', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (!page || page.length === 0) break;
      allExistingSessions.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const existingSet = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allExistingSessions.map((s: any) => {
        // Normalize time to HH:MM (PostgreSQL returns HH:MM:SS)
        const time = String(s.start_time).slice(0, 5);
        return `${s.template_id}|${s.date}|${time}`;
      }),
    );

    // 6. Generate session rows ------------------------------------------
    // Use program's actual date range instead of calendar year.
    // Walk day-by-day — no Monday math, no offset calculations.
    const startDate = new Date(program.start_date + 'T00:00:00');
    const endDate = new Date(program.end_date + 'T00:00:00');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionRows: any[] = [];
    const rotationCounters = new Map<string, number>();

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      const dateStr = formatDate(currentDate);

      // Only process weekdays (Mon-Fri)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Convert JS day (1-5) to day_index (0-4): Mon=0, Tue=1, Wed=2, Thu=3, Fri=4
        const day_index = dayOfWeek - 1;

        // Find all placements for this day of the week
        for (const placement of placements) {
          if ((placement as { day_index: number }).day_index !== day_index) {
            continue; // Skip placements not for this day
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tpl = templateMap.get((placement as any).template_id);
          if (!tpl) continue;

          const startTime = hourToTimeString((placement as { start_hour: number }).start_hour);
          const endTime = hourToTimeString(
            (placement as { start_hour: number }).start_hour +
              (placement as { duration_hours: number }).duration_hours,
          );

          // Skip blackout dates
          const blackoutsForDate = blackoutMap.get(dateStr) || [];
          let skip = false;

          for (const bo of blackoutsForDate) {
            if (bo.status_type === 'no_school') {
              skip = true;
              break;
            }
            if (bo.status_type === 'early_dismissal' && bo.early_dismissal_time) {
              if (startTime >= bo.early_dismissal_time) {
                skip = true;
                break;
              }
            }
            if (bo.status_type === 'instructor_exception' && bo.target_instructor_id) {
              if (tpl.instructor_id === bo.target_instructor_id) {
                skip = true;
                break;
              }
            }
          }

          if (skip) continue;

          // Skip duplicates
          const key = `${(placement as { template_id: string }).template_id}|${dateStr}|${startTime}`;
          if (existingSet.has(key)) continue;

          // Handle rotation mode
          let instructorId = tpl.instructor_id;
          if (tpl.rotation_mode === 'rotate') {
            const tplId = (placement as { template_id: string }).template_id;
            const count = rotationCounters.get(tplId) ?? 0;
            rotationCounters.set(tplId, count + 1);
            if (count % 2 !== 0) {
              instructorId = null;
            }
          }

          const durationMinutes = Math.round(
            (placement as { duration_hours: number }).duration_hours * 60,
          );

          sessionRows.push({
            program_id,
            template_id: (placement as { template_id: string }).template_id,
            instructor_id: instructorId,
            venue_id: tpl.venue_id,
            grade_groups: tpl.grade_groups ?? [],
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: durationMinutes,
            status: 'draft',
            is_makeup: false,
            needs_resolution: false,
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (sessionRows.length === 0) {
      return NextResponse.json({
        sessions: [],
        total_generated: 0,
        message: 'No new sessions to generate. All dates may already have sessions or fall on blackout days.',
      });
    }

    // 7. Bulk insert ----------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: insertError } = await (supabase.from('sessions') as any)
      .insert(sessionRows)
      .select('*, instructor:instructors(id, first_name, last_name), venue:venues(id, name)');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Attach template metadata so the frontend can build display titles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionsWithTemplate = (created ?? []).map((s: any) => ({
      ...s,
      template: templateMap.get(s.template_id) ?? null,
    }));

    return NextResponse.json(
      { sessions: sessionsWithTemplate, total_generated: sessionsWithTemplate.length },
      { status: 201 },
    );
  } catch (err) {
    console.error('Sessions generate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
