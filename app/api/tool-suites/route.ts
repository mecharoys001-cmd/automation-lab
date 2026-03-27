// app/api/tool-suites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET — List suites. Site admins see all; non-admins see only their suites.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = createServiceClient();
    const adminInfo = await getSiteAdmin(user.email);

    if (isSiteAdmin(adminInfo)) {
      // Site admins see all suites with counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: suites, error } = await (svc.from('tool_suites') as any)
        .select('*, tool_suite_tools(id), tool_suite_members(id)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const result = (suites ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        created_by: s.created_by,
        created_at: s.created_at,
        updated_at: s.updated_at,
        tool_count: s.tool_suite_tools?.length ?? 0,
        member_count: s.tool_suite_members?.length ?? 0,
      }));

      return NextResponse.json({ suites: result }, { status: 200 });
    }

    // Non-admins: only suites they belong to
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberships, error: memErr } = await (svc.from('tool_suite_members') as any)
      .select('suite_id, role')
      .ilike('user_email', user.email);

    if (memErr) throw memErr;

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ suites: [] }, { status: 200 });
    }

    const suiteIds = memberships.map((m: any) => m.suite_id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: suites, error } = await (svc.from('tool_suites') as any)
      .select('*, tool_suite_tools(id), tool_suite_members(id)')
      .in('id', suiteIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const roleMap = new Map(memberships.map((m: any) => [m.suite_id, m.role]));

    const result = (suites ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      created_by: s.created_by,
      created_at: s.created_at,
      updated_at: s.updated_at,
      tool_count: s.tool_suite_tools?.length ?? 0,
      member_count: s.tool_suite_members?.length ?? 0,
      my_role: roleMap.get(s.id) ?? null,
    }));

    return NextResponse.json({ suites: result }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST { name, slug?, description? } — Create suite (site admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminInfo = await getSiteAdmin(user.email);
    if (!isSiteAdmin(adminInfo)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const finalSlug = slug?.trim() || slugify(name);

    if (!finalSlug) {
      return NextResponse.json({ error: 'Could not generate a valid slug from name' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Check slug uniqueness
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('tool_suites') as any)
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A suite with this slug already exists' }, { status: 409 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_suites') as any)
      .insert({
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        created_by: user.email,
      })
      .select()
      .single();

    if (error) {
      console.error('[tool-suites] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ suite: data }, { status: 201 });
  } catch (err) {
    console.error('[tool-suites] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
