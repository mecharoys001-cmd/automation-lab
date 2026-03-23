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
  availability_json?: Record<string, unknown> | null;
  notes?: string | null;
  min_booking_duration_minutes?: number | null;
  max_booking_duration_minutes?: number | null;
  buffer_minutes?: number | null;
  advance_booking_days?: number | null;
  cancellation_window_hours?: number | null;
  cost_per_hour?: number | null;
  max_concurrent_bookings?: number;
  blackout_dates?: string[] | null;
  is_wheelchair_accessible?: boolean;
  subjects?: string[] | null;
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

    const parseIntOrNull = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = parseInt(String(v), 10);
      return isNaN(n) ? null : n;
    };

    const parseFloatOrNull = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = parseFloat(String(v));
      return isNaN(n) ? null : n;
    };

    const parseSemicolonList = (v: unknown): string[] | null => {
      if (v == null || v === '') return null;
      const items = String(v).split(';').map((s) => s.trim()).filter(Boolean);
      return items.length > 0 ? items : null;
    };

    const DAY_COLUMNS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

    const parseDayAvailability = (r: Record<string, unknown>): Record<string, { start: string; end: string }[]> | null => {
      const result: Record<string, { start: string; end: string }[]> = {};
      for (const day of DAY_COLUMNS) {
        const val = r[day];
        if (val == null || String(val).trim() === '') continue;
        const ranges = String(val).split(';').map((s) => s.trim()).filter(Boolean);
        const blocks: { start: string; end: string }[] = [];
        for (const range of ranges) {
          const [start, end] = range.split('-');
          if (start && end) blocks.push({ start, end });
        }
        if (blocks.length > 0) result[day] = blocks;
      }
      return Object.keys(result).length > 0 ? result : null;
    };

    const rows: VenueRow[] = rawRows.map((r) => {
      return {
        name: String(r.name ?? '').trim(),
        space_type: r.space_type || 'other',
        max_capacity: parseIntOrNull(r.max_capacity),
        address: r.address || null,
        is_virtual: parseBool(r.is_virtual),
        amenities: parseSemicolonList(r.amenities),
        description: r.description || null,
        availability_json: parseDayAvailability(r),
        notes: r.notes || null,
        min_booking_duration_minutes: parseIntOrNull(r.min_booking_duration_minutes),
        max_booking_duration_minutes: parseIntOrNull(r.max_booking_duration_minutes),
        buffer_minutes: parseIntOrNull(r.buffer_minutes),
        advance_booking_days: parseIntOrNull(r.advance_booking_days),
        cancellation_window_hours: parseIntOrNull(r.cancellation_window_hours),
        cost_per_hour: parseFloatOrNull(r.cost_per_hour),
        max_concurrent_bookings: parseIntOrNull(r.max_concurrent_bookings) ?? 1,
        blackout_dates: parseSemicolonList(r.blackout_dates),
        is_wheelchair_accessible: parseBool(r.is_wheelchair_accessible),
        subjects: parseSemicolonList(r.subjects),
        program_id,
      };
    });

    // Check for duplicate names against existing venues in this program
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('venues') as any)
      .select('name')
      .eq('program_id', program_id)
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
      toInsert.push(row);
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
