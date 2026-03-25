import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('venues') as any)
      .select('*')
      .order('name');

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    query = query.eq('program_id', programId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ venues: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('venues') as any)
      .delete()
      .eq('program_id', programId)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete venues: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'Venue name is required' }, { status: 400 });
    }

    if (String(body.name).trim().length > 100) {
      return NextResponse.json({ error: 'Venue name must be 100 characters or less' }, { status: 400 });
    }

    // Check for duplicate name in the same program (case-insensitive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('venues') as any)
      .select('id, name')
      .eq('program_id', body.program_id)
      .ilike('name', String(body.name).trim());

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `A venue named "${String(body.name).trim()}" already exists in this program` },
        { status: 400 }
      );
    }

    if (body.max_capacity != null && (typeof body.max_capacity !== 'number' || body.max_capacity < 0)) {
      return NextResponse.json({ error: 'max_capacity must be a non-negative number' }, { status: 400 });
    }

    if (body.buffer_minutes != null && (typeof body.buffer_minutes !== 'number' || body.buffer_minutes < 0)) {
      return NextResponse.json({ error: 'buffer_minutes must be a non-negative number' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('venues') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ venue: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
