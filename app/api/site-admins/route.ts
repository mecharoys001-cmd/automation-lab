import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteMasterAdmin } from '@/lib/site-rbac';

const VALID_ROLE_LEVELS = ['master', 'standard'] as const;

async function requireSiteMasterAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const siteAdmin = await getSiteAdmin(user.email);
  if (!isSiteMasterAdmin(siteAdmin)) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden — site master admin required' }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function GET() {
  try {
    const auth = await requireSiteMasterAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('site_admins') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSiteMasterAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if (String(body.email).trim().length > 255) {
      return NextResponse.json({ error: 'Email must be 255 characters or less' }, { status: 400 });
    }

    if (body.display_name && String(body.display_name).trim().length > 100) {
      return NextResponse.json({ error: 'Display name must be 100 characters or less' }, { status: 400 });
    }

    const roleLevel = body.role_level ?? 'standard';
    if (!VALID_ROLE_LEVELS.includes(roleLevel)) {
      return NextResponse.json(
        { error: `Invalid role_level: must be one of ${VALID_ROLE_LEVELS.join(', ')}` },
        { status: 400 },
      );
    }

    const insertPayload = {
      google_email: String(body.email).trim(),
      display_name: body.display_name ? String(body.display_name).trim() : null,
      role_level: roleLevel,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('site_admins') as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'site_admin_role_change',
      action: 'create',
      email: insertPayload.google_email,
      role_level: insertPayload.role_level,
      display_name: insertPayload.display_name,
      admin_id: data.id,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ admin: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSiteMasterAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });
    }

    const body = await request.json();

    if (body.google_email && String(body.google_email).trim().length > 255) {
      return NextResponse.json({ error: 'Email must be 255 characters or less' }, { status: 400 });
    }

    if (body.google_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.google_email)) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if ('display_name' in body && body.display_name && String(body.display_name).trim().length > 100) {
      return NextResponse.json({ error: 'Display name must be 100 characters or less' }, { status: 400 });
    }

    if ('role_level' in body && !VALID_ROLE_LEVELS.includes(body.role_level)) {
      return NextResponse.json(
        { error: `Invalid role_level: must be one of ${VALID_ROLE_LEVELS.join(', ')}` },
        { status: 400 },
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if ('google_email' in body) updatePayload.google_email = String(body.google_email).trim();
    if ('display_name' in body) updatePayload.display_name = body.display_name ? String(body.display_name).trim() : null;
    if ('role_level' in body) updatePayload.role_level = body.role_level;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Prevent demoting the last master admin
    if ('role_level' in updatePayload && updatePayload.role_level !== 'master') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: current } = await (supabase.from('site_admins') as any)
        .select('role_level')
        .eq('id', id)
        .maybeSingle();

      if (current?.role_level === 'master') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase.from('site_admins') as any)
          .select('id', { count: 'exact', head: true })
          .eq('role_level', 'master');

        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last site master admin' },
            { status: 400 },
          );
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('site_admins') as any)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'site_admin_role_change',
      action: 'update',
      admin_id: id,
      changes: updatePayload,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ admin: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSiteMasterAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('site_admins') as any)
      .select('google_email, role_level, display_name')
      .eq('id', id)
      .maybeSingle();

    // Prevent deletion of the last master admin
    if (existing?.role_level === 'master') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase.from('site_admins') as any)
        .select('id', { count: 'exact', head: true })
        .eq('role_level', 'master');

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last site master admin' },
          { status: 400 },
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('site_admins') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'site_admin_role_change',
      action: 'delete',
      admin_id: id,
      email: existing?.google_email ?? null,
      role_level: existing?.role_level ?? null,
      timestamp: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
