import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { session_id, event_type, page_path, element_id, element_text, metadata } = body;

    // Validate required fields
    if (!session_id || !event_type || !page_path) {
      return NextResponse.json(
        { error: 'session_id, event_type, and page_path are required' },
        { status: 400 }
      );
    }

    if (!['page_view', 'button_click', 'form_submit'].includes(event_type)) {
      return NextResponse.json(
        { error: 'event_type must be page_view, button_click, or form_submit' },
        { status: 400 }
      );
    }

    const svc = createServiceClient();

    // Insert event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('analytics_events') as any).insert({
      user_id: user.id,
      user_email: user.email,
      session_id,
      event_type,
      page_path,
      element_id: element_id || null,
      element_text: element_text || null,
      user_agent: request.headers.get('user-agent') || null,
      metadata: metadata || {},
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cleanup: delete events older than 30 days (run opportunistically)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('analytics_events') as any)
      .delete()
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
