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
    const programId = searchParams.get('program_id');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from_date');

    // program_id mode: fetch all sessions for a program (staff can view their program's full schedule)
    if (programId && !instructorId && !email) {
      // Staff can only request programs they have an active membership in
      if (auth.user.orgRole === 'staff') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: membership } = await (supabase.from('staff') as any)
          .select('id')
          .eq('id', auth.user.id)
          .eq('program_id', programId)
          .eq('is_active', true)
          .limit(1);

        if (!membership || membership.length === 0) {
          return NextResponse.json(
            { error: 'You do not have access to this program' },
            { status: 403 },
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('sessions') as any)
        .select(`
          *,
          venue:venues(*),
          program:programs(*),
          instructor:staff!sessions_staff_id_fkey(id, first_name, last_name, public_notes),
          template:session_templates(*),
          session_tags(tag:tags(*))
        `)
        .eq('program_id', programId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

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

      // Flatten session_tags junction into a tags array (matching admin API shape)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessions = ((data ?? []) as any[]).map((session: Record<string, unknown>) => {
        const { session_tags, ...rest } = session;
        const tags = Array.isArray(session_tags)
          ? session_tags.map((st: Record<string, unknown>) => st.tag).filter(Boolean)
          : [];
        return { ...rest, tags };
      });

      return NextResponse.json({ sessions });
    }

    if (!instructorId && !email) {
      return NextResponse.json(
        { error: 'Either instructor_id or email is required' },
        { status: 400 }
      );
    }

    // Resolve instructor ID(s) from email if needed
    let resolvedIds: string[] = [];
    if (instructorId) {
      resolvedIds = [instructorId];
    } else if (email) {
      // Find ALL staff records for this email (across programs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: instructors, error: instrError } = await (supabase.from('staff') as any)
        .select('id')
        .ilike('email', email.trim())
        .eq('is_active', true);

      if (instrError) {
        return NextResponse.json(
          { error: `Failed to look up instructor: ${instrError.message}` },
          { status: 500 }
        );
      }

      if (!instructors || instructors.length === 0) {
        return NextResponse.json(
          { error: 'No instructor found with that email' },
          { status: 404 }
        );
      }

      resolvedIds = instructors.map((i: { id: string }) => i.id);
    }

    if (resolvedIds.length === 0) {
      return NextResponse.json(
        { error: 'Either instructor_id or email is required' },
        { status: 400 }
      );
    }

    // Instructors can only view their own sessions
    if (auth.user.orgRole === 'staff') {
      if (!resolvedIds.includes(auth.user.id)) {
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
      .select(`
        *,
        venue:venues(*),
        program:programs(*),
        instructor:staff!sessions_staff_id_fkey(id, first_name, last_name, public_notes),
        template:session_templates(*),
        session_tags(tag:tags(*))
      `)
      .in('staff_id', resolvedIds)
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

    // Flatten session_tags junction into a tags array (matching admin API shape)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = ((data ?? []) as any[]).map((session: Record<string, unknown>) => {
      const { session_tags, ...rest } = session;
      const tags = Array.isArray(session_tags)
        ? session_tags.map((st: Record<string, unknown>) => st.tag).filter(Boolean)
        : [];
      return { ...rest, tags };
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
