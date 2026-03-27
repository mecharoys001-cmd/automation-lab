// app/api/usage/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';
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

  // Advance from first_run_date by intervals until we find the next date >= today
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
      console.error('[usage-config] Failed to seed historical events:', error);
    }
  }
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const siteAdmin = await getSiteAdmin(user.email);
  if (!isSiteAdmin(siteAdmin)) return null;
  return user;
}

// GET — return all tool configs
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_config') as any)
      .select('*')
      .order('tool_id');

    if (error) throw error;
    return NextResponse.json({ configs: data }, { status: 200 });
  } catch (err) {
    console.error('[usage-config] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new tool config
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      tool_id, display_name, minutes_per_use, tracking_method,
      description, is_external, tracking_notes,
      run_frequency, run_interval_days, first_run_date, historical_runs,
      visibility,
    } = body;

    if (visibility !== undefined && !['public', 'restricted', 'hidden'].includes(visibility)) {
      return NextResponse.json(
        { error: 'visibility must be one of: public, restricted, hidden' },
        { status: 400 }
      );
    }

    if (!tool_id || !display_name || minutes_per_use === undefined || !tracking_method) {
      return NextResponse.json(
        { error: 'tool_id, display_name, minutes_per_use, and tracking_method are required' },
        { status: 400 }
      );
    }

    // Compute next_run_date from frequency + first_run_date
    let next_run_date: string | null = null;
    if (run_frequency && first_run_date) {
      next_run_date = computeNextRunDate(first_run_date, run_frequency, run_interval_days);
    }

    const svc = createServiceClient();
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_config') as any)
      .insert({
        tool_id,
        display_name,
        minutes_per_use,
        tracking_method,
        description: description || null,
        is_external: is_external ?? false,
        tracking_notes: tracking_notes || null,
        run_frequency: run_frequency || null,
        run_interval_days: run_interval_days ?? null,
        first_run_date: first_run_date || null,
        historical_runs: historical_runs ?? 0,
        next_run_date,
        visibility: visibility ?? 'public',
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('[usage-config] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Seed historical usage events if requested
    if (historical_runs && historical_runs > 0 && first_run_date && run_frequency) {
      await seedHistoricalEvents(svc, tool_id, historical_runs, first_run_date, run_frequency, run_interval_days);
    }

    return NextResponse.json({ config: data }, { status: 201 });
  } catch (err) {
    console.error('[usage-config] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT — update a tool config (minutes_per_use, description, is_active)
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tool_id, display_name, minutes_per_use, description, is_active, tracking_notes, run_frequency, run_interval_days, first_run_date, visibility } = body;

    if (visibility !== undefined && !['public', 'restricted', 'hidden'].includes(visibility)) {
      return NextResponse.json(
        { error: 'visibility must be one of: public, restricted, hidden' },
        { status: 400 }
      );
    }

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (display_name !== undefined) updates.display_name = display_name;
    if (minutes_per_use !== undefined) updates.minutes_per_use = minutes_per_use;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;
    if (tracking_notes !== undefined) updates.tracking_notes = tracking_notes;
    if (run_frequency !== undefined) updates.run_frequency = run_frequency;
    if (run_interval_days !== undefined) updates.run_interval_days = run_interval_days;
    if (first_run_date !== undefined) updates.first_run_date = first_run_date;
    if (visibility !== undefined) updates.visibility = visibility;
    // Recompute next_run_date if frequency changed
    if (run_frequency !== undefined && first_run_date !== undefined) {
      updates.next_run_date = computeNextRunDate(first_run_date, run_frequency, run_interval_days);
    }

    const svc = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_config') as any)
      .update(updates)
      .eq('tool_id', tool_id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[usage-config] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a tool config by tool_id
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tool_id = searchParams.get('tool_id');

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Delete usage records first, then the config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: usageError } = await (svc.from('tool_usage') as any)
      .delete()
      .eq('tool_id', tool_id);

    if (usageError) throw usageError;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_config') as any)
      .delete()
      .eq('tool_id', tool_id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[usage-config] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
