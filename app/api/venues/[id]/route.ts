import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { logSchedulerActivity } from '@/lib/activity-log';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('venues') as any)
      .select(`
        *,
        venue_tags (
          tag_id,
          tags (
            id,
            name,
            emoji,
            color,
            category,
            description
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Verify program access
    if (data.program_id) {
      const accessErr = await requireProgramAccess(auth.user, data.program_id);
      if (accessErr) return accessErr;
    }

    // Flatten venue_tags join into a top-level additional_tags array of names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tagNames = ((data.venue_tags as any[]) ?? [])
      .map((vt: { tags: { name: string } | null }) => vt.tags?.name)
      .filter(Boolean);
    const { venue_tags: _, ...venueRest } = data;

    return NextResponse.json({ venue: { ...venueRest, additional_tags: tagNames } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    if ('name' in body && (!body.name || !String(body.name).trim())) {
      return NextResponse.json({ error: 'Venue name is required' }, { status: 400 });
    }

    if ('name' in body && String(body.name).trim().length > 100) {
      return NextResponse.json({ error: 'Venue name must be 100 characters or less' }, { status: 400 });
    }

    // Get current venue to know its program_id and verify access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentVenue } = await (supabase.from('venues') as any)
      .select('program_id, name')
      .eq('id', id)
      .single();

    if (!currentVenue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    if (currentVenue.program_id) {
      const accessErr = await requireProgramAccess(auth.user, currentVenue.program_id);
      if (accessErr) return accessErr;
    }

    // Check for duplicate name if name is being changed
    if (body.name) {
      if (currentVenue.name.toLowerCase() !== String(body.name).trim().toLowerCase()) {
        // Only check for duplicates if the name is actually changing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('venues') as any)
          .select('id, name')
          .eq('program_id', currentVenue.program_id)
          .neq('id', id)  // Exclude current venue
          .ilike('name', String(body.name).trim());

        if (existing && existing.length > 0) {
          return NextResponse.json(
            { error: `A venue named "${String(body.name).trim()}" already exists in this program` },
            { status: 400 }
          );
        }
      }
    }

    if (body.max_capacity != null && (typeof body.max_capacity !== 'number' || body.max_capacity < 0)) {
      return NextResponse.json({ error: 'max_capacity must be a non-negative number' }, { status: 400 });
    }

    if (body.buffer_minutes != null && (typeof body.buffer_minutes !== 'number' || body.buffer_minutes < 0)) {
      return NextResponse.json({ error: 'buffer_minutes must be a non-negative number' }, { status: 400 });
    }

    // Extract tags before updating the venue record
    let tagNames: string[] | undefined;
    if ('additional_tags' in body) {
      tagNames = body.additional_tags ?? [];
      delete body.additional_tags;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('venues') as any)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync tags through junction table if provided
    if (tagNames !== undefined) {
      // Delete existing venue_tags for this venue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('venue_tags') as any).delete().eq('venue_id', id);

      if (tagNames.length > 0) {
        // Resolve tag names to IDs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tags } = await (supabase.from('tags') as any)
          .select('id, name')
          .eq('program_id', currentVenue.program_id)
          .in('name', tagNames);
        if (tags?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('venue_tags') as any)
            .insert(tags.map((t: { id: string }) => ({ venue_id: id, tag_id: t.id })));
        }
      }
    }

    logSchedulerActivity({
      user: auth.user,
      action: 'update_venue',
      entityName: data?.name ?? currentVenue.name ?? null,
      programId: currentVenue.program_id,
    });

    return NextResponse.json({ venue: { ...data, ...(tagNames !== undefined ? { additional_tags: tagNames } : {}) } });
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

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = createServiceClient();

    // Verify program access before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: venue } = await (supabase.from('venues') as any)
      .select('program_id, name')
      .eq('id', id)
      .single();

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    if (venue.program_id) {
      const accessErr = await requireProgramAccess(auth.user, venue.program_id);
      if (accessErr) return accessErr;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('venues') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logSchedulerActivity({
      user: auth.user,
      action: 'delete_venue',
      entityName: venue.name ?? null,
      programId: venue.program_id ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
