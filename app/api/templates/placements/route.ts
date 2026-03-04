/**
 * GET /api/templates/placements?program_id=<uuid>
 * PUT /api/templates/placements
 *
 * Persists the weekly grid placement state for a program.
 * Each placement maps a session_template to a specific day/time on the grid.
 *
 * Uses the `template_placements` table:
 *   id            uuid PK
 *   program_id    uuid FK → programs
 *   template_id   uuid FK → session_templates
 *   day_index     int  (0=Mon … 4=Fri)
 *   start_hour    numeric  (e.g. 9.25 = 9:15 AM)
 *   duration_hours numeric  (e.g. 1.5 = 1h 30m)
 *   created_at    timestamptz
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('template_placements') as any)
      .select('*')
      .eq('program_id', programId)
      .order('day_index')
      .order('start_hour');

    if (error) {
      // Table may not exist yet — return empty array so the UI still works
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ placements: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ placements: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('template_placements') as any)
      .delete()
      .eq('program_id', programId);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ placements: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ placements: [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { program_id, placements } = await request.json();

    if (!program_id || !Array.isArray(placements)) {
      return NextResponse.json(
        { error: 'program_id (string) and placements (array) are required' },
        { status: 400 },
      );
    }

    // Delete existing placements for this program, then insert new ones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from('template_placements') as any)
      .delete()
      .eq('program_id', program_id);

    if (deleteError) {
      if (deleteError.code === '42P01' || deleteError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'template_placements table does not exist yet. Please run the migration.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (placements.length === 0) {
      return NextResponse.json({ placements: [] });
    }

    const rows = placements.map((p: { templateId: string; dayIndex: number; startHour: number; durationHours: number }) => ({
      program_id,
      template_id: p.templateId,
      day_index: p.dayIndex,
      start_hour: p.startHour,
      duration_hours: p.durationHours,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: insertError } = await (supabase.from('template_placements') as any)
      .insert(rows)
      .select('*');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ placements: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
