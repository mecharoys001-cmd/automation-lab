// app/api/usage/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Auth is optional — unauthenticated usage is still tracked
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { tool_id, content_hash, metadata, status, duration_seconds, error_message, usage_session_id } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Validate tool_id against tool_config table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: toolConfig } = await (svc.from('tool_config') as any)
      .select('tool_id')
      .eq('tool_id', tool_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!toolConfig) {
      return NextResponse.json(
        { error: 'Invalid or inactive tool_id' },
        { status: 400 }
      );
    }

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

    // Insert usage event — user_email/user_id come from session, NEVER from body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_usage') as any).insert({
      tool_id,
      content_hash: content_hash || null,
      user_email: user?.email || null,
      user_id: user?.id || null,
      status: status || 'completed',
      duration_seconds: duration_seconds ?? null,
      error_message: error_message || null,
      usage_session_id: usage_session_id || null,
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
