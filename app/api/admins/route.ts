import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';
import type { RoleLevel } from '@/types/database';

const VALID_ROLE_LEVELS: RoleLevel[] = ['master', 'standard', 'editor'];

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Only master admins can view the admin list (role management)
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('admins') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validAdmins: typeof data = [];
    const invalidIds: string[] = [];
    for (const a of data ?? []) {
      if (a.google_email && EMAIL_RE.test(a.google_email)) {
        validAdmins.push(a);
      } else {
        invalidIds.push(a.id);
      }
    }

    // Purge invalid-email rows so they don't linger in the database
    if (invalidIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('admin_programs') as any)
        .delete()
        .in('admin_id', invalidIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('admins') as any)
        .delete()
        .in('id', invalidIds);
    }

    return NextResponse.json({ admins: validAdmins });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.google_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.google_email)) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if (String(body.google_email).trim().length > 255) {
      return NextResponse.json({ error: 'Email must be 255 characters or less' }, { status: 400 });
    }

    if (body.display_name && String(body.display_name).trim().length > 100) {
      return NextResponse.json({ error: 'Display name must be 100 characters or less' }, { status: 400 });
    }

    // Validate role_level is a known value
    const roleLevel = body.role_level ?? 'standard';
    if (!VALID_ROLE_LEVELS.includes(roleLevel)) {
      return NextResponse.json(
        { error: `Invalid role_level: must be one of ${VALID_ROLE_LEVELS.join(', ')}` },
        { status: 400 },
      );
    }

    // Whitelist fields to prevent arbitrary column injection
    const insertPayload = {
      google_email: String(body.google_email).trim(),
      display_name: body.display_name ? String(body.display_name).trim() : null,
      role_level: roleLevel,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('admins') as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'admin_role_change',
      action: 'create',
      email: insertPayload.google_email,
      role_level: insertPayload.role_level,
      display_name: body.display_name ?? null,
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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });
    }

    const body = await request.json();

    // Validate email if being updated
    if (body.google_email && String(body.google_email).trim().length > 255) {
      return NextResponse.json({ error: 'Email must be 255 characters or less' }, { status: 400 });
    }

    if (body.google_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.google_email)) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if ('display_name' in body && body.display_name && String(body.display_name).trim().length > 100) {
      return NextResponse.json({ error: 'Display name must be 100 characters or less' }, { status: 400 });
    }

    // Validate role_level if provided
    if ('role_level' in body && !VALID_ROLE_LEVELS.includes(body.role_level)) {
      return NextResponse.json(
        { error: `Invalid role_level: must be one of ${VALID_ROLE_LEVELS.join(', ')}` },
        { status: 400 },
      );
    }

    // Whitelist fields to prevent arbitrary column injection
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
      const { data: current } = await (supabase.from('admins') as any)
        .select('role_level')
        .eq('id', id)
        .maybeSingle();

      if (current?.role_level === 'master') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase.from('admins') as any)
          .select('id', { count: 'exact', head: true })
          .eq('role_level', 'master');

        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last master admin' },
            { status: 400 },
          );
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('admins') as any)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'admin_role_change',
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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const masterCheck = requireMasterAdmin(auth.user);
    if (masterCheck) return masterCheck;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing admin id' }, { status: 400 });
    }

    // Fetch admin details before deletion for audit trail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('admins') as any)
      .select('google_email, role_level, display_name')
      .eq('id', id)
      .maybeSingle();

    // Prevent deletion of the last master admin
    if (existing?.role_level === 'master') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase.from('admins') as any)
        .select('id', { count: 'exact', head: true })
        .eq('role_level', 'master');

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last master admin' },
          { status: 400 },
        );
      }
    }

    // Explicitly remove admin_programs rows first to avoid relying solely on
    // CASCADE which can be slow when the cross-join backfill created many rows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: apError } = await (supabase.from('admin_programs') as any)
      .delete()
      .eq('admin_id', id);

    if (apError) {
      console.error('admin_programs delete failed:', apError.message);
      return NextResponse.json(
        { error: 'Failed to clean up admin program associations' },
        { status: 500 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('admins') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'admin_role_change',
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
