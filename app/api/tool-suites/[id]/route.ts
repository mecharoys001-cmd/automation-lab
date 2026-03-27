// app/api/tool-suites/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ? user : null;
}

async function isSuiteManagerOrAdmin(email: string, suiteId: string) {
  const adminInfo = await getSiteAdmin(email);
  if (isSiteAdmin(adminInfo)) return { allowed: true, isSiteAdmin: true, role: 'site_admin' as const };

  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('tool_suite_members') as any)
    .select('role')
    .eq('suite_id', suiteId)
    .ilike('user_email', email)
    .maybeSingle();

  if (data?.role === 'manager') {
    return { allowed: true, isSiteAdmin: false, role: 'manager' as const };
  }

  return { allowed: false, isSiteAdmin: false, role: null };
}

// GET — Suite detail with tools and members. Site admin or suite manager.
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const auth = await isSuiteManagerOrAdmin(user.email, id);
    if (!auth.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: suite, error } = await (svc.from('tool_suites') as any)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!suite) {
      return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tools } = await (svc.from('tool_suite_tools') as any)
      .select('*')
      .eq('suite_id', id)
      .order('added_at', { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members } = await (svc.from('tool_suite_members') as any)
      .select('*')
      .eq('suite_id', id)
      .order('granted_at', { ascending: false });

    return NextResponse.json({
      suite,
      tools: tools ?? [],
      members: members ?? [],
    }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT { name?, description? } — Update suite (site admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminInfo = await getSiteAdmin(user.email);
    if (!isSiteAdmin(adminInfo)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, description } = body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_suites') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Suite not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ suite: data }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Delete suite (site admin only)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminInfo = await getSiteAdmin(user.email);
    if (!isSiteAdmin(adminInfo)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_suites') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
