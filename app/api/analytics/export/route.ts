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
    const format = searchParams.get('format') || 'json';
    const eventType = searchParams.get('event_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const svc = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (svc.from('analytics_events') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (eventType) query = query.eq('event_type', eventType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const events = data ?? [];

    if (format === 'csv') {
      const headers = ['id', 'user_id', 'user_email', 'session_id', 'event_type', 'page_path', 'element_id', 'element_text', 'user_agent', 'created_at'];
      const csvRows = [headers.join(',')];

      for (const event of events) {
        const row = headers.map(h => {
          const val = event[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Escape CSV values containing commas, quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvRows.push(row.join(','));
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(events, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="analytics_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
