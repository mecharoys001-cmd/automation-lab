/**
 * POST /api/seed
 *
 * Seeds the database with mock data via Supabase client.
 * Clears all existing data first, then recreates venues, programs,
 * tags, instructors, templates, sessions, and calendar entries.
 *
 * Response: { success, counts: { instructors, templates, sessions, ... } }
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function POST() {
  try {
    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // ── Clear existing data in FK-safe order ─────────────────
    await sb.from('notification_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('session_tags').delete().neq('session_id', '00000000-0000-0000-0000-000000000000');
    await sb.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('session_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('school_calendar').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('program_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('programs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('instructors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('tags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('venues').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // ── Venues ───────────────────────────────────────────────
    const { data: venuesData } = await sb.from('venues').insert([
      { name: 'Stage',          space_type: 'performance',  is_virtual: false },
      { name: 'Classroom',      space_type: 'classroom',    is_virtual: false },
      { name: 'Google Meet',    space_type: 'virtual',      is_virtual: true },
      { name: 'Cafegymatorium', space_type: 'multipurpose', is_virtual: false },
    ]).select();

    const venueMap: Record<string, string> = {};
    for (const v of venuesData ?? []) venueMap[v.name] = v.id;

    // ── Program ──────────────────────────────────────────────
    const { data: programData } = await sb.from('programs').insert({
      name: 'Symphonix 2025-2026',
      start_date: '2025-11-03',
      end_date: '2026-06-12',
    }).select().single();

    const programId = programData?.id;
    if (!programId) {
      return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
    }

    // ── Tags ─────────────────────────────────────────────────
    const { data: tagsData } = await sb.from('tags').insert([
      { name: 'Lead TAs Away',              color: '#6366F1' },
      { name: 'TA Check-ins',               color: '#8B5CF6' },
      { name: 'Field Trip / Guest Artist',  color: '#EF4444' },
      { name: 'Showcase',                   color: '#EC4899' },
      { name: 'Choral Sessions',            color: '#F59E0B' },
      { name: 'Percussion Sessions',        color: '#10B981' },
    ]).select();

    const tagMap: Record<string, string> = {};
    for (const t of tagsData ?? []) tagMap[t.name] = t.id;
    const tagIds = Object.values(tagMap);

    // ── School Calendar — blackout dates ─────────────────────
    const blackoutDates = [
      { date: '2025-11-11', description: 'Veterans Day' },
      ...dateRange('2025-11-26', '2025-11-28').map(d => ({ date: d, description: 'Thanksgiving Break' })),
      ...dateRange('2025-12-22', '2026-01-02').map(d => ({ date: d, description: 'December Break' })),
      { date: '2026-01-19', description: 'MLK Day' },
      ...dateRange('2026-02-16', '2026-02-17').map(d => ({ date: d, description: 'Presidents Weekend' })),
      ...dateRange('2026-04-06', '2026-04-10').map(d => ({ date: d, description: 'Spring Break' })),
      { date: '2026-05-25', description: 'Memorial Day' },
    ];

    await sb.from('school_calendar').insert(
      blackoutDates.map(d => ({
        program_id: programId,
        date: d.date,
        description: d.description,
        status_type: 'no_school',
      }))
    );

    // Additional calendar entries: early dismissals + instructor exceptions
    await sb.from('school_calendar').insert([
      { program_id: programId, date: '2025-12-19', description: 'Last Day Before Break — Early Dismissal', status_type: 'early_dismissal', early_dismissal_time: '12:30' },
      { program_id: programId, date: '2026-01-30', description: 'Professional Development Half Day', status_type: 'early_dismissal', early_dismissal_time: '12:00' },
      { program_id: programId, date: '2026-02-06', description: 'Parent Conference Day — Early Release', status_type: 'early_dismissal', early_dismissal_time: '13:00' },
    ]);

    // ── Program Rules ────────────────────────────────────────
    await sb.from('program_rules').insert([
      { program_id: programId, rule_type: 'blackout_day', day_of_week: 0, description: 'No sessions on Sundays' },
      { program_id: programId, rule_type: 'blackout_day', day_of_week: 6, description: 'No sessions on Saturdays' },
    ]);

    // ── Instructors ──────────────────────────────────────────
    const { data: instructorsData } = await sb.from('instructors').insert([
      { first_name: 'Maria',  last_name: 'Santos',    email: 'maria.santos@example.com',    phone: '(212) 555-0101', skills: ['Strings', 'Choral'],       availability_json: { monday: [{ start: '09:00', end: '15:00' }], wednesday: [{ start: '09:00', end: '15:00' }], thursday: [{ start: '10:00', end: '14:00' }] },                    is_active: true, notes: 'Lead strings instructor. 5 years with Symphonix.' },
      { first_name: 'James',  last_name: 'Wilson',    email: 'james.wilson@example.com',    phone: '(212) 555-0102', skills: ['Percussion'],              availability_json: { monday: [{ start: '08:00', end: '16:00' }], tuesday: [{ start: '08:00', end: '16:00' }], wednesday: [{ start: '08:00', end: '16:00' }], thursday: [{ start: '08:00', end: '16:00' }] }, is_active: true, notes: 'Drum circle expert.' },
      { first_name: 'Aisha',  last_name: 'Johnson',   email: 'aisha.johnson@example.com',   phone: '(212) 555-0103', skills: ['Woodwinds', 'Brass'],      availability_json: { tuesday: [{ start: '09:00', end: '15:00' }], thursday: [{ start: '09:00', end: '15:00' }], friday: [{ start: '09:00', end: '13:00' }] },                    is_active: true, notes: 'Clarinet and trumpet specialist.' },
      { first_name: 'David',  last_name: 'Chen',      email: 'david.chen@example.com',      phone: '(212) 555-0104', skills: ['Strings'],                 availability_json: { monday: [{ start: '10:00', end: '15:00' }], wednesday: [{ start: '10:00', end: '15:00' }] },                                                                     is_active: true, notes: 'Violin/viola specialist. Prefers K-4.' },
      { first_name: 'Rachel', last_name: 'Kim',       email: 'rachel.kim@example.com',      phone: '(212) 555-0105', skills: ['Choral', 'Woodwinds'],     availability_json: { monday: [{ start: '08:00', end: '14:00' }], tuesday: [{ start: '08:00', end: '14:00' }], wednesday: [{ start: '08:00', end: '14:00' }], thursday: [{ start: '08:00', end: '14:00' }] }, is_active: true, notes: 'Voice and flute. Very flexible schedule.' },
      { first_name: 'Marcus', last_name: 'Brown',     email: 'marcus.brown@example.com',    phone: '(212) 555-0106', skills: ['Percussion', 'Brass'],     availability_json: { wednesday: [{ start: '09:00', end: '16:00' }], thursday: [{ start: '09:00', end: '16:00' }], friday: [{ start: '09:00', end: '16:00' }] },                    is_active: true, notes: 'Jazz percussion and brass.' },
      { first_name: 'Sofia',  last_name: 'Rodriguez', email: 'sofia.rodriguez@example.com', phone: null,             skills: ['Strings', 'Choral'],       availability_json: { monday: [{ start: '11:00', end: '15:00' }], tuesday: [{ start: '11:00', end: '15:00' }], wednesday: [{ start: '11:00', end: '15:00' }] },                    is_active: true, notes: 'Bilingual instruction (English/Spanish).' },
      { first_name: 'Andre',  last_name: 'Thompson',  email: 'andre.thompson@example.com',  phone: '(212) 555-0108', skills: ['Brass'],                   availability_json: { monday: [{ start: '09:00', end: '14:00' }], thursday: [{ start: '09:00', end: '14:00' }] },                                                                     is_active: true, notes: 'Trumpet and trombone. Part-time.' },
      { first_name: 'Emily',  last_name: 'Park',      email: 'emily.park@example.com',      phone: '(212) 555-0109', skills: ['Woodwinds'],               availability_json: { tuesday: [{ start: '10:00', end: '15:00' }], friday: [{ start: '10:00', end: '15:00' }] },                                                                     is_active: false, notes: 'On leave until January 2026.' },
      { first_name: 'Carlos', last_name: 'Mendez',    email: 'carlos.mendez@example.com',   phone: '(212) 555-0110', skills: ['Percussion', 'Strings'],   availability_json: { monday: [{ start: '08:00', end: '15:00' }], tuesday: [{ start: '08:00', end: '15:00' }], wednesday: [{ start: '08:00', end: '15:00' }], thursday: [{ start: '08:00', end: '15:00' }], friday: [{ start: '08:00', end: '13:00' }] }, is_active: true, notes: 'Versatile. Can sub for any role.' },
    ]).select();

    const instIds = (instructorsData ?? []).map((i: { id: string }) => i.id);

    // Instructor exception calendar entries (now that we have IDs)
    if (instIds.length >= 2) {
      await sb.from('school_calendar').insert([
        { program_id: programId, date: '2026-01-12', description: 'Maria Santos — personal day', status_type: 'instructor_exception', target_instructor_id: instIds[0] },
        { program_id: programId, date: '2026-02-09', description: 'James Wilson — conference',    status_type: 'instructor_exception', target_instructor_id: instIds[1] },
      ]);
    }

    // ── Event Templates — Full weekly pattern ──────────────
    // Mix of fixed-time (~40%) and flexible/NULL-time (~60%) templates
    // Durations: 30, 45, 60, 90 min — Grades K-8 — Subjects: Strings, Percussion, Choral, Woodwinds, Brass, Theory, Ensemble
    const templateDefs: Array<{
      day_of_week: number; grade_groups: string[];
      start_time: string | null; end_time: string | null; duration_minutes: number;
      venue: string; skills: string[]; sort_order: number;
    }> = [
      // ── Monday (day_of_week=1) ──
      { day_of_week: 1, grade_groups: ['2'],      start_time: '08:00', end_time: '08:30', duration_minutes: 30, venue: 'Classroom',      skills: ['Choral'],      sort_order: 1 },
      { day_of_week: 1, grade_groups: ['K'],      start_time: '12:00', end_time: '12:45', duration_minutes: 45, venue: 'Stage',          skills: ['Strings'],     sort_order: 2 },
      { day_of_week: 1, grade_groups: ['1'],      start_time: '12:50', end_time: '13:35', duration_minutes: 45, venue: 'Stage',          skills: ['Strings'],     sort_order: 3 },
      { day_of_week: 1, grade_groups: ['3', '4'], start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Cafegymatorium', skills: ['Percussion'],  sort_order: 4 },
      { day_of_week: 1, grade_groups: ['5'],      start_time: null,    end_time: null,     duration_minutes: 60, venue: 'Stage',          skills: ['Woodwinds'],   sort_order: 5 },

      // ── Tuesday (day_of_week=2) ──
      { day_of_week: 2, grade_groups: ['3', '4', '5'], start_time: '12:30', end_time: '13:30', duration_minutes: 60, venue: 'Classroom',  skills: ['Woodwinds'],   sort_order: 1 },
      { day_of_week: 2, grade_groups: ['5'],            start_time: null,    end_time: null,     duration_minutes: 30, venue: 'Classroom',  skills: ['Theory'],      sort_order: 2 },
      { day_of_week: 2, grade_groups: ['1'],            start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Stage',      skills: ['Choral'],      sort_order: 3 },
      { day_of_week: 2, grade_groups: ['6'],            start_time: '14:00', end_time: '15:00',  duration_minutes: 60, venue: 'Stage',      skills: ['Strings'],     sort_order: 4 },
      { day_of_week: 2, grade_groups: ['4'],            start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Classroom',  skills: ['Strings'],     sort_order: 5 },

      // ── Wednesday (day_of_week=3) ──
      { day_of_week: 3, grade_groups: ['K'],      start_time: '12:00', end_time: '12:45', duration_minutes: 45, venue: 'Stage',          skills: ['Strings'],     sort_order: 1 },
      { day_of_week: 3, grade_groups: ['1'],      start_time: '12:50', end_time: '13:35', duration_minutes: 45, venue: 'Stage',          skills: ['Strings'],     sort_order: 2 },
      { day_of_week: 3, grade_groups: ['2'],      start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Classroom',      skills: ['Choral'],      sort_order: 3 },
      { day_of_week: 3, grade_groups: ['3', '4'], start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Cafegymatorium', skills: ['Percussion'],  sort_order: 4 },
      { day_of_week: 3, grade_groups: ['5'],      start_time: null,    end_time: null,     duration_minutes: 60, venue: 'Google Meet',    skills: ['Theory'],      sort_order: 5 },

      // ── Thursday (day_of_week=4) ──
      { day_of_week: 4, grade_groups: ['5'],      start_time: '10:00', end_time: '10:45', duration_minutes: 45, venue: 'Stage',          skills: ['Brass'],       sort_order: 1 },
      { day_of_week: 4, grade_groups: ['6'],      start_time: '14:00', end_time: '15:00', duration_minutes: 60, venue: 'Classroom',      skills: ['Woodwinds'],   sort_order: 2 },
      { day_of_week: 4, grade_groups: ['7'],      start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Cafegymatorium', skills: ['Percussion'],  sort_order: 3 },
      { day_of_week: 4, grade_groups: ['8'],      start_time: null,    end_time: null,     duration_minutes: 60, venue: 'Stage',          skills: ['Strings'],     sort_order: 4 },
      { day_of_week: 4, grade_groups: ['7', '8'], start_time: '15:30', end_time: '17:00', duration_minutes: 90, venue: 'Stage',          skills: ['Ensemble'],    sort_order: 5 },
      { day_of_week: 4, grade_groups: ['K'],      start_time: null,    end_time: null,     duration_minutes: 30, venue: 'Classroom',      skills: ['Choral'],      sort_order: 6 },

      // ── Friday (day_of_week=5) ──
      { day_of_week: 5, grade_groups: ['K'],      start_time: '08:00', end_time: '08:30', duration_minutes: 30, venue: 'Classroom',      skills: ['Choral'],      sort_order: 1 },
      { day_of_week: 5, grade_groups: ['7', '8'], start_time: '10:00', end_time: '11:00', duration_minutes: 60, venue: 'Cafegymatorium', skills: ['Brass'],       sort_order: 2 },
      { day_of_week: 5, grade_groups: ['6'],      start_time: null,    end_time: null,     duration_minutes: 30, venue: 'Google Meet',    skills: ['Theory'],      sort_order: 3 },
      { day_of_week: 5, grade_groups: ['4'],      start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Cafegymatorium', skills: ['Percussion'],  sort_order: 4 },
      { day_of_week: 5, grade_groups: ['3'],      start_time: null,    end_time: null,     duration_minutes: 45, venue: 'Stage',          skills: ['Strings'],     sort_order: 5 },
    ];

    const { data: templatesData, error: templatesError } = await sb.from('session_templates').insert(
      templateDefs.map(t => ({
        program_id: programId,
        day_of_week: t.day_of_week,
        grade_groups: t.grade_groups,
        start_time: t.start_time,
        end_time: t.end_time,
        duration_minutes: t.duration_minutes,
        venue_id: venueMap[t.venue],
        required_skills: t.skills,
        sort_order: t.sort_order,
        is_active: true,
      }))
    ).select();

    if (templatesError) {
      console.error('Template insert error:', templatesError);
      return NextResponse.json({ error: 'Failed to create templates: ' + templatesError.message }, { status: 500 });
    }

    const templates = templatesData ?? [];
    console.log('Templates created:', templates.length);

    // ── Generate Sessions ────────────────────────────────────
    const blackoutSet = new Set(blackoutDates.map(d => d.date));
    const sessionInserts: Array<Record<string, unknown>> = [];
    const sessionTagPairs: Array<{ session_id: string; tag_id: string }> = [];
    let sessCount = 0;

    const dates = dateRange('2025-11-03', '2026-02-28');
    for (const dateStr of dates) {
      const d = new Date(dateStr + 'T12:00:00Z');
      const dow = d.getUTCDay();

      // Skip weekends
      if (dow === 0 || dow === 6) continue;
      // Skip blackout dates
      if (blackoutSet.has(dateStr)) continue;

      // Get templates for this day
      const dayTemplates = templates.filter(
        (t: { day_of_week: number }) => t.day_of_week === dow
      );

      for (let ti = 0; ti < dayTemplates.length; ti++) {
        const tmpl = dayTemplates[ti];
        // Rotate instructors
        const instIdx = (sessCount) % instIds.length;

        // Status distribution: ~60% draft, ~25% published, ~10% canceled, ~5% completed
        const r = Math.random();
        let status: string;
        if (r < 0.05) status = 'completed';
        else if (r < 0.15) status = 'canceled';
        else if (r < 0.40) status = 'published';
        else status = 'draft';

        sessionInserts.push({
          program_id: programId,
          template_id: tmpl.id,
          instructor_id: instIds[instIdx],
          venue_id: tmpl.venue_id,
          grade_groups: tmpl.grade_groups,
          date: dateStr,
          start_time: tmpl.start_time,
          end_time: tmpl.end_time,
          duration_minutes: tmpl.duration_minutes,
          status,
          is_makeup: false,
          needs_resolution: false,
        });

        sessCount++;
      }
    }

    // Batch insert sessions (Supabase supports up to 1000 rows per insert)
    const allSessionIds: string[] = [];
    const canceledIds: string[] = [];

    for (let i = 0; i < sessionInserts.length; i += 500) {
      const batch = sessionInserts.slice(i, i + 500);
      const { data: batchData } = await sb.from('sessions').insert(batch).select('id, status');
      for (const s of batchData ?? []) {
        allSessionIds.push(s.id);
        if (s.status === 'canceled') canceledIds.push(s.id);
      }
    }

    // Tag ~30% of sessions randomly
    for (const sid of allSessionIds) {
      if (Math.random() < 0.30 && tagIds.length > 0) {
        sessionTagPairs.push({
          session_id: sid,
          tag_id: tagIds[Math.floor(Math.random() * tagIds.length)],
        });
      }
    }

    if (sessionTagPairs.length > 0) {
      for (let i = 0; i < sessionTagPairs.length; i += 500) {
        const batch = sessionTagPairs.slice(i, i + 500);
        await sb.from('session_tags').upsert(batch, { onConflict: 'session_id,tag_id' });
      }
    }

    // ── Makeup Sessions (up to 6) ────────────────────────────
    let makeupCount = 0;
    for (let i = 0; i < Math.min(6, canceledIds.length); i++) {
      const { data: orig } = await sb.from('sessions')
        .select('*')
        .eq('id', canceledIds[i])
        .single();

      if (orig) {
        const makeupDate = new Date(orig.date + 'T12:00:00Z');
        makeupDate.setUTCDate(makeupDate.getUTCDate() + 7);

        await sb.from('sessions').insert({
          program_id: programId,
          template_id: orig.template_id,
          instructor_id: instIds[Math.floor(Math.random() * instIds.length)],
          venue_id: orig.venue_id,
          grade_groups: orig.grade_groups,
          date: makeupDate.toISOString().split('T')[0],
          start_time: orig.start_time,
          end_time: orig.end_time,
          duration_minutes: orig.duration_minutes,
          status: 'draft',
          is_makeup: true,
          replaces_session_id: canceledIds[i],
          notes: 'Makeup for canceled session on ' + orig.date,
        });
        makeupCount++;
      }
    }

    // ── Flag 4 sessions as needing resolution ────────────────
    const { data: toFlag } = await sb.from('sessions')
      .select('id')
      .eq('program_id', programId)
      .eq('status', 'draft')
      .eq('needs_resolution', false)
      .eq('is_makeup', false)
      .limit(4);

    let flaggedCount = 0;
    for (const s of toFlag ?? []) {
      await sb.from('sessions')
        .update({ needs_resolution: true, notes: 'Calendar conflict — instructor unavailable' })
        .eq('id', s.id);
      flaggedCount++;
    }

    return NextResponse.json({
      success: true,
      message: 'Mock data seeded successfully.',
      counts: {
        instructors: instIds.length,
        venues: (venuesData ?? []).length,
        programs: 1,
        templates: templates.length,
        sessions: allSessionIds.length,
        tags: (tagsData ?? []).length,
        session_tags: sessionTagPairs.length,
        makeups: makeupCount,
        flagged: flaggedCount,
        calendar_entries: blackoutDates.length + 5,
      },
    });
  } catch (err) {
    console.error('Seed API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (current <= last) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
