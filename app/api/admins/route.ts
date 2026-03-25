import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('admins') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ admins: data ?? [] });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('admins') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      audit: 'admin_role_change',
      action: 'create',
      email: body.google_email,
      role_level: body.role_level ?? 'standard',
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('admins') as any)
      .update(body)
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
      changes: body,
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
