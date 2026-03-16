import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

interface TagRow {
  name: string;
  color?: string | null;
  description?: string | null;
  category?: string | null;
  emoji?: string | null;
}

const isValidHex = (v: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(v.trim());

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

    const rows: (TagRow & { program_id: string })[] = rawRows.map((r) => ({
      name: String(r.name ?? '').trim(),
      color: r.color ? String(r.color).trim() : null,
      description: r.description ? String(r.description).trim() : null,
      category: r.category ? String(r.category).trim() : null,
      emoji: r.emoji ? String(r.emoji).trim() : null,
      program_id,
    }));

    // Filter out rows with invalid color (if provided)
    const validRows = rows.filter((r) => !r.color || isValidHex(r.color));

    // Check for duplicate names against existing tags in this program (case-insensitive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('tags') as any)
      .select('name')
      .eq('program_id', program_id)
      .order('name');

    const existingNames = new Set(
      (existing ?? []).map((t: { name: string }) => t.name.toLowerCase().trim()),
    );

    const toInsert: TagRow[] = [];
    let skipped = 0;

    for (const row of validRows) {
      if (!row.name) {
        skipped++;
        continue;
      }
      if (existingNames.has(row.name.toLowerCase())) {
        skipped++;
        continue;
      }
      existingNames.add(row.name.toLowerCase());
      toInsert.push(row);
    }

    // Count rows skipped due to invalid color
    skipped += rows.length - validRows.length;

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, skipped, total: rows.length });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('tags') as any)
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
