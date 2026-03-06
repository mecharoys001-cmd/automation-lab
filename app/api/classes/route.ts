import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

// Ensure this route is always dynamically evaluated (never cached)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('classes') as any)
      .select('*')
      .order('name');

    if (error) {
      console.error('[GET /api/classes] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[GET /api/classes] returning', data?.length ?? 0, 'classes');

    return NextResponse.json({ classes: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const insertData: {
      name: string;
      description?: string;
      duration_minutes?: number;
      default_instructor_id?: string;
      color?: string;
    } = {
      name: body.name.trim(),
    };

    if (body.description && typeof body.description === 'string' && body.description.trim()) {
      insertData.description = body.description.trim();
    }
    if (body.duration_minutes && typeof body.duration_minutes === 'number' && body.duration_minutes > 0) {
      insertData.duration_minutes = body.duration_minutes;
    }
    if (body.default_instructor_id && typeof body.default_instructor_id === 'string') {
      insertData.default_instructor_id = body.default_instructor_id;
    }
    if (body.color && typeof body.color === 'string' && body.color.trim()) {
      insertData.color = body.color.trim();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('classes') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A class with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ class: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
