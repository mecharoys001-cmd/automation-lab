import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';

const VALID_EVENT_TYPES = ['page_view', 'button_click', 'form_submit'];

interface AnalyticsEvent {
  session_id: string;
  event_type: string;
  page_path: string;
  element_id?: string;
  element_text?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Support both single event and batch array
    const events: AnalyticsEvent[] = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 });
    }

    // Cap batch size to prevent abuse
    if (events.length > 50) {
      return NextResponse.json({ error: 'Batch size limit is 50 events' }, { status: 400 });
    }

    // Validate all events
    for (const event of events) {
      if (!event.session_id || !event.event_type || !event.page_path) {
        return NextResponse.json(
          { error: 'Each event requires session_id, event_type, and page_path' },
          { status: 400 }
        );
      }
      if (!VALID_EVENT_TYPES.includes(event.event_type)) {
        return NextResponse.json(
          { error: 'event_type must be page_view, button_click, or form_submit' },
          { status: 400 }
        );
      }
    }

    const userAgent = request.headers.get('user-agent') || null;

    // Fire-and-forget: insert all events in a single batch
    const svc = createServiceClient();
    const rows = events.map((event) => ({
      user_id: user.id,
      user_email: user.email,
      session_id: event.session_id,
      event_type: event.event_type,
      page_path: event.page_path,
      element_id: event.element_id || null,
      element_text: event.element_text || null,
      user_agent: userAgent,
      metadata: event.metadata || {},
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('analytics_events') as any)
      .insert(rows)
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('[analytics] Batch insert failed:', error);
      })
      .catch((err: unknown) => {
        console.error('[analytics] Unexpected error:', err);
      });

    // Return immediately
    return NextResponse.json({ success: true, count: events.length }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
