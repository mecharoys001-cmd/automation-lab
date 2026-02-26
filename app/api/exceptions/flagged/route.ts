/**
 * GET /api/exceptions/flagged
 *
 * Fetches all sessions where needs_resolution = true.
 * Includes instructor, venue, tags relations.
 * Supports filtering by program_id query param.
 *
 * Query params:
 *   - program_id (optional) — filter to a specific program
 *
 * Returns: { success, sessions: FlaggedSessionWithRelations[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    const supabase = createServiceClient();

    // Build query for flagged sessions with relations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select(`
        *,
        instructor:instructors (id, first_name, last_name, email, skills),
        venue:venues (id, name, space_type),
        session_tags (
          tag:tags (id, name, color)
        )
      `)
      .eq('needs_resolution', true)
      .order('date')
      .order('start_time');

    if (programId) {
      query = query.eq('program_id', programId);
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch flagged sessions: ${sessionsError.message}` },
        { status: 500 }
      );
    }

    // Flatten session_tags junction into a tags array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (sessions ?? []).map((s: any) => {
      const tags = (s.session_tags ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((st: any) => st.tag)
        .filter(Boolean);
      const { session_tags: _st, ...rest } = s;
      return { ...rest, tags };
    });

    return NextResponse.json({
      success: true,
      sessions: enriched,
      count: enriched.length,
    });
  } catch (err) {
    console.error('Exception flagged API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
