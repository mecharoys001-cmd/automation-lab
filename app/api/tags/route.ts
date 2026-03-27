import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

// Ensure this route is always dynamically evaluated (never cached)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json({ error: 'program_id query parameter is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('tags') as any)
      .select('*')
      .eq('program_id', programId)
      .order('name');

    if (error) {
      console.error('[GET /api/tags] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[GET /api/tags] returning', data?.length ?? 0, 'tags, sample emoji:', data?.[0]?.emoji);

    // Fetch session counts per tag from multiple sources, scoped to this program:
    // 1. session_tags junction table (additional tags) — join through sessions to filter by program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionTags } = await (supabase.from('session_tags') as any)
      .select('tag_id, session:sessions!inner(program_id)')
      .eq('session.program_id', programId);

    const counts: Record<string, number> = {};
    if (sessionTags) {
      for (const row of sessionTags) {
        counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
      }
    }

    // 2. Count tags used in template required_skills (scoped to program)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templates } = await (supabase.from('session_templates') as any)
      .select('id, required_skills')
      .eq('program_id', programId);

    // Fetch sessions scoped to this program to count by template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessions } = await (supabase.from('sessions') as any)
      .select('template_id')
      .eq('program_id', programId);

    // Count sessions per template
    const sessionsByTemplate: Record<string, number> = {};
    if (sessions) {
      for (const session of sessions) {
        if (session.template_id) {
          sessionsByTemplate[session.template_id] = (sessionsByTemplate[session.template_id] || 0) + 1;
        }
      }
    }

    // Map tag names to IDs
    const tagsByName: Record<string, string> = {};
    if (data) {
      for (const tag of data) {
        tagsByName[tag.name] = tag.id;
      }
    }

    // Count tags from required_skills
    if (templates) {
      for (const template of templates) {
        const sessionCount = sessionsByTemplate[template.id] || 0;
        if (sessionCount > 0 && template.required_skills && Array.isArray(template.required_skills)) {
          for (const skillName of template.required_skills) {
            const tagId = tagsByName[skillName];
            if (tagId) {
              counts[tagId] = (counts[tagId] || 0) + sessionCount;
            }
          }
        }
      }
    }

    return NextResponse.json({ tags: data ?? [], sessionCounts: counts });
  } catch (err) {
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

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!body.program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, body.program_id);
    if (accessErr) return accessErr;

    const hasDescription = body.description && typeof body.description === 'string' && body.description.trim();
    const hasEmoji = body.emoji && typeof body.emoji === 'string' && body.emoji.trim();
    const hasCategory = body.category && typeof body.category === 'string' && body.category.trim();
    const insertData: { name: string; program_id: string; description?: string; emoji?: string; category?: string } = { name: body.name.trim(), program_id: body.program_id };
    if (hasDescription) {
      insertData.description = body.description.trim();
    }
    if (hasEmoji) {
      insertData.emoji = body.emoji.trim();
    }
    if (hasCategory) {
      insertData.category = body.category.trim();
    }

    // Upsert: if a tag with this name exists, update its category/emoji/description
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (supabase.from('tags') as any)
      .upsert(insertData, { onConflict: 'name,program_id', ignoreDuplicates: false })
      .select()
      .single();

    // If v2 columns don't exist yet, retry without them
    let v2ColumnsSkipped = false;
    if (error && (hasDescription || hasEmoji || hasCategory) && (error.code === '42703' || error.message?.includes('column'))) {
      const { description: _d, emoji: _e, category: _c, ...insertBasic } = insertData;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (supabase.from('tags') as any)
        .upsert(insertBasic, { onConflict: 'name,program_id', ignoreDuplicates: false })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
      v2ColumnsSkipped = !error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tag: data,
      ...(v2ColumnsSkipped && { warning: 'Description/emoji/category fields unavailable — run migration to enable.' }),
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
