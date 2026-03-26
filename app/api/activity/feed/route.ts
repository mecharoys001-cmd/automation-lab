// app/api/activity/feed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const siteAdmin = await getSiteAdmin(user.email);
    if (!isSiteAdmin(siteAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const pageSize = parseInt(request.nextUrl.searchParams.get('pageSize') || '50');
    const eventFilter = request.nextUrl.searchParams.get('event_type');
    const offset = (page - 1) * pageSize;

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (svc.from('activity_log') as any)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (eventFilter) {
      query = query.eq('event_type', eventFilter);
    }

    const { data: items, count, error } = await query;

    if (error) throw error;

    // Enrich with tool names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs } = await (svc.from('tool_config') as any)
      .select('tool_id, display_name');

    const toolNameMap: Record<string, string> = {};
    for (const c of configs || []) {
      toolNameMap[c.tool_id] = c.display_name;
    }

    const enrichedItems = (items || []).map((item: Record<string, unknown>) => ({
      ...item,
      tool_name: item.tool_id ? toolNameMap[item.tool_id as string] || item.tool_id : null,
    }));

    // Also pull recent tool_usage events for the feed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let usageQuery = (svc.from('tool_usage') as any)
      .select('id, tool_id, user_email, status, duration_seconds, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (eventFilter === 'tool_complete') {
      usageQuery = usageQuery.eq('status', 'completed');
    } else if (eventFilter === 'tool_error') {
      usageQuery = usageQuery.eq('status', 'error');
    } else if (eventFilter === 'login') {
      // Don't include tool_usage events when filtering for logins only
      usageQuery = null;
    }

    let usageAsActivity: Record<string, unknown>[] = [];
    if (usageQuery) {
      const { data: recentUsage } = await usageQuery;
      usageAsActivity = (recentUsage || []).map((u: Record<string, unknown>) => ({
        id: u.id,
        event_type: u.status === 'error' ? 'tool_error' : 'tool_complete',
        user_email: u.user_email,
        tool_id: u.tool_id,
        tool_name: u.tool_id ? toolNameMap[u.tool_id as string] || u.tool_id : null,
        metadata: {
          ...(u.metadata as Record<string, unknown> || {}),
          duration_seconds: u.duration_seconds,
          status: u.status,
        },
        created_at: u.created_at,
      }));
    }

    // Merge and sort both streams by created_at
    const allItems = [...enrichedItems, ...usageAsActivity]
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
      .slice(0, pageSize);

    return NextResponse.json({
      items: allItems,
      total: (count || 0) + usageAsActivity.length,
      page,
      pageSize,
    });
  } catch (err) {
    console.error('[activity-feed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
