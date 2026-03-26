// Public endpoint returning aggregate usage stats (no auth required)
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET() {
  try {
    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs, error: configError } = await (svc.from('tool_config') as any)
      .select('tool_id, minutes_per_use')
      .eq('is_active', true);

    if (configError) throw configError;

    let totalUses = 0;
    let totalMinutes = 0;

    for (const config of configs || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (svc.from('tool_usage') as any)
        .select('*', { count: 'exact', head: true })
        .eq('tool_id', config.tool_id);

      const uses = count || 0;
      totalUses += uses;
      totalMinutes += uses * config.minutes_per_use;
    }

    return NextResponse.json({
      total_uses: totalUses,
      total_hours_saved: Math.round((totalMinutes / 60) * 10) / 10,
    });
  } catch (err) {
    console.error('[usage-summary] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
