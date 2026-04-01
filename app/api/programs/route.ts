/**
 * GET /api/programs — Fetch all programs
 * POST /api/programs — Create a new program
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { DEFAULT_TAGS, DEFAULT_SPACE_TYPES } from '../seed/default-tags';
import { requireAdmin, requireMinRole, getAccessibleProgramIds, scopedJsonResponse } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    // Filter to only programs this admin can access
    const accessibleIds = await getAccessibleProgramIds(auth.user);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('programs') as any)
      .select('*')
      .order('start_date', { ascending: false });

    if (accessibleIds !== null) {
      query = query.in('id', accessibleIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch programs: ${error.message}` },
        { status: 500 }
      );
    }

    return scopedJsonResponse({
      programs: data ?? [],
      accessScoped: accessibleIds !== null,
      authorizedProgramCount: accessibleIds !== null ? accessibleIds.length : (data ?? []).length,
    });
  } catch (err) {
    console.error('Programs API error:', err);
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
    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const body = await request.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('programs') as any)
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-grant the creating admin access to this program
    const programId = data.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('admin_programs') as any)
      .insert({ admin_id: auth.user.id, program_id: programId });

    // Auto-copy default tags and space types into the new program
    const allDefaults = [...DEFAULT_TAGS, ...DEFAULT_SPACE_TYPES];
    const tagRows = allDefaults.map(t => ({
      name: t.name,
      color: t.color,
      category: t.category ?? null,
      description: t.description ?? null,
      emoji: t.emoji ?? null,
      program_id: programId,
      is_default: true,
    }));

    if (tagRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('tags') as any).insert(tagRows);
    }

    return NextResponse.json({ program: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
