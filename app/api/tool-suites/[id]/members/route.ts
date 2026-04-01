// app/api/tool-suites/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_ROLES = ['member', 'manager'] as const;

async function getAuthContext(suiteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const adminInfo = await getSiteAdmin(user.email);
  if (isSiteAdmin(adminInfo)) {
    return { user, role: 'site_admin' as const, isSiteAdmin: true };
  }

  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('tool_suite_members') as any)
    .select('role')
    .eq('suite_id', suiteId)
    .ilike('user_email', user.email)
    .maybeSingle();

  if (data?.role === 'manager') {
    return { user, role: 'manager' as const, isSiteAdmin: false };
  }

  return null;
}

// GET — List members. Site admin or suite manager.
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await getAuthContext(id);
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members, error } = await (svc.from('tool_suite_members') as any)
      .select('*')
      .eq('suite_id', id)
      .order('granted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ members: members ?? [] }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]/members] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST { user_email, role } — Add member.
// Site admin can set any role. Manager can only add 'member' role.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await getAuthContext(id);
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_email, role = 'member' } = body;

    if (!user_email) {
      return NextResponse.json({ error: 'user_email is required' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    // Managers can add members and other managers
    // (both site admins and suite managers can assign any valid role)

    const svc = createServiceClient();

    // Check for existing membership (case-insensitive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('tool_suite_members') as any)
      .select('id')
      .eq('suite_id', id)
      .ilike('user_email', user_email.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this suite' }, { status: 409 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_suite_members') as any)
      .insert({
        suite_id: id,
        user_email: user_email.trim(),
        role,
        granted_by: auth.user.email,
      })
      .select()
      .single();

    if (error) {
      console.error('[tool-suites/[id]/members] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ member: data }, { status: 201 });
  } catch (err) {
    console.error('[tool-suites/[id]/members] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT { user_email, role } — Change role (site admin or suite manager)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const auth = await getAuthContext(id);
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = auth.user;

    const body = await request.json();
    const { user_email, role } = body;

    if (!user_email || !role) {
      return NextResponse.json({ error: 'user_email and role are required' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_suite_members') as any)
      .update({ role })
      .eq('suite_id', id)
      .ilike('user_email', user_email.trim())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Member not found in this suite' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ member: data }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]/members] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE with body { user_email } — Remove member.
// Site admin can remove anyone. Manager can remove members only (not other managers).
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await getAuthContext(id);
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_email } = body;

    if (!user_email) {
      return NextResponse.json({ error: 'user_email is required' }, { status: 400 });
    }

    const svc = createServiceClient();

    // If not site admin (i.e. manager), check target's role first
    if (!auth.isSiteAdmin) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: target } = await (svc.from('tool_suite_members') as any)
        .select('role')
        .eq('suite_id', id)
        .ilike('user_email', user_email.trim())
        .maybeSingle();

      if (!target) {
        return NextResponse.json({ error: 'Member not found in this suite' }, { status: 404 });
      }

      if (target.role === 'manager') {
        return NextResponse.json({ error: 'Managers cannot remove other managers' }, { status: 403 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_suite_members') as any)
      .delete()
      .eq('suite_id', id)
      .ilike('user_email', user_email.trim());

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[tool-suites/[id]/members] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
