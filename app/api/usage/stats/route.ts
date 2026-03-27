// app/api/usage/stats/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolUsageStats } from '@/types/usage';

function getIntervalDays(frequency: string, customDays?: number | null): number {
  switch (frequency) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'custom': return customDays || 30;
    default: return 30;
  }
}

/** Auto-track: for external tools past their next_run_date, insert usage events and advance next_run_date. */
async function autoTrackDueTools(svc: SupabaseClient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dueTools } = await (svc.from('tool_config') as any)
    .select('*')
    .eq('is_active', true)
    .eq('is_external', true)
    .not('run_frequency', 'is', null)
    .not('next_run_date', 'is', null)
    .lte('next_run_date', todayStr);

  // --- Phase 1: advance tools that already have a next_run_date ---
  if (dueTools && dueTools.length > 0) {
    for (const tool of dueTools) {
      const intervalDays = getIntervalDays(tool.run_frequency, tool.run_interval_days);
      let nextDate = new Date(tool.next_run_date);

      // Insert a usage event for each missed run date up to today
      const eventsToInsert = [];
      while (nextDate <= today) {
        eventsToInsert.push({
          tool_id: tool.tool_id,
          metadata: { auto_tracked: true },
          created_at: nextDate.toISOString(),
        });
        nextDate.setDate(nextDate.getDate() + intervalDays);
      }

      if (eventsToInsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('tool_usage') as any).insert(eventsToInsert);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('tool_config') as any)
          .update({
            next_run_date: nextDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('tool_id', tool.tool_id);
      }
    }
  }

  // --- Phase 2: backfill tools that have first_run_date + run_frequency but 0 usage events ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: backfillCandidates } = await (svc.from('tool_config') as any)
    .select('*')
    .eq('is_active', true)
    .eq('is_external', true)
    .not('run_frequency', 'is', null)
    .not('first_run_date', 'is', null);

  if (backfillCandidates && backfillCandidates.length > 0) {
    for (const tool of backfillCandidates) {
      // Check if this tool has any usage events at all
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (svc.from('tool_usage') as any)
        .select('*', { count: 'exact', head: true })
        .eq('tool_id', tool.tool_id);

      if ((count || 0) > 0) continue;

      const intervalDays = getIntervalDays(tool.run_frequency, tool.run_interval_days);
      let runDate = new Date(tool.first_run_date);
      runDate.setHours(0, 0, 0, 0);

      const eventsToInsert = [];
      while (runDate <= today) {
        eventsToInsert.push({
          tool_id: tool.tool_id,
          metadata: { auto_tracked: true, backfilled: true },
          created_at: runDate.toISOString(),
        });
        runDate.setDate(runDate.getDate() + intervalDays);
      }

      if (eventsToInsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('tool_usage') as any).insert(eventsToInsert);
        // runDate is now the next future date — set it as next_run_date
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('tool_config') as any)
          .update({
            next_run_date: runDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('tool_id', tool.tool_id);
      }
    }
  }
}

export async function GET() {
  try {
    // Auth check — admin only
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const siteAdmin = await getSiteAdmin(user.email);
    if (!isSiteAdmin(siteAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();

    // Auto-track any external tools that are past their next_run_date
    await autoTrackDueTools(svc);

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

      // Unique users: distinct non-null user_email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userRows } = await (svc.from('tool_usage') as any)
        .select('user_email')
        .eq('tool_id', config.tool_id)
        .not('user_email', 'is', null);

      const allEmails = (userRows || []).map((r: { user_email: string }) => r.user_email);
      const emailCounts = new Map<string, number>();
      for (const email of allEmails) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
      const uniqueUsers = emailCounts.size;
      const repeatUsers = [...emailCounts.values()].filter(c => c >= 2).length;

      // Completion rate: completed / (completed + error) * 100
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: completedCount } = await (svc.from('tool_usage') as any)
        .select('*', { count: 'exact', head: true })
        .eq('tool_id', config.tool_id)
        .eq('status', 'completed');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: errorCount } = await (svc.from('tool_usage') as any)
        .select('*', { count: 'exact', head: true })
        .eq('tool_id', config.tool_id)
        .eq('status', 'error');

      const totalTerminal = (completedCount || 0) + (errorCount || 0);
      const completionRate = totalTerminal > 0
        ? Math.round(((completedCount || 0) / totalTerminal) * 1000) / 10
        : 0;

      // Average duration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: durationRows } = await (svc.from('tool_usage') as any)
        .select('duration_seconds')
        .eq('tool_id', config.tool_id)
        .not('duration_seconds', 'is', null);

      const durations = (durationRows || []).map((r: { duration_seconds: number }) => r.duration_seconds);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
        : 0;

      const totalUses = count || 0;
      const totalMinutes = totalUses * config.minutes_per_use;

      stats.push({
        tool_id: config.tool_id,
        display_name: config.display_name,
        minutes_per_use: config.minutes_per_use,
        tracking_method: config.tracking_method,
        description: config.description,
        is_external: config.is_external,
        tracking_notes: config.tracking_notes,
        run_frequency: config.run_frequency,
        run_interval_days: config.run_interval_days,
        first_run_date: config.first_run_date,
        next_run_date: config.next_run_date,
        historical_runs_seeded: config.historical_runs_seeded ?? false,
        total_uses: totalUses,
        total_minutes_saved: totalMinutes,
        total_hours_saved: Math.round((totalMinutes / 60) * 10) / 10,
        last_used: lastUsed?.created_at || null,
        unique_users: uniqueUsers,
        repeat_users: repeatUsers,
        completion_rate: completionRate,
        avg_duration_seconds: avgDuration,
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
