import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

interface TemplateRow {
  name: string;
  day: string;
  start_time?: string;
  end_time?: string;
  duration?: string;
  session_duration?: string;
  venue?: string;
  instructor?: string;
  subjects?: string;
  grades?: string;
  scheduling_mode?: string;
  starts_on?: string;
  ends_on?: string;
  duration_weeks?: string;
  session_count?: string;
  within_weeks?: string;
  week_cycle_length?: string;
  week_in_cycle?: string;
  additional_tags?: string;
}

type SchedulingMode = 'ongoing' | 'date_range' | 'duration' | 'session_count';
const VALID_MODES = new Set<SchedulingMode>(['ongoing', 'date_range', 'duration', 'session_count']);

function parseOptionalInt(val: string | undefined): number | null {
  if (!val?.trim()) return null;
  const n = parseInt(val.trim(), 10);
  return isNaN(n) ? null : n;
}

function parseTime(t: string): string | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function parseDayOfWeek(day: string): number | null {
  const num = parseInt(day, 10);
  if (!isNaN(num) && num >= 0 && num <= 6) return num;
  return DAY_MAP[day.toLowerCase().trim()] ?? null;
}

function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const { rows, program_id } = (await request.json()) as {
      rows: TemplateRow[];
      program_id: string;
    };

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, program_id);
    if (accessErr) return accessErr;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Fetch venues and instructors for name-to-ID mapping (scoped to program)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [venuesRes, instructorsRes] = await Promise.all([
      (supabase.from('venues') as any).select('id, name').eq('program_id', program_id),
      (supabase.from('staff') as any).select('id, first_name, last_name').eq('program_id', program_id),
    ]);

    const venueMap = new Map<string, string>();
    for (const v of venuesRes.data ?? []) {
      venueMap.set(v.name.toLowerCase().trim(), v.id);
    }

    const instructorMap = new Map<string, string>();
    for (const i of instructorsRes.data ?? []) {
      const full = `${i.first_name} ${i.last_name}`.toLowerCase().trim();
      instructorMap.set(full, i.id);
      // Also map by last name only
      instructorMap.set(i.last_name.toLowerCase().trim(), i.id);
    }

    const toInsert: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const row of rows) {
      const dayOfWeek = parseDayOfWeek(row.day);
      const startTime = row.start_time ? parseTime(row.start_time) : null;
      const endTime = row.end_time ? parseTime(row.end_time) : null;

      if (dayOfWeek === null) {
        skipped++;
        continue;
      }

      // If only one of start/end is provided, skip (invalid)
      const hasStart = startTime !== null;
      const hasEnd = endTime !== null;
      if (hasStart !== hasEnd) {
        skipped++;
        continue;
      }

      let duration: number;
      if (hasStart && hasEnd) {
        duration = timeDiffMinutes(startTime!, endTime!);
        if (duration <= 0) {
          skipped++;
          continue;
        }
      } else {
        const parsed = parseOptionalInt(row.session_duration);
        duration = parsed && parsed > 0 ? parsed : 45;
      }

      const venueId = row.venue
        ? venueMap.get(row.venue.toLowerCase().trim()) ?? null
        : null;

      const instructorId = row.instructor
        ? instructorMap.get(row.instructor.toLowerCase().trim()) ?? null
        : null;

      const grades = row.grades
        ? row.grades.split(';').map((g) => g.trim()).filter(Boolean)
        : [];

      const subjects = row.subjects
        ? row.subjects.split(';').map((s) => s.trim()).filter(Boolean)
        : [];

      const additionalTags = row.additional_tags
        ? row.additional_tags.split(';').map((t) => t.trim()).filter(Boolean)
        : [];

      // Scheduling mode
      const rawMode = (row.scheduling_mode?.trim().toLowerCase() || 'ongoing') as SchedulingMode;
      const schedulingMode: SchedulingMode = VALID_MODES.has(rawMode) ? rawMode : 'ongoing';

      const startsOn = row.starts_on?.trim() || null;
      const endsOn = row.ends_on?.trim() || null;
      const durationWeeks = parseOptionalInt(row.duration_weeks);
      const sessionCount = parseOptionalInt(row.session_count);
      const withinWeeks = parseOptionalInt(row.within_weeks);
      const weekCycleLength = parseOptionalInt(row.week_cycle_length);
      const weekInCycle = parseOptionalInt(row.week_in_cycle);

      // Build a display name: use CSV name if provided, otherwise generate from subjects/grades/day
      const templateName = row.name?.trim()
        || (subjects.length > 0
          ? `${subjects.join(', ')}${grades.length > 0 ? ` (${grades.join(', ')})` : ''}`
          : grades.length > 0
            ? `Grades ${grades.join(', ')}`
            : `Template`);

      toInsert.push({
        program_id,
        name: templateName,
        template_type: 'fully_defined',
        rotation_mode: 'consistent',
        day_of_week: dayOfWeek,
        start_time: startTime || null,
        end_time: endTime || null,
        duration_minutes: duration,
        venue_id: venueId,
        instructor_id: instructorId,
        grade_groups: grades,
        required_skills: subjects.length > 0 ? subjects : null,
        additional_tags: additionalTags.length > 0 ? additionalTags : null,
        is_active: true,
        scheduling_mode: schedulingMode,
        starts_on: startsOn,
        ends_on: endsOn,
        duration_weeks: durationWeeks,
        session_count: sessionCount,
        within_weeks: withinWeeks,
        week_cycle_length: weekCycleLength && weekCycleLength > 1 ? weekCycleLength : null,
        week_in_cycle: weekCycleLength && weekCycleLength > 1 ? (weekInCycle ?? 0) : null,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, skipped, total: rows.length });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .insert(toInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-create tags for imported subjects and additional_tags
    const tagValues = new Set<string>();
    for (const row of rows) {
      if (row.subjects) {
        for (const s of row.subjects.split(';').map((v) => v.trim()).filter(Boolean)) {
          tagValues.add(s);
        }
      }
      if (row.additional_tags) {
        for (const t of row.additional_tags.split(';').map((v) => v.trim()).filter(Boolean)) {
          tagValues.add(t);
        }
      }
    }
    if (tagValues.size > 0) {
      const tagRows = Array.from(tagValues).map((name) => ({
        name,
        category: 'Event Type',
        program_id,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: tagError } = await (supabase.from('tags') as any)
        .upsert(tagRows, { onConflict: 'name,program_id', ignoreDuplicates: true });
      if (tagError) console.error('Tag upsert error:', tagError.message);
    }

    trackScheduleChange();

    // Count templates with no subjects (required_skills will be null)
    const noSubjectsCount = toInsert.filter((t) => t.required_skills === null).length;
    const warnings: string[] = [];
    if (noSubjectsCount > 0) {
      warnings.push(
        `${noSubjectsCount} ${noSubjectsCount === 1 ? 'template has' : 'templates have'} no Event Type — ${noSubjectsCount === 1 ? 'it' : 'they'} cannot be published until one is assigned`,
      );
    }

    return NextResponse.json({
      imported: (data ?? []).length,
      skipped,
      total: rows.length,
      warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
