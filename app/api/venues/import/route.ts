import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

interface VenueRow {
  name: string;
  space_type?: string;
  max_capacity?: number | null;
  address?: string | null;
  is_virtual?: boolean;
  amenities?: string[] | null;
  description?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { rows } = (await request.json()) as { rows: VenueRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Check for duplicate names against existing venues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('venues') as any)
      .select('name')
      .order('name');

    const existingNames = new Set(
      (existing ?? []).map((v: { name: string }) => v.name.toLowerCase().trim()),
    );

    const toInsert: VenueRow[] = [];
    let skipped = 0;

    for (const row of rows) {
      if (existingNames.has(row.name.toLowerCase().trim())) {
        skipped++;
        continue;
      }
      existingNames.add(row.name.toLowerCase().trim());
      toInsert.push({
        name: row.name.trim(),
        space_type: row.space_type || 'other',
        max_capacity: row.max_capacity ?? null,
        address: row.address || null,
        is_virtual: row.is_virtual ?? false,
        amenities: row.amenities ?? null,
        description: row.description || null,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, skipped, total: rows.length });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('venues') as any)
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
