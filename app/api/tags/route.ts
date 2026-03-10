import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

// Ensure this route is always dynamically evaluated (never cached)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('tags') as any)
      .select('*')
      .order('name');

    if (error) {
      console.error('[GET /api/tags] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[GET /api/tags] returning', data?.length ?? 0, 'tags, sample emoji:', data?.[0]?.emoji);

    // Fetch session counts per tag
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionTags } = await (supabase.from('session_tags') as any)
      .select('tag_id');

    const counts: Record<string, number> = {};
    if (sessionTags) {
      for (const row of sessionTags) {
        counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
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
    const supabase = createServiceClient();
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const hasDescription = body.description && typeof body.description === 'string' && body.description.trim();
    const hasEmoji = body.emoji && typeof body.emoji === 'string' && body.emoji.trim();
    const hasCategory = body.category && typeof body.category === 'string' && body.category.trim();
    const insertData: { name: string; description?: string; emoji?: string; category?: string } = { name: body.name.trim() };
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
      .upsert(insertData, { onConflict: 'name', ignoreDuplicates: false })
      .select()
      .single();

    // If v2 columns don't exist yet, retry without them
    let v2ColumnsSkipped = false;
    if (error && (hasDescription || hasEmoji || hasCategory) && (error.code === '42703' || error.message?.includes('column'))) {
      const { description: _d, emoji: _e, category: _c, ...insertBasic } = insertData;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (supabase.from('tags') as any)
        .upsert(insertBasic, { onConflict: 'name', ignoreDuplicates: false })
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
