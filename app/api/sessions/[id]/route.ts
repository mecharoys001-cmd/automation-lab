import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';
import { skillsMatch, availabilityCoversWindow, toTimeWindow, dayIndexToName, parseDate } from '@/lib/scheduler/utils';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();

    // Verify program access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionToCheck } = await (supabase.from('sessions') as any)
      .select('program_id')
      .eq('id', id)
      .single();

    if (!sessionToCheck) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (sessionToCheck.program_id) {
      const accessErr = await requireProgramAccess(auth.user, sessionToCheck.program_id);
      if (accessErr) return accessErr;
    }

    const body = await request.json();

    // Validate required fields if being updated
    if ('name' in body && (!body.name || !String(body.name).trim())) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    if ('venue_id' in body && !body.venue_id) {
      return NextResponse.json(
        { error: 'Venue is required' },
        { status: 400 }
      );
    }

    // Validate venue conflict (double-booking prevention)
    {
      // Determine the effective venue/date/time for this update
      const venueId = body.venue_id;
      const hasTimeChange = body.date || body.start_time || body.end_time || body.venue_id;

      if (hasTimeChange) {
        // Fetch current session to merge with updates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentSession } = await (supabase.from('sessions') as any)
          .select('venue_id, date, start_time, end_time, status')
          .eq('id', id)
          .single();

        if (currentSession) {
          const effectiveVenueId = venueId ?? currentSession.venue_id;
          const effectiveDate = body.date ?? currentSession.date;
          const effectiveStartTime = body.start_time ?? currentSession.start_time;
          const effectiveEndTime = body.end_time ?? currentSession.end_time;
          const effectiveStatus = body.status ?? currentSession.status;

          if (effectiveVenueId && effectiveDate && effectiveStartTime && effectiveEndTime && effectiveStatus !== 'canceled') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: venue } = await (supabase.from('venues') as any)
              .select('name, max_concurrent_bookings')
              .eq('id', effectiveVenueId)
              .single();

            if (venue) {
              const maxConcurrent = venue.max_concurrent_bookings ?? 1;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: conflicts, error: conflictError } = await (supabase.from('sessions') as any)
                .select('id, name, start_time, end_time')
                .eq('venue_id', effectiveVenueId)
                .eq('date', effectiveDate)
                .neq('status', 'canceled')
                .neq('id', id) // exclude the session being updated
                .lt('start_time', effectiveEndTime)
                .gt('end_time', effectiveStartTime);

              if (conflictError) {
                return NextResponse.json(
                  { error: `Failed to check venue conflicts: ${conflictError.message}` },
                  { status: 500 }
                );
              }

              if ((conflicts?.length ?? 0) >= maxConcurrent) {
                const conflict = conflicts[0];
                return NextResponse.json(
                  { error: `Venue conflict: ${venue.name} is already booked from ${conflict.start_time} to ${conflict.end_time} (${conflict.name})` },
                  { status: 409 }
                );
              }
            }
          }
        }
      }
    }

    // Validate instructor has required skills and availability for this session
    if (body.instructor_id) {
      // Fetch session details (date, times, template_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: session } = await (supabase.from('sessions') as any)
        .select('template_id, date, start_time, end_time')
        .eq('id', id)
        .single();

      // Fetch instructor details (skills + availability)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: instructor } = await (supabase.from('instructors') as any)
        .select('first_name, last_name, skills, availability_json')
        .eq('id', body.instructor_id)
        .single();

      // Skill validation
      if (session?.template_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: template } = await (supabase.from('session_templates') as any)
          .select('required_skills')
          .eq('id', session.template_id)
          .single();

        if (template?.required_skills?.length > 0) {
          if (instructor && !skillsMatch(instructor.skills, template.required_skills)) {
            return NextResponse.json(
              { error: `Staff member does not teach the required subject(s): ${template.required_skills.join(', ')}. Assign a staff member with matching skills.` },
              { status: 400 }
            );
          }
        }
      }

      // Availability validation
      if (instructor && session) {
        // Use updated values from body if provided, otherwise use existing session values
        const sessionDate = body.date ?? session.date;
        const startTime = body.start_time ?? session.start_time;
        const endTime = body.end_time ?? session.end_time;

        if (sessionDate && startTime && endTime) {
          const date = parseDate(sessionDate);
          const dayOfWeek = date.getDay();
          const sessionWindow = toTimeWindow(startTime, endTime);
          const instructorName = `${instructor.first_name} ${instructor.last_name}`;

          if (!availabilityCoversWindow(instructor.availability_json, dayOfWeek, sessionWindow)) {
            // Build a helpful message showing when the instructor IS available
            const dayName = dayIndexToName(dayOfWeek);
            const blocks = instructor.availability_json?.[dayName as keyof typeof instructor.availability_json];
            const availStr = blocks && blocks.length > 0
              ? blocks.map((b: { start: string; end: string }) => `${b.start}–${b.end}`).join(', ')
              : 'not available';

            return NextResponse.json(
              { error: `Cannot assign ${instructorName} — unavailable at this time (${dayName}: ${availStr})` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Extract tag_names before updating the session (not a DB column)
    const tagNames: string[] | undefined = body.tag_names;
    delete body.tag_names;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('sessions') as any)
      .update(body)
      .eq('id', id)
      .select(`
        *,
        instructor:instructors(*),
        venue:venues(*),
        session_tags(tag:tags(*))
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync session_tags if tag_names was provided
    if (tagNames !== undefined) {
      // Delete existing session_tags for this session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('session_tags') as any)
        .delete()
        .eq('session_id', id);

      if (tagNames.length > 0) {
        // Look up tag IDs by name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tagRows } = await (supabase.from('tags') as any)
          .select('id, name')
          .in('name', tagNames);

        if (tagRows && tagRows.length > 0) {
          const insertRows = tagRows.map((t: { id: string }) => ({
            session_id: id,
            tag_id: t.id,
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('session_tags') as any).insert(insertRows);
        }
      }

      // Re-fetch to get updated tags
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: refreshed } = await (supabase.from('sessions') as any)
        .select(`
          *,
          instructor:instructors(*),
          venue:venues(*),
          session_tags(tag:tags(*))
        `)
        .eq('id', id)
        .single();

      if (refreshed) {
        const { session_tags: refreshedTags, ...refreshedRest } = refreshed as Record<string, unknown>;
        const tags = Array.isArray(refreshedTags)
          ? (refreshedTags as Record<string, unknown>[]).map((st) => st.tag).filter(Boolean)
          : [];
        trackScheduleChange();
        return NextResponse.json({ session: { ...refreshedRest, tags } });
      }
    }

    // Flatten session_tags into tags array
    const { session_tags, ...rest } = data as Record<string, unknown>;
    const tags = Array.isArray(session_tags)
      ? (session_tags as Record<string, unknown>[]).map((st) => st.tag).filter(Boolean)
      : [];

    trackScheduleChange();
    return NextResponse.json({ session: { ...rest, tags } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Editors can edit sessions but not delete them
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = createServiceClient();

    // Verify program access before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sess } = await (supabase.from('sessions') as any)
      .select('program_id')
      .eq('id', id)
      .single();

    if (sess?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, sess.program_id);
      if (accessErr) return accessErr;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sessions') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
