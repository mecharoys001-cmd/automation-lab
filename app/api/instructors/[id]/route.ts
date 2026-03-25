import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin } from '@/lib/api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    if ('first_name' in body && String(body.first_name).trim().length > 50) {
      return NextResponse.json({ error: 'First name must be 50 characters or less' }, { status: 400 });
    }

    if ('last_name' in body && String(body.last_name).trim().length > 50) {
      return NextResponse.json({ error: 'Last name must be 50 characters or less' }, { status: 400 });
    }

    if ('email' in body && body.email && String(body.email).trim().length > 255) {
      return NextResponse.json({ error: 'Email must be 255 characters or less' }, { status: 400 });
    }

    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if ('phone' in body && body.phone && String(body.phone).trim().length > 20) {
      return NextResponse.json({ error: 'Phone must be 20 characters or less' }, { status: 400 });
    }

    if (body.phone) {
      const phone = String(body.phone).trim();
      if (!/^[0-9\s\-()+]+$/.test(phone) || !/[0-9]/.test(phone)) {
        return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('instructors') as any)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instructor: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('instructors') as any)
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
