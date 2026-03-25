/**
 * GET /api/versions?year=YYYY
 *
 * List all schedule versions for the given year (up to 5).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (!yearParam || isNaN(Number(yearParam))) {
      return NextResponse.json(
        { error: 'year query parameter is required (e.g. ?year=2026)' },
        { status: 400 }
      );
    }

    const year = Number(yearParam);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('schedule_versions') as any)
      .select('id, year, version_number, status, created_at')
      .eq('year', year)
      .order('version_number', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ versions: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
