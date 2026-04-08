import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireMasterAdmin, requireProgramAccess, scopedJsonResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    const isActive = searchParams.get('is_active');
    const skills = searchParams.get('skills');
    const search = searchParams.get('search');
    const email = searchParams.get('email');

    // Email-only lookup: Allow authenticated users to find their OWN staff record (portal login)
    // This runs BEFORE requireAdmin so staff members can look themselves up
    if (email && !programId) {
      // Verify the user is at least authenticated
      const authClient = await (await import('@/lib/supabase/server')).createClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (!user?.email) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Only allow looking up your own email — prevents cross-program data leaks
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Forbidden: you can only look up your own staff record' },
          { status: 403 },
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('staff') as any)
        .select('*')
        .ilike('email', email.trim())
        .eq('is_active', true)
        .limit(1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return scopedJsonResponse({ instructors: data ?? [] });
    }

    // All other operations require admin
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('staff') as any)
      .select('*, staff_tags(tag_id, tags:tags(id, name, emoji, category, description))')
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

    // Flatten staff_tags join into a top-level tags array of names
    const enriched = (data ?? []).map((s: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tagNames = ((s.staff_tags as any[]) ?? [])
        .map((st: { tags: { name: string } | null }) => st.tags?.name)
        .filter(Boolean);
      const { staff_tags: _, ...rest } = s;
      return { ...rest, additional_tags: tagNames };
    });

    return scopedJsonResponse({ instructors: enriched });
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

    const masterErr = requireMasterAdmin(auth.user);
    if (masterErr) return masterErr;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff') as any)
      .delete()
      .eq('program_id', programId)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete staff: ${error.message}` },
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

    // Extract tags before inserting the staff record
    const tagNames: string[] = body.additional_tags ?? [];
    delete body.additional_tags;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('staff') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync tags through junction table
    if (tagNames.length > 0 && data?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tags } = await (supabase.from('tags') as any)
        .select('id, name')
        .eq('program_id', body.program_id)
        .in('name', tagNames);
      if (tags?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('staff_tags') as any)
          .insert(tags.map((t: { id: string }) => ({ staff_id: data.id, tag_id: t.id })));
      }
    }

    return NextResponse.json({ instructor: { ...data, additional_tags: tagNames }, ...(duplicateNameWarning ? { warning: duplicateNameWarning } : {}) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
