// app/api/activity/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';

const CLIENT_ALLOWED_EVENTS = ['tool_open'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, tool_id, metadata } = body;

    if (!event_type || !CLIENT_ALLOWED_EVENTS.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('activity_log') as any).insert({
      event_type,
      user_email: user.email,
      user_id: user.id,
      tool_id: tool_id || null,
      metadata: metadata || {},
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
    });

    if (error) {
      console.error('[activity-log] Insert failed:', error);
      return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[activity-log] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
