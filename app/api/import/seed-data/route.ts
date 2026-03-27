import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const supabase = createServiceClient();
    const body = await request.json();
    const programId = body.program_id;

    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const accessErr = await requireProgramAccess(auth.user, programId);
    if (accessErr) return accessErr;

    const results: {
      venues?: { created: number; skipped: number };
      tags?: { created: number; skipped: number };
      event_templates?: { created: number; skipped: number };
    } = {};

    // Import Venues
    if (body.venues && Array.isArray(body.venues)) {
      let venuesCreated = 0;
      let venuesSkipped = 0;

      for (const venue of body.venues) {
        // Check if venue already exists in this program
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('venues') as any)
          .select('id')
          .eq('name', venue.name)
          .eq('program_id', programId)
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
            program_id: programId,
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
        // Check if tag already exists in this program
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('tags') as any)
          .select('id')
          .eq('name', tag.name)
          .eq('program_id', programId)
          .single();

        if (existing) {
          // Update category if tag exists but has different/missing category
          if (tag.category) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('tags') as any)
              .update({ category: tag.category })
              .eq('id', existing.id);
          }
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
            category: tag.category,
            program_id: programId,
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

    // Import Event Templates
    if (body.event_templates && Array.isArray(body.event_templates)) {
      let templatesCreated = 0;
      let templatesSkipped = 0;

      for (const cls of body.event_templates) {
        // Check if event template already exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('classes') as any)
          .select('id')
          .eq('name', cls.name)
          .single();

        if (existing) {
          templatesSkipped++;
          continue;
        }

        // Create event template
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('classes') as any)
          .insert({
            name: cls.name,
            description: cls.description,
            duration_minutes: cls.duration_minutes,
            color: cls.color,
          });

        if (error) {
          console.error(`Failed to create event template ${cls.name}:`, error);
          templatesSkipped++;
        } else {
          templatesCreated++;
        }
      }

      results.event_templates = { created: templatesCreated, skipped: templatesSkipped };
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
