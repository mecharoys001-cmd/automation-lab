/**
 * GET /api/user-preferences?key=<key>&program_id=<uuid>
 *   → { value: <JSONB> } or { value: null }
 *
 * PUT /api/user-preferences
 *   body: { key, program_id, value }
 *   → upserts and returns { ok: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const key = searchParams.get('key');
  const programId = searchParams.get('program_id');

  if (!key || !programId) {
    return NextResponse.json(
      { error: 'key and program_id query params are required' },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('user_preferences') as any)
    .select('value')
    .eq('user_email', auth.user.email)
    .eq('program_id', programId)
    .eq('key', key)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ value: data?.value ?? null });
}

export async function PUT(request: NextRequest) {
  const auth = await requireOrgMember();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { key, program_id: programId, value } = body;

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  if (!programId || typeof programId !== 'string') {
    return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
  }
  if (value === undefined) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('user_preferences') as any)
    .upsert(
      {
        user_email: auth.user.email,
        program_id: programId,
        key,
        value,
      },
      { onConflict: 'user_email,program_id,key' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
