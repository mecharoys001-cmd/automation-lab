/**
 * POST /api/programs/:id/duplicate
 *
 * Duplicate a program's setup/config data into a brand-new program.
 * Copies selected resources (event templates, tags, staff, venues) from
 * the source program. Does NOT copy sessions, reports, admin bindings
 * (beyond the creator), version snapshots, or other operational history.
 *
 * Body: {
 *   name: string,
 *   start_date: string,
 *   end_date: string,
 *   copy_templates: boolean,
 *   copy_tags: boolean,
 *   copy_staff: boolean,
 *   copy_venues: boolean,
 *   tag_categories?: string[]   // if provided, only copy these categories
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const { id: sourceProgramId } = await params;
    const body = await request.json();

    const {
      name,
      start_date,
      end_date,
      copy_templates,
      copy_tags,
      copy_staff,
      copy_venues,
      tag_categories,
    } = body as {
      name: string;
      start_date: string;
      end_date: string;
      copy_templates: boolean;
      copy_tags: boolean;
      copy_staff: boolean;
      copy_venues: boolean;
      tag_categories?: string[];
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Program name is required' }, { status: 400 });
    }
    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    // Verify access to source program
    const sourceAccessErr = await requireProgramAccess(auth.user, sourceProgramId);
    if (sourceAccessErr) return sourceAccessErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    // ── Step 1: Create the new program ─────────────────────────
    const { data: newProgram, error: createError } = await supabase
      .from('programs')
      .insert({
        name: name.trim(),
        start_date,
        end_date,
        allows_mixing: true,
        wizard_completed: false,
        wizard_step: 0,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        { error: `Failed to create program: ${createError.message}` },
        { status: 500 }
      );
    }

    const newProgramId: string = newProgram.id;

    // Auto-grant the creating admin access to this program
    await supabase
      .from('admin_programs')
      .insert({ admin_id: auth.user.id, program_id: newProgramId });

    // Helper: clean up on failure
    async function rollback() {
      await supabase.from('programs').delete().eq('id', newProgramId);
    }

    try {
      const counts = { staff: 0, venues: 0, tags: 0, templates: 0 };

      // Maps from old IDs to new IDs (for template dependency handling)
      const staffIdMap = new Map<string, string>();
      const venueIdMap = new Map<string, string>();

      // ── Step 2: Copy staff ───────────────────────────────────
      if (copy_staff) {
        const { data: staff } = await supabase
          .from('staff')
          .select('id, first_name, last_name, email, phone, skills, availability_json, is_active, on_call, notes')
          .eq('program_id', sourceProgramId);

        if (staff && staff.length > 0) {
          const rows = staff.map((s: Record<string, unknown>) => {
            const { id: _oldId, ...rest } = s;
            return { ...rest, program_id: newProgramId };
          });

          const { data: inserted } = await supabase
            .from('staff')
            .insert(rows)
            .select('id');

          if (inserted) {
            for (let i = 0; i < staff.length; i++) {
              staffIdMap.set(staff[i].id as string, inserted[i].id as string);
            }
            counts.staff = inserted.length;
          }
        }
      }

      // ── Step 3: Copy venues ──────────────────────────────────
      if (copy_venues) {
        const { data: venues } = await supabase
          .from('venues')
          .select('id, name, space_type, max_capacity, address, is_virtual, amenities, description, availability_json, notes, min_booking_duration_minutes, max_booking_duration_minutes, buffer_minutes, advance_booking_days, cancellation_window_hours, cost_per_hour, max_concurrent_bookings, blackout_dates, is_wheelchair_accessible, subjects')
          .eq('program_id', sourceProgramId);

        if (venues && venues.length > 0) {
          const rows = venues.map((v: Record<string, unknown>) => {
            const { id: _oldId, ...rest } = v;
            return { ...rest, program_id: newProgramId };
          });

          const { data: inserted } = await supabase
            .from('venues')
            .insert(rows)
            .select('id');

          if (inserted) {
            for (let i = 0; i < venues.length; i++) {
              venueIdMap.set(venues[i].id as string, inserted[i].id as string);
            }
            counts.venues = inserted.length;
          }
        }
      }

      // ── Step 4: Copy tags ────────────────────────────────────
      // Collect the set of tag names copied (for filtering template tag arrays)
      const copiedTagNames = new Set<string>();

      if (copy_tags) {
        let query = supabase
          .from('tags')
          .select('name, color, description, category, emoji, is_default')
          .eq('program_id', sourceProgramId);

        if (tag_categories && tag_categories.length > 0) {
          query = query.in('category', tag_categories);
        }

        const { data: tags } = await query;

        if (tags && tags.length > 0) {
          const rows = tags.map((t: Record<string, unknown>) => ({
            ...t,
            program_id: newProgramId,
          }));

          const { data: inserted } = await supabase
            .from('tags')
            .insert(rows)
            .select('id, name');

          if (inserted) {
            counts.tags = inserted.length;
            for (const t of inserted) {
              copiedTagNames.add(t.name as string);
            }
          }
        }
      }

      // ── Step 5: Copy event templates ─────────────────────────
      if (copy_templates) {
        const { data: templates } = await supabase
          .from('session_templates')
          .select('name, template_type, rotation_mode, instructor_id, day_of_week, grade_groups, start_time, end_time, duration_minutes, venue_id, required_skills, additional_tags, sort_order, is_active, week_cycle_length, week_in_cycle, scheduling_mode, starts_on, ends_on, duration_weeks, session_count, within_weeks, sessions_per_week')
          .eq('program_id', sourceProgramId);

        if (templates && templates.length > 0) {
          const rows = templates.map((t: Record<string, unknown>) => {
            const row: Record<string, unknown> = {
              ...t,
              program_id: newProgramId,
            };

            // Clear venue_id if venues weren't copied, or remap to new ID
            if (t.venue_id) {
              if (!copy_venues) {
                row.venue_id = null;
              } else {
                row.venue_id = venueIdMap.get(t.venue_id as string) ?? null;
              }
            }

            // Clear instructor_id if staff weren't copied, or remap to new ID
            if (t.instructor_id) {
              if (!copy_staff) {
                row.instructor_id = null;
              } else {
                row.instructor_id = staffIdMap.get(t.instructor_id as string) ?? null;
              }
            }

            // Filter required_skills (tag names) to only those present in new program
            if (copy_tags && t.required_skills && Array.isArray(t.required_skills)) {
              row.required_skills = (t.required_skills as string[]).filter(
                (name) => copiedTagNames.has(name)
              );
              if ((row.required_skills as string[]).length === 0) {
                row.required_skills = null;
              }
            } else if (!copy_tags) {
              row.required_skills = null;
            }

            // Filter additional_tags to only those present in new program
            if (copy_tags && t.additional_tags && Array.isArray(t.additional_tags)) {
              row.additional_tags = (t.additional_tags as string[]).filter(
                (name) => copiedTagNames.has(name)
              );
              if ((row.additional_tags as string[]).length === 0) {
                row.additional_tags = null;
              }
            } else if (!copy_tags) {
              row.additional_tags = null;
            }

            return row;
          });

          const { data: inserted } = await supabase
            .from('session_templates')
            .insert(rows)
            .select('id');

          counts.templates = inserted?.length ?? 0;
        }
      }

      return NextResponse.json({
        success: true,
        program: newProgram,
        counts,
      });
    } catch (copyErr) {
      // Clean up the partially-created program on failure
      await rollback();
      throw copyErr;
    }
  } catch (err) {
    console.error('Program duplicate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
