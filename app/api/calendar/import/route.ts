import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { CalendarStatusType } from '@/types/database';

interface CsvRow {
  date: string;
  description: string;
  status_type: string;
  early_dismissal_time?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });

    if (row.date && row.status_type) {
      rows.push({
        date: row.date,
        description: row.description ?? '',
        status_type: row.status_type,
        early_dismissal_time: row.early_dismissal_time,
      });
    }
  }

  return rows;
}

const VALID_STATUS_TYPES: CalendarStatusType[] = ['no_school', 'early_dismissal', 'instructor_exception'];

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const programId = formData.get('program_id') as string | null;

    if (!file || !programId) {
      return NextResponse.json(
        { error: 'Missing file or program_id' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV. Expected headers: date, description, status_type, early_dismissal_time' },
        { status: 400 }
      );
    }

    const entries = rows
      .filter((r) => VALID_STATUS_TYPES.includes(r.status_type as CalendarStatusType))
      .map((r) => ({
        program_id: programId,
        date: r.date,
        description: r.description || null,
        status_type: r.status_type as CalendarStatusType,
        early_dismissal_time: r.early_dismissal_time || null,
      }));

    const skipped = rows.length - entries.length;

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
      total: rows.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
