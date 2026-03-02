/**
 * GET /api/versions/should-save?year=YYYY
 *
 * Returns { shouldSave: boolean } — true when:
 *   1. 60+ minutes have passed since the last version was saved, AND
 *   2. Changes have been made since the last version (settings.last_modified_at > last version's created_at)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

const AUTO_SAVE_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (!yearParam || isNaN(Number(yearParam))) {
      return NextResponse.json(
        { error: 'year query parameter is required' },
        { status: 400 }
      );
    }

    const year = Number(yearParam);

    // Fetch latest version for this year and current settings in parallel
    const [versionsRes, settingsRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('schedule_versions') as any)
        .select('created_at')
        .eq('year', year)
        .order('created_at', { ascending: false })
        .limit(1),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('settings') as any)
        .select('last_modified_at')
        .limit(1)
        .single(),
    ]);

    const latestVersion = versionsRes.data?.[0] ?? null;
    const settings = settingsRes.data;
    const lastModifiedAt = settings?.last_modified_at
      ? new Date(settings.last_modified_at).getTime()
      : 0;

    // If no versions exist yet, should save if there have been any changes
    if (!latestVersion) {
      return NextResponse.json({ shouldSave: lastModifiedAt > 0 });
    }

    const lastVersionTime = new Date(latestVersion.created_at).getTime();
    const now = Date.now();

    const enoughTimePassed = now - lastVersionTime >= AUTO_SAVE_INTERVAL_MS;
    const changesMadeSinceLastVersion = lastModifiedAt > lastVersionTime;

    return NextResponse.json({
      shouldSave: enoughTimePassed && changesMadeSinceLastVersion,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
