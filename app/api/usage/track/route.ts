// app/api/usage/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

const VALID_TOOL_IDS = ['csv-dedup', 'reports', 'scheduler'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool_id, content_hash, metadata } = body;

    // Validate tool_id
    if (!tool_id || !VALID_TOOL_IDS.includes(tool_id)) {
      return NextResponse.json(
        { error: 'Invalid or missing tool_id' },
        { status: 400 }
      );
    }

    const svc = createServiceClient();

    // For CSV-based tools: check if this exact content was already tracked
    if (content_hash) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (svc.from('tool_usage') as any)
        .select('id')
        .eq('tool_id', tool_id)
        .eq('content_hash', content_hash)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Already tracked this exact file — skip
        return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
      }
    }

    // Insert usage event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_usage') as any).insert({
      tool_id,
      content_hash: content_hash || null,
      metadata: metadata || {},
    });

    if (error) {
      console.error('[usage-track] Insert failed:', error);
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[usage-track] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
