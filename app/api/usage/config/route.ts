// app/api/usage/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

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
    const { tool_id, display_name, minutes_per_use, tracking_method, description, is_external, tracking_notes } = body;

    if (!tool_id || !display_name || minutes_per_use === undefined || !tracking_method) {
      return NextResponse.json(
        { error: 'tool_id, display_name, minutes_per_use, and tracking_method are required' },
        { status: 400 }
      );
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
    const { tool_id, minutes_per_use, description, is_active } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (minutes_per_use !== undefined) updates.minutes_per_use = minutes_per_use;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

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
