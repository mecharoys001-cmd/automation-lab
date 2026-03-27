// app/api/usage/config/seed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';
import { calculateExpectedRuns } from '@/lib/usage-calculations';
import type { SupabaseClient } from '@supabase/supabase-js';

function getIntervalDays(frequency: string, customDays?: number | null): number {
  switch (frequency) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'custom': return customDays || 30;
    default: return 30;
  }
}

function computeNextRunDate(
  firstRunDate: string,
  frequency: string,
  customDays?: number | null,
): string | null {
  const intervalDays = getIntervalDays(frequency, customDays);
  const start = new Date(firstRunDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(start);
  while (next < today) {
    next.setDate(next.getDate() + intervalDays);
  }
  return next.toISOString().split('T')[0];
}

async function seedHistoricalEvents(
  svc: SupabaseClient,
  toolId: string,
  count: number,
  firstRunDate: string,
  frequency: string,
  customDays?: number | null,
) {
  const intervalDays = getIntervalDays(frequency, customDays);
  const start = new Date(firstRunDate);
  const rows = [];

  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(eventDate.getDate() + i * intervalDays);
    rows.push({
      tool_id: toolId,
      metadata: { auto_seeded: true, run_number: i + 1 },
      created_at: eventDate.toISOString(),
    });
  }

  if (rows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_usage') as any).insert(rows);
    if (error) {
      console.error('[usage-config-seed] Failed to seed historical events:', error);
      throw error;
    }
  }
}

// POST — seed historical usage events for an existing tool
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const siteAdmin = await getSiteAdmin(user.email);
    if (!isSiteAdmin(siteAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tool_id } = body;

    if (!tool_id) {
      return NextResponse.json(
        { error: 'tool_id is required' },
        { status: 400 }
      );
    }

    const svc = createServiceClient();

    // Fetch tool config for server-side recalculation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: toolConfig, error: fetchError } = await (svc.from('tool_config') as any)
      .select('first_run_date, run_frequency, run_interval_days, historical_runs_seeded')
      .eq('tool_id', tool_id)
      .single();

    if (fetchError || !toolConfig) {
      return NextResponse.json(
        { error: 'Tool config not found' },
        { status: 404 }
      );
    }

    // Check if already seeded
    if (toolConfig.historical_runs_seeded) {
      return NextResponse.json(
        { error: 'Historical runs have already been seeded for this tool', already_seeded: true },
        { status: 409 }
      );
    }

    const { first_run_date, run_frequency, run_interval_days } = toolConfig;

    if (!first_run_date || !run_frequency) {
      return NextResponse.json(
        { error: 'Tool must have first_run_date and run_frequency configured' },
        { status: 400 }
      );
    }

    // Server-side calculation of expected runs
    const count = calculateExpectedRuns(first_run_date, run_frequency, run_interval_days);

    if (count <= 0) {
      return NextResponse.json(
        { error: 'No runs to seed (check first_run_date and frequency)' },
        { status: 400 }
      );
    }

    // Seed the historical events
    await seedHistoricalEvents(svc, tool_id, count, first_run_date, run_frequency, run_interval_days);

    // Update next_run_date and mark as seeded
    const nextRunDate = computeNextRunDate(first_run_date, run_frequency, run_interval_days);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (svc.from('tool_config') as any)
      .update({
        next_run_date: nextRunDate,
        historical_runs_seeded: true,
        updated_at: new Date().toISOString(),
      })
      .eq('tool_id', tool_id);

    if (updateError) {
      console.error('[usage-config-seed] Failed to update tool_config:', updateError);
    }

    return NextResponse.json({ success: true, events_seeded: count }, { status: 200 });
  } catch (err) {
    console.error('[usage-config-seed] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
