// app/api/usage/stats/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getOrgMembership, isAdmin } from '@/lib/rbac';
import type { ToolUsageStats } from '@/types/usage';

export async function GET() {
  try {
    // Auth check — admin only
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const membership = await getOrgMembership(user.email);
    if (!isAdmin(membership)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();

    // Get all tool configs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs, error: configError } = await (svc.from('tool_config') as any)
      .select('*')
      .eq('is_active', true)
      .order('tool_id');

    if (configError) throw configError;

    // Manual aggregation per tool
    const stats: ToolUsageStats[] = [];
    for (const config of configs || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (svc.from('tool_usage') as any)
        .select('*', { count: 'exact', head: true })
        .eq('tool_id', config.tool_id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lastUsed } = await (svc.from('tool_usage') as any)
        .select('created_at')
        .eq('tool_id', config.tool_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const totalUses = count || 0;
      const totalMinutes = totalUses * config.minutes_per_use;

      stats.push({
        tool_id: config.tool_id,
        display_name: config.display_name,
        minutes_per_use: config.minutes_per_use,
        tracking_method: config.tracking_method,
        description: config.description,
        total_uses: totalUses,
        total_minutes_saved: totalMinutes,
        total_hours_saved: Math.round((totalMinutes / 60) * 10) / 10,
        last_used: lastUsed?.created_at || null,
      });
    }

    return NextResponse.json({ stats }, { status: 200 });
  } catch (err) {
    console.error('[usage-stats] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
