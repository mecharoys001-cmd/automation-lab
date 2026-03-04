import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { trackScheduleChange } from '@/lib/track-change';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('settings') as any)
      .select('*')
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { buffer_time_enabled, buffer_time_minutes } = body;

    if (typeof buffer_time_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'buffer_time_enabled must be a boolean' },
        { status: 400 }
      );
    }

    const validMinutes = [15, 30, 45, 60];
    if (!validMinutes.includes(buffer_time_minutes)) {
      return NextResponse.json(
        { error: `buffer_time_minutes must be one of: ${validMinutes.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the single settings row (grab the first one)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('settings') as any)
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Settings row not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('settings') as any)
      .update({ buffer_time_enabled, buffer_time_minutes })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    trackScheduleChange();
    return NextResponse.json({ settings: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
