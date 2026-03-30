/**
 * POST /api/seed/instructors
 *
 * Seeds the database with instructors covering all subject areas
 * from session_templates required_skills.
 *
 * 1. Queries session_templates for unique required_skills
 * 2. Combines with the full subject list to ensure coverage
 * 3. Creates ~45 instructors with appropriate skills and availability
 *
 * Query params:
 *   ?clear=true  — delete existing instructors first (default: false)
 *
 * Response: { success, created, subjects_covered }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';

// Availability presets (Mon-Fri variations)
const FULL_WEEK = {
  monday:    [{ start: '08:00', end: '15:00' }],
  tuesday:   [{ start: '08:00', end: '15:00' }],
  wednesday: [{ start: '08:00', end: '15:00' }],
  thursday:  [{ start: '08:00', end: '15:00' }],
  friday:    [{ start: '08:00', end: '15:00' }],
};

const MWF = {
  monday:    [{ start: '08:00', end: '15:00' }],
  wednesday: [{ start: '08:00', end: '15:00' }],
  friday:    [{ start: '08:00', end: '15:00' }],
};

const TTH = {
  tuesday:  [{ start: '08:00', end: '15:00' }],
  thursday: [{ start: '08:00', end: '15:00' }],
};

const MTWTH = {
  monday:    [{ start: '09:00', end: '14:00' }],
  tuesday:   [{ start: '09:00', end: '14:00' }],
  wednesday: [{ start: '09:00', end: '14:00' }],
  thursday:  [{ start: '09:00', end: '14:00' }],
};

const MTWF = {
  monday:    [{ start: '08:00', end: '15:00' }],
  tuesday:   [{ start: '08:00', end: '15:00' }],
  wednesday: [{ start: '08:00', end: '15:00' }],
  friday:    [{ start: '08:00', end: '13:00' }],
};

const WTHF = {
  wednesday: [{ start: '09:00', end: '15:00' }],
  thursday:  [{ start: '09:00', end: '15:00' }],
  friday:    [{ start: '09:00', end: '15:00' }],
};

const MW_LATE = {
  monday:    [{ start: '10:00', end: '15:00' }],
  wednesday: [{ start: '10:00', end: '15:00' }],
};

const TTHF = {
  tuesday:  [{ start: '08:00', end: '15:00' }],
  thursday: [{ start: '08:00', end: '15:00' }],
  friday:   [{ start: '08:00', end: '15:00' }],
};

// Instructor definitions: realistic names, skills, and varied availability
const INSTRUCTOR_DEFS: Array<{
  first_name: string;
  last_name: string;
  skills: string[];
  availability_json: Record<string, Array<{ start: string; end: string }>>;
  notes: string;
}> = [
  // ── Music (multiple specialists + generalists) ──────────
  { first_name: 'Maria',   last_name: 'Santos',     skills: ['Strings', 'Orchestra'],              availability_json: FULL_WEEK, notes: 'Lead strings instructor. 5 years with program.' },
  { first_name: 'James',   last_name: 'Wilson',     skills: ['Percussion', 'Band'],                availability_json: MTWTH,     notes: 'Drum circle and marching band expert.' },
  { first_name: 'Aisha',   last_name: 'Johnson',    skills: ['Woodwinds', 'Brass'],                availability_json: TTHF,      notes: 'Clarinet and trumpet specialist.' },
  { first_name: 'David',   last_name: 'Chen',       skills: ['Strings', 'Guitar'],                 availability_json: MWF,       notes: 'Violin/viola/guitar. Prefers younger grades.' },
  { first_name: 'Rachel',  last_name: 'Kim',        skills: ['Choral', 'Choir'],                   availability_json: FULL_WEEK, notes: 'Voice instructor. Very flexible schedule.' },
  { first_name: 'Marcus',  last_name: 'Brown',      skills: ['Percussion', 'Brass', 'Band'],       availability_json: WTHF,      notes: 'Jazz percussion and brass.' },
  { first_name: 'Sofia',   last_name: 'Rodriguez',  skills: ['Piano', 'Music'],                    availability_json: MTWF,      notes: 'Bilingual instruction (English/Spanish).' },
  { first_name: 'Andre',   last_name: 'Thompson',   skills: ['Brass', 'Band'],                     availability_json: TTH,       notes: 'Trumpet and trombone. Part-time.' },
  { first_name: 'Carlos',  last_name: 'Mendez',     skills: ['Percussion', 'Strings', 'Piano'],    availability_json: FULL_WEEK, notes: 'Versatile musician. Can sub for most roles.' },
  { first_name: 'Emily',   last_name: 'Nakamura',   skills: ['Woodwinds', 'Orchestra'],            availability_json: MWF,       notes: 'Flute and oboe specialist.' },
  { first_name: 'Tyrone',  last_name: 'Davis',      skills: ['Guitar', 'Music'],                   availability_json: MTWTH,     notes: 'Acoustic and electric guitar.' },
  { first_name: 'Lillian', last_name: 'Choi',       skills: ['Choral', 'Choir', 'Music'],          availability_json: FULL_WEEK, notes: 'Choir director with 10 years experience.' },

  // ── Sciences ────────────────────────────────────────────
  { first_name: 'Robert',  last_name: 'Patel',      skills: ['Physics', 'Astronomy'],              availability_json: FULL_WEEK, notes: 'AP Physics certified. Runs astronomy club.' },
  { first_name: 'Sandra',  last_name: 'Liu',        skills: ['Chemistry', 'Science'],              availability_json: MTWF,      notes: 'Chemistry lab safety certified.' },
  { first_name: 'Michael', last_name: 'Torres',     skills: ['Biology', 'Science'],                availability_json: MWF,       notes: 'Marine biology background.' },
  { first_name: 'Priya',   last_name: 'Sharma',     skills: ['Science', 'Biology', 'Chemistry'],   availability_json: FULL_WEEK, notes: 'General science. Great with younger students.' },

  // ── Math ────────────────────────────────────────────────
  { first_name: 'Kevin',   last_name: 'O\'Brien',   skills: ['Math'],                              availability_json: FULL_WEEK, notes: 'Algebra and geometry specialist.' },
  { first_name: 'Fatima',  last_name: 'Al-Rashid',  skills: ['Math', 'Economics'],                 availability_json: MTWTH,     notes: 'Statistics and applied math.' },

  // ── Humanities & Social Studies ─────────────────────────
  { first_name: 'Thomas',  last_name: 'McCarthy',   skills: ['History', 'Civics'],                 availability_json: FULL_WEEK, notes: 'US and world history.' },
  { first_name: 'Diana',   last_name: 'Okafor',     skills: ['Geography', 'History'],              availability_json: MTWF,      notes: 'Cultural geography focus.' },
  { first_name: 'Nathan',  last_name: 'Goldstein',  skills: ['Economics', 'Psychology'],            availability_json: TTH,       notes: 'Behavioral economics background.' },
  { first_name: 'Claire',  last_name: 'Dubois',     skills: ['Psychology', 'Health'],              availability_json: MWF,       notes: 'School counseling certification.' },

  // ── Languages ───────────────────────────────────────────
  { first_name: 'Isabel',  last_name: 'Vargas',     skills: ['Spanish'],                           availability_json: FULL_WEEK, notes: 'Native speaker. All levels K-12.' },
  { first_name: 'Pierre',  last_name: 'Laurent',    skills: ['French'],                            availability_json: MTWTH,     notes: 'Native speaker. Conversational focus.' },

  // ── English / Language Arts ─────────────────────────────
  { first_name: 'Angela',  last_name: 'Wright',     skills: ['Creative Writing', 'Literature'],    availability_json: FULL_WEEK, notes: 'Published author. Poetry and fiction.' },
  { first_name: 'Jerome',  last_name: 'Banks',      skills: ['Literature', 'Debate'],              availability_json: MTWF,      notes: 'Debate coach. Strong in rhetoric.' },

  // ── Arts (Visual) ───────────────────────────────────────
  { first_name: 'Yuki',    last_name: 'Tanaka',     skills: ['Art', 'Ceramics'],                   availability_json: FULL_WEEK, notes: 'Mixed media and ceramics studio.' },
  { first_name: 'Olivia',  last_name: 'Bennett',    skills: ['Art', 'Photography'],                availability_json: MWF,       notes: 'Digital and darkroom photography.' },

  // ── Performing Arts ─────────────────────────────────────
  { first_name: 'Derek',   last_name: 'Washington', skills: ['Theater', 'Dance'],                  availability_json: FULL_WEEK, notes: 'Musical theater director.' },
  { first_name: 'Nina',    last_name: 'Petrov',     skills: ['Dance'],                             availability_json: MTWTH,     notes: 'Ballet and modern dance.' },

  // ── Technology ──────────────────────────────────────────
  { first_name: 'Alex',    last_name: 'Rivera',     skills: ['Computer Science', 'Robotics'],      availability_json: FULL_WEEK, notes: 'Python, Scratch, LEGO robotics.' },
  { first_name: 'Samantha',last_name: 'Huang',      skills: ['Computer Science'],                  availability_json: TTH,       notes: 'Web development and game design.' },
  { first_name: 'Raj',     last_name: 'Gupta',      skills: ['Robotics'],                          availability_json: WTHF,      notes: 'Engineering and VEX robotics.' },

  // ── Vocational / Specialty ──────────────────────────────
  { first_name: 'Frank',   last_name: 'Kowalski',   skills: ['Woodshop'],                          availability_json: MWF,       notes: 'Carpentry and basic woodworking safety.' },
  { first_name: 'Rosa',    last_name: 'Delgado',    skills: ['Culinary Arts'],                     availability_json: MTWTH,     notes: 'Pastry chef background. Food safety cert.' },
  { first_name: 'Jamal',   last_name: 'Henderson',  skills: ['Physical Education', 'Health'],      availability_json: FULL_WEEK, notes: 'Fitness and team sports.' },
  { first_name: 'Megan',   last_name: 'Sullivan',   skills: ['Physical Education', 'Dance'],       availability_json: MTWF,      notes: 'Yoga and movement instructor.' },

  // ── Cross-disciplinary / Multi-subject ──────────────────
  { first_name: 'Daniel',  last_name: 'Foster',     skills: ['Debate', 'Civics', 'History'],       availability_json: FULL_WEEK, notes: 'Model UN advisor. Strong public speaking.' },
  { first_name: 'Keiko',   last_name: 'Yamamoto',   skills: ['Art', 'Photography', 'Ceramics'],    availability_json: MTWTH,     notes: 'Visual arts generalist.' },
  { first_name: 'Victor',  last_name: 'Reyes',      skills: ['Science', 'Astronomy', 'Physics'],   availability_json: MWF,       notes: 'Planetarium experience.' },
  { first_name: 'Hannah',  last_name: 'Nguyen',     skills: ['Math', 'Computer Science'],          availability_json: FULL_WEEK, notes: 'Math olympiad coach.' },
  { first_name: 'Omar',    last_name: 'Hassan',     skills: ['Theater', 'Creative Writing'],       availability_json: WTHF,      notes: 'Playwriting and improv.' },
  { first_name: 'Laura',   last_name: 'Simmons',    skills: ['Spanish', 'French'],                 availability_json: FULL_WEEK, notes: 'Trilingual. Language immersion methods.' },
  { first_name: 'Brian',   last_name: 'Cooper',     skills: ['Band', 'Orchestra', 'Music'],        availability_json: FULL_WEEK, notes: 'Band and orchestra conductor. 15 years.' },
  { first_name: 'Tanya',   last_name: 'Mitchell',   skills: ['Health', 'Physical Education'],      availability_json: TTH,       notes: 'Nutrition and wellness focus.' },
];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const masterErr = requireMasterAdmin(auth.user);
    if (masterErr) return masterErr;

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { searchParams } = new URL(request.url);
    const clearFirst = searchParams.get('clear') === 'true';

    // ── Optionally clear existing instructors ──────────────
    let deleted = 0;
    if (clearFirst) {
      const { data: delData, error: delError } = await sb.from('staff')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id');
      if (delError) {
        return NextResponse.json(
          { error: `Failed to clear instructors: ${delError.message}` },
          { status: 500 },
        );
      }
      deleted = delData?.length ?? 0;
    }

    // ── Query existing subjects from templates ─────────────
    const { data: templates } = await sb.from('session_templates')
      .select('required_skills')
      .eq('is_active', true);

    const templateSubjects = new Set<string>();
    for (const t of templates ?? []) {
      if (Array.isArray(t.required_skills)) {
        for (const skill of t.required_skills) {
          templateSubjects.add(skill);
        }
      }
    }

    // ── Build instructor records ───────────────────────────
    const instructorRecords = INSTRUCTOR_DEFS.map((def) => ({
      first_name: def.first_name,
      last_name: def.last_name,
      email: `${def.first_name.toLowerCase()}.${def.last_name.toLowerCase().replace(/'/g, '')}@example.com`,
      phone: null,
      skills: def.skills,
      availability_json: def.availability_json,
      is_active: true,
      notes: def.notes,
    }));

    // ── Insert in batches ──────────────────────────────────
    const allCreated: Array<{ id: string; first_name: string; last_name: string; skills: string[] }> = [];

    for (let i = 0; i < instructorRecords.length; i += 50) {
      const batch = instructorRecords.slice(i, i + 50);
      const { data, error } = await sb.from('staff')
        .upsert(batch, { onConflict: 'email' })
        .select('id, first_name, last_name, skills');

      if (error) {
        return NextResponse.json(
          { error: `Failed to upsert instructors batch ${i}: ${error.message}` },
          { status: 500 },
        );
      }
      allCreated.push(...(data ?? []));
    }

    // ── Compute coverage report ────────────────────────────
    const coveredSkills = new Set<string>();
    for (const inst of allCreated) {
      for (const s of inst.skills) coveredSkills.add(s);
    }

    const uncoveredTemplateSubjects = [...templateSubjects].filter(s => !coveredSkills.has(s));

    return NextResponse.json({
      success: true,
      deleted,
      created: allCreated.length,
      subjects_covered: [...coveredSkills].sort(),
      template_subjects: [...templateSubjects].sort(),
      uncovered_template_subjects: uncoveredTemplateSubjects,
      instructors: allCreated.map(i => ({
        id: i.id,
        name: `${i.first_name} ${i.last_name}`,
        skills: i.skills,
      })),
    });
  } catch (err) {
    console.error('Seed instructors error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
