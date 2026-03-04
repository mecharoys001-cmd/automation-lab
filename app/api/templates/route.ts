import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('session_templates') as any)
      .select('*, venue:venues(*)')
      .order('day_of_week')
      .order('sort_order');

    if (programId) {
      query = query.eq('program_id', programId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json(
        { error: 'program_id query parameter is required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .delete()
      .eq('program_id', programId)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete templates: ${error.message}` },
        { status: 500 },
      );
    }

    const deleted = data?.length ?? 0;
    if (deleted > 0) {
      trackScheduleChange();
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    // Default template_type and rotation_mode for backward compatibility
    if (!body.template_type) body.template_type = 'fully_defined';
    if (!body.rotation_mode) body.rotation_mode = 'consistent';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('session_templates') as any)
      .insert(body)
      .select('*, venue:venues(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
