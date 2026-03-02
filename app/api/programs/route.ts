/**
 * GET /api/programs — Fetch all programs
 * POST /api/programs — Create a new program
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET() {
  try {
    console.log('[DEBUG] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30));
    console.log('[DEBUG] SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('[DEBUG] SERVICE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
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

    return NextResponse.json({ program: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
