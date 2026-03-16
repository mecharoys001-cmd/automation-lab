import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

interface InstructorRow {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[] | null;
  availability_json?: Record<string, unknown> | null;
  is_active?: boolean;
  on_call?: boolean;
  notes?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rows: rawRows, program_id } = (await request.json()) as { rows: Record<string, any>[]; program_id?: string };

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const parseBool = (v: unknown): boolean =>
      v === true || v === 1 || (typeof v === 'string' && ['true', 'yes', '1'].includes(v.toLowerCase().trim()));

    const parseSemicolonList = (v: unknown): string[] | null => {
      if (v == null || v === '') return null;
      const items = String(v).split(';').map((s) => s.trim()).filter(Boolean);
      return items.length > 0 ? items : null;
    };

    const parseJSON = (v: unknown): Record<string, unknown> | null => {
      if (v == null || v === '') return null;
      try {
        return typeof v === 'string' ? JSON.parse(v) : v as Record<string, unknown>;
      } catch { return null; }
    };

    const rows: (InstructorRow & { program_id: string })[] = rawRows.map((r) => ({
      first_name: String(r.first_name ?? '').trim(),
      last_name: String(r.last_name ?? '').trim(),
      email: r.email ? String(r.email).trim().toLowerCase() : null,
      phone: r.phone ? String(r.phone).trim() : null,
      skills: parseSemicolonList(r.skills),
      availability_json: parseJSON(r.availability_json),
      is_active: r.is_active != null && r.is_active !== '' ? parseBool(r.is_active) : true,
      on_call: r.on_call != null && r.on_call !== '' ? parseBool(r.on_call) : false,
      notes: r.notes ? String(r.notes).trim() : null,
      program_id,
    }));

    // Check for duplicate emails against existing instructors in this program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('instructors') as any)
      .select('email')
      .eq('program_id', program_id)
      .not('email', 'is', null)
      .order('email');

    const existingEmails = new Set(
      (existing ?? []).map((i: { email: string }) => i.email.toLowerCase().trim()),
    );

    const toInsert: InstructorRow[] = [];
    let skipped = 0;

    for (const row of rows) {
      if (row.email && existingEmails.has(row.email.toLowerCase().trim())) {
        skipped++;
        continue;
      }
      if (row.email) {
        existingEmails.add(row.email.toLowerCase().trim());
      }
      toInsert.push(row);
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, skipped, total: rows.length });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('instructors') as any)
      .insert(toInsert)
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
      { status: 500 },
    );
  }
}
