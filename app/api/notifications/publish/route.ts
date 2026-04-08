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
import type { Session } from '@/types/database';
import { notify } from '@/lib/notifications';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { programId, skip_incomplete = false } = body;

    if (!programId || typeof programId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid programId' },
        { status: 400 }
      );
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

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

    // Fetch draft sessions with template info to check for missing Event Types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draftSessions, error: draftError } = await (supabase.from('sessions') as any)
      .select('id, template_id, session_templates(id, name, required_skills)')
      .eq('program_id', programId)
      .eq('status', 'draft');

    if (draftError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch draft sessions: ${draftError.message}` },
        { status: 500 }
      );
    }

    const allDrafts = draftSessions ?? [];

    // Partition drafts into publishable vs missing event type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomplete = allDrafts.filter((s: any) => {
      const tpl = s.session_templates;
      return !tpl || !tpl.required_skills || tpl.required_skills.length === 0;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publishable = allDrafts.filter((s: any) => {
      const tpl = s.session_templates;
      return tpl && tpl.required_skills && tpl.required_skills.length > 0;
    });

    if (incomplete.length > 0 && !skip_incomplete) {
      // Collect affected template names
      const affectedNames = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of incomplete) {
        affectedNames.add(s.session_templates?.name || 'Unknown template');
      }
      return NextResponse.json(
        {
          success: false,
          error: `${incomplete.length} session${incomplete.length !== 1 ? 's' : ''} cannot be published because ${incomplete.length === 1 ? 'its template has' : 'their templates have'} no Event Type`,
          sessions_missing_event_type: incomplete.length,
          affected_template_names: Array.from(affectedNames),
        },
        { status: 422 }
      );
    }

    // Determine which session IDs to publish
    const idsToPublish = skip_incomplete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? publishable.map((s: any) => s.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : allDrafts.map((s: any) => s.id);

    if (idsToPublish.length === 0) {
      return NextResponse.json({
        success: true,
        sessionsPublished: 0,
        sessionsSkipped: incomplete.length,
        notificationsSent: 0,
        errors: [],
      });
    }

    // Update selected draft sessions to published.
    // Use filter-based update instead of .in() to avoid PostgREST URL-length
    // limits when there are many session IDs (the .in() query parameter can
    // exceed the max URL size and return a 400 "Bad Request").
    let updatedSessions: { id: string }[] | null = null;
    let updateError: { message: string; details?: string; hint?: string; code?: string } | null = null;

    if (skip_incomplete && publishable.length < allDrafts.length) {
      // Only publish the subset — must use .in() but the list is smaller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase.from('sessions') as any)
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .in('id', idsToPublish)
        .select('id');
      updatedSessions = result.data;
      updateError = result.error;
    } else {
      // Publish ALL drafts for this program — use filter-based update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase.from('sessions') as any)
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('program_id', programId)
        .eq('status', 'draft')
        .select('id');
      updatedSessions = result.data;
      updateError = result.error;
    }

    if (updateError) {
      console.error('Update draft sessions error:', JSON.stringify({
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
        sessionCount: idsToPublish.length,
      }));
      return NextResponse.json(
        {
          success: false,
          error: `Failed to publish sessions: ${updateError.message}`,
          details: updateError.details || null,
          hint: updateError.hint || null,
          code: updateError.code || null,
        },
        { status: 500 }
      );
    }

    const sessionsPublished = (updatedSessions ?? []).length;

    // ── Notification phase (non-fatal) ─────────────────────────────────────
    // Sessions are already published at this point. Any failure below is
    // logged and returned in `errors`, but never downgrades the response to 500.
    let notificationsSent = 0;
    const errors: string[] = [];

    try {
      // Fetch all published sessions with assigned instructors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessions, error: sessionsError } = await (supabase.from('sessions') as any)
        .select('id, staff_id')
        .eq('program_id', programId)
        .eq('status', 'published')
        .not('staff_id', 'is', null);

      if (sessionsError) {
        console.error('Fetch published sessions error:', sessionsError);
        errors.push(`Failed to fetch sessions for notifications: ${sessionsError.message}`);
      } else {
        const publishedSessions = (sessions ?? []) as Pick<Session, 'id' | 'staff_id'>[];

        // Group sessions by staff_id
        const sessionsByInstructor = new Map<string, number>();
        for (const session of publishedSessions) {
          const id = session.staff_id!;
          sessionsByInstructor.set(id, (sessionsByInstructor.get(id) ?? 0) + 1);
        }

        // Notify each instructor
        for (const [instructorId, sessionCount] of sessionsByInstructor) {
          try {
            // Get instructor details
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: instructorData, error: instructorError } = await (supabase.from('staff') as any)
              .select('id, first_name, last_name')
              .eq('id', instructorId)
              .single();

            if (instructorError || !instructorData) {
              errors.push(`Instructor ${instructorId} not found`);
              continue;
            }

            const instructorName = `${instructorData.first_name} ${instructorData.last_name}`;

            const result = await notify({
              recipientId: instructorId,
              channel: 'email',
              templateKey: 'schedule_published',
              data: {
                instructorName,
                programName: program.name,
                sessionCount,
                scheduleUrl: '/tools/scheduler/portal',
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
      }
    } catch (notifyErr) {
      console.error('Notification phase error:', notifyErr);
      errors.push(
        `Notification phase failed: ${notifyErr instanceof Error ? notifyErr.message : 'Unknown error'}`
      );
    }

    return NextResponse.json({
      success: true,
      sessionsPublished,
      sessionsSkipped: skip_incomplete ? incomplete.length : 0,
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
