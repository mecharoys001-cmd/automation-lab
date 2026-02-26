/**
 * POST /api/notifications/publish
 *
 * Updates all draft sessions to 'published' for the given program,
 * then notifies every assigned instructor using the 'schedule_published' template.
 *
 * Request body: { programId: string }
 * Response: { success, sessionsPublished, notificationsSent, errors }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, Instructor, Session } from '@/types/database';
import { notify } from '@/lib/notifications';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { programId } = body;

    if (!programId || typeof programId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid programId' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Look up the program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: program, error: programError } = await (supabase.from('programs') as any)
      .select('id, name')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { success: false, error: 'Program not found' },
        { status: 404 }
      );
    }

    // Update all draft sessions to published
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedSessions, error: updateError } = await (supabase.from('sessions') as any)
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('program_id', programId)
      .eq('status', 'draft')
      .select('id');

    if (updateError) {
      console.error('Update draft sessions error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    const sessionsPublished = (updatedSessions ?? []).length;

    // Fetch all published sessions with assigned instructors (including just-updated ones)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessions, error: sessionsError } = await (supabase.from('sessions') as any)
      .select('id, instructor_id')
      .eq('program_id', programId)
      .eq('status', 'published')
      .not('instructor_id', 'is', null);

    if (sessionsError) {
      console.error('Fetch published sessions error:', sessionsError);
      return NextResponse.json(
        { success: false, error: sessionsError.message },
        { status: 500 }
      );
    }

    const publishedSessions = (sessions ?? []) as Pick<Session, 'id' | 'instructor_id'>[];

    // Group sessions by instructor_id
    const sessionsByInstructor = new Map<string, number>();
    for (const session of publishedSessions) {
      const id = session.instructor_id!;
      sessionsByInstructor.set(id, (sessionsByInstructor.get(id) ?? 0) + 1);
    }

    // Notify each instructor
    let notificationsSent = 0;
    const errors: string[] = [];

    for (const [instructorId, sessionCount] of sessionsByInstructor) {
      try {
        // Get instructor details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: instructorData, error: instructorError } = await (supabase.from('instructors') as any)
          .select('id, first_name, last_name')
          .eq('id', instructorId)
          .single();

        const instructor = instructorData as Pick<Instructor, 'id' | 'first_name' | 'last_name'> | null;

        if (instructorError || !instructor) {
          errors.push(`Instructor ${instructorId} not found`);
          continue;
        }

        const instructorName = `${instructor.first_name} ${instructor.last_name}`;

        const result = await notify({
          recipientId: instructorId,
          channel: 'email',
          templateKey: 'schedule_published',
          data: {
            instructorName,
            programName: program.name,
            sessionCount,
            scheduleUrl: '/tools/symphonix-scheduler/portal',
          },
        });

        if (result.success) {
          notificationsSent++;
        } else {
          errors.push(`Failed to notify ${instructorName}: ${result.error}`);
        }
      } catch (err) {
        errors.push(
          `Error notifying instructor ${instructorId}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      sessionsPublished,
      notificationsSent,
      errors,
    });
  } catch (err) {
    console.error('Publish notification API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
