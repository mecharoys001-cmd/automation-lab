// app/api/tool-access/route.ts
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

// GET ?tool_id=X — list users with access to a tool
export async function GET(request: NextRequest) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_access') as any)
      .select('*')
      .eq('tool_id', tool_id)
      .order('granted_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ access: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error('[tool-access] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST { tool_id, user_email } — grant access to a user
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tool_id, user_email } = body;

    if (!tool_id || !user_email) {
      return NextResponse.json(
        { error: 'tool_id and user_email are required' },
        { status: 400 },
      );
    }

    const svc = createServiceClient();

    // Check for existing access (case-insensitive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('tool_access') as any)
      .select('id')
      .eq('tool_id', tool_id)
      .ilike('user_email', user_email.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'User already has access to this tool' },
        { status: 409 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_access') as any)
      .insert({
        tool_id,
        user_email: user_email.trim(),
        granted_by: user.email,
      })
      .select()
      .single();

    if (error) {
      console.error('[tool-access] POST insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (err) {
    console.error('[tool-access] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE ?tool_id=X&user_email=Y — revoke access
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tool_id = searchParams.get('tool_id');
    const user_email = searchParams.get('user_email');

    if (!tool_id || !user_email) {
      return NextResponse.json(
        { error: 'tool_id and user_email are required' },
        { status: 400 },
      );
    }

    const svc = createServiceClient();

    // Case-insensitive delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_access') as any)
      .delete()
      .eq('tool_id', tool_id)
      .ilike('user_email', user_email);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[tool-access] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
