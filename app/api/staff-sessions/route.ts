import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireOrgMember, getAccessibleProgramIds } from '@/lib/api-auth';
import type { AuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOrgMember();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const instructorId = searchParams.get('instructor_id');
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from_date');

    if (!instructorId && !email) {
      return NextResponse.json(
        { error: 'Either instructor_id or email is required' },
        { status: 400 }
      );
    }

    // Resolve instructor ID from email if needed
    let resolvedId = instructorId;
    if (!resolvedId && email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: instructor, error: instrError } = await (supabase.from('staff') as any)
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (instrError) {
        return NextResponse.json(
          { error: `Failed to look up instructor: ${instrError.message}` },
          { status: 500 }
        );
      }

      if (!instructor) {
        return NextResponse.json(
          { error: 'No instructor found with that email' },
          { status: 404 }
        );
      }

      resolvedId = (instructor as { id: string }).id;
    }

    // Instructors can only view their own sessions
    if (auth.user.orgRole === 'staff') {
      if (resolvedId !== auth.user.id) {
        return NextResponse.json(
          { error: 'Staff members can only view their own schedule' },
          { status: 403 },
        );
      }
    }

    // For admins, restrict to programs they can access
    let accessibleIds: string[] | null = null;
    if (auth.user.orgRole === 'admin' && auth.user.roleLevel) {
      accessibleIds = await getAccessibleProgramIds(
        { id: auth.user.id, email: auth.user.email, role: 'admin', roleLevel: auth.user.roleLevel } as AuthUser,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select('*, venue:venues(*), program:programs(*)')
      .eq('staff_id', resolvedId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (accessibleIds !== null) {
      query = query.in('program_id', accessibleIds);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (fromDate) {
      query = query.gte('date', fromDate);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
