/**
 * GET /api/programs — Fetch all programs
 * POST /api/programs — Create a new program
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { DEFAULT_TAGS, DEFAULT_SPACE_TYPES } from '../seed/default-tags';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('programs') as any)
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch programs: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ programs: data ?? [] });
  } catch (err) {
    console.error('Programs API error:', err);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('programs') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-copy default tags and space types into the new program
    const programId = data.id;
    const allDefaults = [...DEFAULT_TAGS, ...DEFAULT_SPACE_TYPES];
    const tagRows = allDefaults.map(t => ({
      name: t.name,
      color: t.color,
      category: t.category ?? null,
      description: t.description ?? null,
      emoji: t.emoji ?? null,
      program_id: programId,
      is_default: true,
    }));

    if (tagRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('tags') as any).insert(tagRows);
    }

    return NextResponse.json({ program: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
