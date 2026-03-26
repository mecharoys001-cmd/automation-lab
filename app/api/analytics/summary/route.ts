import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMasterAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const masterErr = requireMasterAdmin(auth.user);
    if (masterErr) return masterErr;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const svc = createServiceClient();

    // Fetch all events within the time range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error } = await (svc.from('analytics_events') as any)
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allEvents = events ?? [];

    // Compute summary stats
    const totalEvents = allEvents.length;
    const pageViews = allEvents.filter((e: { event_type: string }) => e.event_type === 'page_view').length;
    const buttonClicks = allEvents.filter((e: { event_type: string }) => e.event_type === 'button_click').length;
    const formSubmits = allEvents.filter((e: { event_type: string }) => e.event_type === 'form_submit').length;

    // Unique users
    const uniqueUsers = new Set(allEvents.map((e: { user_email: string }) => e.user_email));

    // Unique sessions
    const uniqueSessions = new Set(allEvents.map((e: { session_id: string }) => e.session_id));

    // Most visited pages (top 10)
    const pageCounts: Record<string, number> = {};
    for (const e of allEvents) {
      if (e.event_type === 'page_view') {
        pageCounts[e.page_path] = (pageCounts[e.page_path] || 0) + 1;
      }
    }
    const topPages = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    // Most clicked buttons (top 10)
    const buttonCounts: Record<string, number> = {};
    for (const e of allEvents) {
      if (e.event_type === 'button_click') {
        const key = e.element_text || e.element_id || 'unknown';
        buttonCounts[key] = (buttonCounts[key] || 0) + 1;
      }
    }
    const topButtons = Object.entries(buttonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    // Most active users (top 10)
    const userCounts: Record<string, number> = {};
    for (const e of allEvents) {
      const key = e.user_email || e.user_id;
      userCounts[key] = (userCounts[key] || 0) + 1;
    }
    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([user, count]) => ({ user, count }));

    // Events per day (for chart)
    const dailyCounts: Record<string, number> = {};
    for (const e of allEvents) {
      const day = e.created_at.slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }
    const eventsPerDay = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      totalEvents,
      pageViews,
      buttonClicks,
      formSubmits,
      uniqueUsers: uniqueUsers.size,
      uniqueSessions: uniqueSessions.size,
      topPages,
      topButtons,
      topUsers,
      eventsPerDay,
      periodDays: days,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
