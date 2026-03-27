import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { DEFAULT_SPACE_TYPES } from '../default-tags';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    // Fetch existing Space Types tags for this program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from('tags') as any)
      .select('name, category')
      .eq('category', 'Space Types')
      .eq('program_id', programId);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingNames = new Set((existing ?? []).map((t: { name: string }) => t.name));

    const missing = DEFAULT_SPACE_TYPES.filter(t => !existingNames.has(t.name));

    if (missing.length === 0) {
      return NextResponse.json({ added: 0, message: 'All default Space Types already exist.' });
    }

    const rows = missing.map(t => ({
      name: t.name,
      color: t.color,
      category: t.category ?? 'Space Types',
      description: t.description ?? null,
      emoji: t.emoji ?? null,
      program_id: programId,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('tags') as any).insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ added: missing.length, message: `Added ${missing.length} default Space Type tag(s).` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
