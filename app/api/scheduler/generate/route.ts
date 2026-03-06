/**
 * POST /api/scheduler/generate
 *
 * Triggers the auto-scheduler engine for a given program.
 * Clears existing draft sessions and regenerates from templates.
 *
 * Request body: { "program_id": "uuid" }
 * Query params: ?preview=true to dry-run without DB mutations
 * Response: SchedulerResult JSON
 *
 * Auth: Uses Supabase service role key (bypasses RLS) since this
 * is an admin-only operation that needs full DB write access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { runScheduler } from '@/lib/scheduler';

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
    // Parse request body
    const body = await request.json();
    const { program_id, year } = body;

    if (!program_id || typeof program_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid program_id' },
        { status: 400 }
      );
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(program_id)) {
      return NextResponse.json(
        { success: false, error: 'program_id must be a valid UUID' },
        { status: 400 }
      );
    }

    // Create a service-role Supabase client (bypasses RLS for admin writes)
    const supabase = createServiceClient();

    // Check for preview mode via query param
    const preview = request.nextUrl.searchParams.get('preview') === 'true';

    // Run the scheduler engine — pass year so it generates for the full calendar year
    const yearNum = year && !isNaN(Number(year)) ? Number(year) : undefined;
    const result = await runScheduler(supabase, { program_id, year: yearNum, preview });

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (err) {
    console.error('Scheduler API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
