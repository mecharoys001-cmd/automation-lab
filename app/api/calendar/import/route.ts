import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import type { CalendarStatusType } from '@/types/database';

interface CalendarRow {
  date: string;
  description?: string;
  status_type: string;
  early_dismissal_time?: string;
  target_instructor_id?: string;
}

const VALID_STATUS_TYPES: CalendarStatusType[] = ['no_school', 'early_dismissal', 'instructor_exception'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const { rows: rawRows, program_id: programId } = (await request.json()) as {
      rows: CalendarRow[];
      program_id: string;
    };

    if (!programId) {
      return NextResponse.json({ error: 'Missing program_id' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const entries: {
      program_id: string;
      date: string;
      description: string | null;
      status_type: CalendarStatusType;
      early_dismissal_time: string | null;
      target_instructor_id: string | null;
    }[] = [];
    let skipped = 0;

    for (const r of rawRows) {
      if (!DATE_RE.test(r.date)) {
        skipped++;
        continue;
      }
      if (!VALID_STATUS_TYPES.includes(r.status_type as CalendarStatusType)) {
        skipped++;
        continue;
      }
      entries.push({
        program_id: programId,
        date: r.date,
        description: r.description || null,
        status_type: r.status_type as CalendarStatusType,
        early_dismissal_time: r.early_dismissal_time || null,
        target_instructor_id: r.target_instructor_id || null,
      });
    }

    if (entries.length === 0) {
      return NextResponse.json({ imported: 0, skipped, total: rawRows.length });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('school_calendar') as any)
      .upsert(entries, { onConflict: 'program_id,date,target_instructor_id' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      imported: (data ?? []).length,
      skipped,
      total: rawRows.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
