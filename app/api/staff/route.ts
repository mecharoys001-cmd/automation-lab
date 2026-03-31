import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireMasterAdmin, requireProgramAccess, scopedJsonResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    const isActive = searchParams.get('is_active');
    const skills = searchParams.get('skills');
    const search = searchParams.get('search');
    const email = searchParams.get('email');

    // Email-only lookup: Allow staff to find themselves without knowing program_id (portal login)
    if (email && !programId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('staff') as any)
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return scopedJsonResponse({ instructors: data ? [data] : [] });
    }

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('staff') as any)
      .select('*')
      .eq('program_id', programId)
      .order('last_name')
      .order('first_name');

    if (email) {
      query = query.eq('email', email.trim().toLowerCase());
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (skills) {
      query = query.contains('skills', [skills]);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return scopedJsonResponse({ instructors: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Global instructor deletion is destructive — restrict to master admins
    const masterErr = requireMasterAdmin(auth.user);
    if (masterErr) return masterErr;

    const supabase = createServiceClient();

    // Instructors are global (not program-scoped), so this deletes all.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff') as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Supabase requires a filter — this matches all real rows
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete instructors: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const accessErrPost = await requireProgramAccess(auth.user, body.program_id);
    if (accessErrPost) return accessErrPost;

    if (body.first_name && String(body.first_name).trim().length > 50) {
      return NextResponse.json({ error: 'First name must be 50 characters or less' }, { status: 400 });
    }

    if (body.last_name && String(body.last_name).trim().length > 50) {
      return NextResponse.json({ error: 'Last name must be 50 characters or less' }, { status: 400 });
    }

    if (body.email && String(body.email).trim().length > 255) {
      return NextResponse.json({ error: 'Email must be 255 characters or less' }, { status: 400 });
    }

    if (body.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(body.email).trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (body.phone && String(body.phone).trim().length > 20) {
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
    if (body.first_name && body.last_name) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dupes } = await (supabase.from('staff') as any)
        .select('id, first_name, last_name')
        .eq('program_id', body.program_id)
        .ilike('first_name', String(body.first_name).trim())
        .ilike('last_name', String(body.last_name).trim());
      if (dupes && dupes.length > 0) {
        duplicateNameWarning = `A staff member named "${String(body.first_name).trim()} ${String(body.last_name).trim()}" already exists`;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instructor: data, ...(duplicateNameWarning ? { warning: duplicateNameWarning } : {}) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
