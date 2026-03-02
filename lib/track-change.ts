import { createServiceClient } from '@/lib/supabase-service';

/**
 * Updates settings.last_modified_at to now().
 * Call after any mutation to sessions, templates, calendar, or settings.
 * Fire-and-forget — errors are logged but don't block the caller.
 */
export async function trackScheduleChange(): Promise<void> {
  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('settings') as any)
      .select('id')
      .limit(1)
      .single();

    if (!existing) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('settings') as any)
      .update({ last_modified_at: new Date().toISOString() })
      .eq('id', existing.id);
  } catch (err) {
    console.error('trackScheduleChange error:', err);
  }
}
