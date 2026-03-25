import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    const isActive = searchParams.get('is_active');
    const skills = searchParams.get('skills');
    const search = searchParams.get('search');
    const email = searchParams.get('email');

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('instructors') as any)
      .select('*')
      .eq('program_id', programId)
      .order('last_name')
      .order('first_name');

    if (email) {
      query = query.eq('email', email.trim().toLowerCase());
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (skills) {
      query = query.contains('skills', [skills]);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instructors: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createServiceClient();

    // Instructors are global (not program-scoped), so this deletes all.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('instructors') as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Supabase requires a filter — this matches all real rows
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete instructors: ${error.message}` },
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
    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('instructors') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instructor: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
