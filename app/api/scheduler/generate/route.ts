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
import { requireAdmin, requireProgramAccess } from '@/lib/api-auth';

export const maxDuration = 60;

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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Parse request body
    const body = await request.json();
    const { program_id, year, day_start_time, day_end_time } = body;

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

    const accessErr = await requireProgramAccess(auth.user, program_id);
    if (accessErr) return accessErr;

    // Create a service-role Supabase client (bypasses RLS for admin writes)
    const supabase = createServiceClient();

    // Check for preview mode via query param
    const preview = request.nextUrl.searchParams.get('preview') === 'true';

    // Run the scheduler engine
    const yearNum = year && !isNaN(Number(year)) ? Number(year) : undefined;
    const result = await runScheduler(supabase, { program_id, year: yearNum, preview, day_start_time, day_end_time });

    // When preview mode, include a preview summary with totals by venue and week
    if (preview && result.success) {
      return NextResponse.json({
        ...result,
        preview: {
          total: result.sessions_created,
          byVenue: result.byVenue ?? {},
          byWeek: result.byWeek ?? {},
        },
      });
    }

    // Track usage for non-preview successful generations
    if (result.success && !preview) {
      const { createServiceClient: createSvc } = await import('@/lib/supabase-service');
      const trackingSvc = createSvc();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (trackingSvc.from('tool_usage') as any)
        .insert({
          tool_id: 'scheduler',
          metadata: {
            sessions_generated: result.sessions_created,
            program_id,
          },
        })
        .then(({ error: trackErr }: { error: unknown }) => {
          if (trackErr) console.error('[usage-track] Scheduler tracking failed:', trackErr);
        });
    }

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
