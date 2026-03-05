import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const results: {
      venues?: { created: number; skipped: number };
      tags?: { created: number; skipped: number };
      classes?: { created: number; skipped: number };
    } = {};

    // Import Venues
    if (body.venues && Array.isArray(body.venues)) {
      let venuesCreated = 0;
      let venuesSkipped = 0;

      for (const venue of body.venues) {
        // Check if venue already exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('venues') as any)
          .select('id')
          .eq('name', venue.name)
          .single();

        if (existing) {
          venuesSkipped++;
          continue;
        }

        // Create venue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('venues') as any)
          .insert({
            name: venue.name,
            space_type: venue.space_type,
            max_capacity: venue.max_capacity,
            is_virtual: venue.is_virtual ?? false,
          });

        if (error) {
          console.error(`Failed to create venue ${venue.name}:`, error);
          venuesSkipped++;
        } else {
          venuesCreated++;
        }
      }

      results.venues = { created: venuesCreated, skipped: venuesSkipped };
    }

    // Import Tags
    if (body.tags && Array.isArray(body.tags)) {
      let tagsCreated = 0;
      let tagsSkipped = 0;

      for (const tag of body.tags) {
        // Check if tag already exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('tags') as any)
          .select('id')
          .eq('name', tag.name)
          .single();

        if (existing) {
          tagsSkipped++;
          continue;
        }

        // Create tag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('tags') as any)
          .insert({
            name: tag.name,
            emoji: tag.emoji,
            description: tag.description,
          });

        if (error) {
          console.error(`Failed to create tag ${tag.name}:`, error);
          tagsSkipped++;
        } else {
          tagsCreated++;
        }
      }

      results.tags = { created: tagsCreated, skipped: tagsSkipped };
    }

    // Import Classes
    if (body.classes && Array.isArray(body.classes)) {
      let classesCreated = 0;
      let classesSkipped = 0;

      for (const cls of body.classes) {
        // Check if class already exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('classes') as any)
          .select('id')
          .eq('name', cls.name)
          .single();

        if (existing) {
          classesSkipped++;
          continue;
        }

        // Create class
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('classes') as any)
          .insert({
            name: cls.name,
            description: cls.description,
            duration_minutes: cls.duration_minutes,
            color: cls.color,
          });

        if (error) {
          console.error(`Failed to create class ${cls.name}:`, error);
          classesSkipped++;
        } else {
          classesCreated++;
        }
      }

      results.classes = { created: classesCreated, skipped: classesSkipped };
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('[POST /api/import/seed-data] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
