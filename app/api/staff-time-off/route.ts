import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { TimeOffRequestType } from '@/types/staff-time-off';

// ── Helpers ─────────────────────────────────────────────────────────────────

const VALID_TYPES: TimeOffRequestType[] = ['full_day', 'partial_day', 'multi_day'];

async function getAuthenticatedStaff() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return { staff: null, error: 'Authentication required', status: 401 };

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staffRows } = await (supabase.from('staff') as any)
    .select('id, program_id, first_name, last_name, email')
    .ilike('email', user.email)
    .eq('is_active', true)
    .limit(1);

  const staff = staffRows?.[0];
  if (!staff) return { staff: null, error: 'No active staff profile found', status: 403 };

  return { staff, error: null, status: 200 };
}

// ── POST: Create a time off request ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const staff = auth.staff!;

    const body = await request.json();
    const { request_type, start_date, end_date, start_time, end_time, note } = body;

    // Validate required fields
    if (!request_type || !VALID_TYPES.includes(request_type)) {
      return NextResponse.json({ error: 'Invalid or missing request_type' }, { status: 400 });
    }
    if (!start_date) {
      return NextResponse.json({ error: 'start_date is required' }, { status: 400 });
    }
    if (typeof note !== 'string' || note.trim().length === 0) {
      return NextResponse.json({ error: 'A note is required' }, { status: 400 });
    }

    // Type-specific validation
    if (request_type === 'partial_day') {
      if (!start_time || !end_time) {
        return NextResponse.json(
          { error: 'Partial-day requests require start_time and end_time' },
          { status: 400 },
        );
      }
      if (end_time <= start_time) {
        return NextResponse.json(
          { error: 'end_time must be after start_time' },
          { status: 400 },
        );
      }
    }

    if (request_type === 'multi_day') {
      if (!end_date) {
        return NextResponse.json({ error: 'Multi-day requests require end_date' }, { status: 400 });
      }
      if (end_date < start_date) {
        return NextResponse.json({ error: 'end_date must be on or after start_date' }, { status: 400 });
      }
    }

    // Build insert payload
    const insertPayload = {
      program_id: staff.program_id,
      staff_id: staff.id,
      request_type,
      start_date,
      end_date: end_date || start_date,
      start_time: request_type === 'partial_day' ? start_time : null,
      end_time: request_type === 'partial_day' ? end_time : null,
      note: note.trim(),
    };

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff_time_off_requests') as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// ── GET: List own time off requests ────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const staff = auth.staff!;

    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff_time_off_requests') as any)
      .select('*')
      .eq('staff_id', staff.id)
      .eq('program_id', staff.program_id)
      .order('submitted_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
