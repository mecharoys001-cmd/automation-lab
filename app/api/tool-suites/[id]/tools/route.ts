// app/api/tool-suites/[id]/tools/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const adminInfo = await getSiteAdmin(user.email);
  if (!isSiteAdmin(adminInfo)) return null;
  return user;
}

// GET — List tools in suite
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tools, error } = await (svc.from('tool_suite_tools') as any)
      .select('*')
      .eq('suite_id', id)
      .order('added_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ tools: tools ?? [] }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]/tools] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST { tool_id } — Add tool to suite (site admin only)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { tool_id } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Check suite exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: suite } = await (svc.from('tool_suites') as any)
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
    }

    // Check for duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('tool_suite_tools') as any)
      .select('id')
      .eq('suite_id', id)
      .eq('tool_id', tool_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Tool already in this suite' }, { status: 409 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_suite_tools') as any)
      .insert({ suite_id: id, tool_id })
      .select()
      .single();

    if (error) {
      console.error('[tool-suites/[id]/tools] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (err) {
    console.error('[tool-suites/[id]/tools] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE with body { tool_id } — Remove tool from suite (site admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { tool_id } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_suite_tools') as any)
      .delete()
      .eq('suite_id', id)
      .eq('tool_id', tool_id);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]/tools] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
