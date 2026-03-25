/**
 * GET /api/reports/export-csv
 *
 * Generate CSV with columns: Instructor Name, Program, Tag, Total Hours
 * Streams response with proper headers.
 *
 * Query params:
 *   - program_id  (optional) UUID
 *   - start_date  (optional) YYYY-MM-DD
 *   - end_date    (optional) YYYY-MM-DD
 *
 * Returns: CSV file download
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requireAdmin } from '@/lib/api-auth';

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const supabase = createServiceClient();

    // Fetch sessions with instructor, program, and tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('sessions') as any)
      .select(`
        duration_minutes,
        instructor:instructors (id, first_name, last_name),
        program:programs (id, name),
        session_tags (
          tag:tags (id, name)
        )
      `)
      .in('status', ['completed', 'published']);

    if (programId) query = query.eq('program_id', programId);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data: sessions, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch sessions: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build aggregated rows: Instructor Name -> Program -> Tag -> Total Hours
    // Key: instructorId::programId::tagId
    const rows = new Map<string, {
      instructor_name: string;
      program_name: string;
      tag_name: string;
      total_minutes: number;
    }>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (sessions ?? []) as any[]) {
      const inst = s.instructor as { id: string; first_name: string; last_name: string } | null;
      const prog = s.program as { id: string; name: string } | null;
      const instructorName = inst ? `${inst.first_name} ${inst.last_name}` : 'Unassigned';
      const programName = prog?.name ?? 'Unknown';

      const tags = (s.session_tags ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((st: any) => st.tag as { id: string; name: string } | null)
        .filter(Boolean) as { id: string; name: string }[];

      if (tags.length === 0) {
        // Session has no tags — still include in CSV with empty tag
        const key = `${inst?.id ?? 'none'}::${prog?.id ?? 'none'}::none`;
        const existing = rows.get(key) ?? {
          instructor_name: instructorName,
          program_name: programName,
          tag_name: '',
          total_minutes: 0,
        };
        existing.total_minutes += s.duration_minutes;
        rows.set(key, existing);
      } else {
        for (const tag of tags) {
          const key = `${inst?.id ?? 'none'}::${prog?.id ?? 'none'}::${tag.id}`;
          const existing = rows.get(key) ?? {
            instructor_name: instructorName,
            program_name: programName,
            tag_name: tag.name,
            total_minutes: 0,
          };
          existing.total_minutes += s.duration_minutes;
          rows.set(key, existing);
        }
      }
    }

    // Build CSV content
    const header = 'Instructor Name,Program,Tag,Total Hours';
    const csvRows = Array.from(rows.values())
      .sort((a, b) => a.instructor_name.localeCompare(b.instructor_name))
      .map((row) => {
        const hours = Math.round((row.total_minutes / 60) * 100) / 100;
        return [
          escapeCSV(row.instructor_name),
          escapeCSV(row.program_name),
          escapeCSV(row.tag_name),
          hours.toString(),
        ].join(',');
      });

    const csvContent = [header, ...csvRows].join('\n');

    const filename = `symphonix-instructor-hours${startDate ? `-${startDate}` : ''}${endDate ? `-to-${endDate}` : ''}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('Reports export-csv API error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
