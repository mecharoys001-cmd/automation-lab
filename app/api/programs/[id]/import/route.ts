/**
 * POST /api/programs/:id/import
 *
 * Import staff, venues, and/or tags from a source program into the target program.
 * Creates new copies with new IDs scoped to the target program.
 *
 * Body: {
 *   source_program_id: string,
 *   import_staff: boolean,
 *   import_venues: boolean,
 *   import_tags: boolean,
 *   tag_categories?: string[]  // if provided, only import these categories
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetProgramId } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    const {
      source_program_id,
      import_staff,
      import_venues,
      import_tags,
      tag_categories,
    } = body as {
      source_program_id: string;
      import_staff: boolean;
      import_venues: boolean;
      import_tags: boolean;
      tag_categories?: string[];
    };

    if (!source_program_id) {
      return NextResponse.json({ error: 'source_program_id is required' }, { status: 400 });
    }

    if (source_program_id === targetProgramId) {
      return NextResponse.json({ error: 'Cannot import from the same program' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const counts = { instructors: 0, venues: 0, tags: 0 };

    // Import staff
    if (import_staff) {
      const { data: instructors } = await sb
        .from('instructors')
        .select('first_name, last_name, email, phone, skills, availability_json, is_active, on_call, notes')
        .eq('program_id', source_program_id);

      if (instructors && instructors.length > 0) {
        const rows = instructors.map((i: Record<string, unknown>) => ({
          ...i,
          program_id: targetProgramId,
        }));

        const { data } = await sb.from('instructors').insert(rows).select('id');
        counts.instructors = data?.length ?? 0;
      }
    }

    // Import venues
    if (import_venues) {
      const { data: venues } = await sb
        .from('venues')
        .select('name, space_type, max_capacity, address, is_virtual, amenities, description, availability_json, notes, min_booking_duration_minutes, max_booking_duration_minutes, buffer_minutes, advance_booking_days, cancellation_window_hours, cost_per_hour, max_concurrent_bookings, blackout_dates, is_wheelchair_accessible, subjects')
        .eq('program_id', source_program_id);

      if (venues && venues.length > 0) {
        const rows = venues.map((v: Record<string, unknown>) => ({
          ...v,
          program_id: targetProgramId,
        }));

        const { data } = await sb.from('venues').insert(rows).select('id');
        counts.venues = data?.length ?? 0;
      }
    }

    // Import tags
    if (import_tags) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = sb
        .from('tags')
        .select('name, color, description, category, emoji, is_default')
        .eq('program_id', source_program_id);

      if (tag_categories && tag_categories.length > 0) {
        query = query.in('category', tag_categories);
      }

      const { data: tags } = await query;

      if (tags && tags.length > 0) {
        const rows = tags.map((t: Record<string, unknown>) => ({
          ...t,
          program_id: targetProgramId,
        }));

        const { data } = await sb.from('tags').insert(rows).select('id');
        counts.tags = data?.length ?? 0;
      }
    }

    return NextResponse.json({ success: true, counts });
  } catch (err) {
    console.error('Program import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
