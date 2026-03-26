import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = createServiceClient();

    // Verify program access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: instructor } = await (supabase.from('instructors') as any)
      .select('program_id, first_name, last_name')
      .eq('id', id)
      .single();

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    if (instructor.program_id) {
      const accessErr = await requireProgramAccess(auth.user, instructor.program_id);
      if (accessErr) return accessErr;
    }

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

    if (body.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(body.email).trim())) {
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

    // Check for duplicate name (non-blocking warning)
    let duplicateNameWarning: string | undefined;
    const firstName = 'first_name' in body ? String(body.first_name).trim() : instructor.first_name;
    const lastName = 'last_name' in body ? String(body.last_name).trim() : instructor.last_name;
    if (firstName && lastName && ('first_name' in body || 'last_name' in body)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dupes } = await (supabase.from('instructors') as any)
        .select('id, first_name, last_name')
        .eq('program_id', instructor.program_id)
        .ilike('first_name', firstName)
        .ilike('last_name', lastName)
        .neq('id', id);
      if (dupes && dupes.length > 0) {
        duplicateNameWarning = `A staff member named "${firstName} ${lastName}" already exists`;
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

    return NextResponse.json({ instructor: data, ...(duplicateNameWarning ? { warning: duplicateNameWarning } : {}) });
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

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = createServiceClient();

    // Verify program access before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inst } = await (supabase.from('instructors') as any)
      .select('program_id')
      .eq('id', id)
      .single();

    if (inst?.program_id) {
      const accessErr = await requireProgramAccess(auth.user, inst.program_id);
      if (accessErr) return accessErr;
    }

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
