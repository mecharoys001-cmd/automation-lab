import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin } from '@/lib/api-auth';

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

    return NextResponse.json({ venue: data });
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

    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    if ('name' in body && (!body.name || !String(body.name).trim())) {
      return NextResponse.json({ error: 'Venue name is required' }, { status: 400 });
    }

    if ('name' in body && String(body.name).trim().length > 100) {
      return NextResponse.json({ error: 'Venue name must be 100 characters or less' }, { status: 400 });
    }

    // Check for duplicate name if name is being changed
    if (body.name) {
      // Get current venue to know its program_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentVenue } = await (supabase.from('venues') as any)
        .select('program_id, name')
        .eq('id', id)
        .single();

      if (currentVenue && currentVenue.name.toLowerCase() !== String(body.name).trim().toLowerCase()) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('venues') as any)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ venue: data });
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

    const { id } = await params;
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('venues') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
