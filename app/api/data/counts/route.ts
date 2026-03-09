/**
 * GET /api/data/counts?program_id=XXX
 *
 * Returns counts of entities that would be deleted by a "Clear All" operation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
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
    const sb = supabase as any;

    const [sessions, templates, instructors, venues, tags] = await Promise.all([
      sb.from('sessions').select('id', { count: 'exact', head: true }).eq('program_id', programId),
      sb.from('session_templates').select('id', { count: 'exact', head: true }).eq('program_id', programId),
      sb.from('instructors').select('id', { count: 'exact', head: true }).neq('id', '00000000-0000-0000-0000-000000000000'),
      sb.from('venues').select('id', { count: 'exact', head: true }).eq('program_id', programId),
      sb.from('tags').select('id', { count: 'exact', head: true }).neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        sessions: sessions.count ?? 0,
        templates: templates.count ?? 0,
        instructors: instructors.count ?? 0,
        venues: venues.count ?? 0,
        tags: tags.count ?? 0,
      },
    });
  } catch (err) {
    console.error('Counts API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
