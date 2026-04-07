/**
 * Core duplication logic — copies resources from one program to another.
 * Extracted to be independently testable without Next.js runtime.
 */

export interface CopyOptions {
  copy_staff: boolean;
  copy_venues: boolean;
  copy_tags: boolean;
  copy_templates: boolean;
  tag_categories?: string[];
}

export interface CopyResult {
  counts: { staff: number; venues: number; tags: number; templates: number };
  staffIdMap: Map<string, string>;
  venueIdMap: Map<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export async function copyResources(
  supabase: Supabase,
  sourceProgramId: string,
  newProgramId: string,
  options: CopyOptions
): Promise<CopyResult> {
  const counts = { staff: 0, venues: 0, tags: 0, templates: 0 };
  const staffIdMap = new Map<string, string>();
  const venueIdMap = new Map<string, string>();

  // ── Copy staff ─────────────────────────────────────────────────
  if (options.copy_staff) {
    const { data: staff, error: fetchErr } = await supabase
      .from('staff')
      .select('id, first_name, last_name, email, phone, skills, availability_json, is_active, on_call, notes, bio, start_year')
      .eq('program_id', sourceProgramId);

    if (fetchErr) {
      throw new Error(`Failed to fetch staff: ${fetchErr.message}`);
    }

    if (staff && staff.length > 0) {
      const rows = staff.map((s: Record<string, unknown>) => {
        const { id: _oldId, ...rest } = s;
        return { ...rest, program_id: newProgramId };
      });

      const { data: inserted, error: insertErr } = await supabase
        .from('staff')
        .insert(rows)
        .select('id');

      if (insertErr) {
        throw new Error(`Failed to copy staff: ${insertErr.message}`);
      }

      if (inserted) {
        for (let i = 0; i < staff.length; i++) {
          staffIdMap.set(staff[i].id as string, inserted[i].id as string);
        }
        counts.staff = inserted.length;
      }
    }
  }

  // ── Copy venues ────────────────────────────────────────────────
  if (options.copy_venues) {
    const { data: venues, error: fetchErr } = await supabase
      .from('venues')
      .select('id, name, space_type, max_capacity, address, is_virtual, amenities, description, availability_json, notes, min_booking_duration_minutes, max_booking_duration_minutes, buffer_minutes, advance_booking_days, cancellation_window_hours, cost_per_hour, max_concurrent_bookings, blackout_dates, is_wheelchair_accessible, subjects')
      .eq('program_id', sourceProgramId);

    if (fetchErr) {
      throw new Error(`Failed to fetch venues: ${fetchErr.message}`);
    }

    if (venues && venues.length > 0) {
      const rows = venues.map((v: Record<string, unknown>) => {
        const { id: _oldId, ...rest } = v;
        return { ...rest, program_id: newProgramId };
      });

      const { data: inserted, error: insertErr } = await supabase
        .from('venues')
        .insert(rows)
        .select('id');

      if (insertErr) {
        throw new Error(`Failed to copy venues: ${insertErr.message}`);
      }

      if (inserted) {
        for (let i = 0; i < venues.length; i++) {
          venueIdMap.set(venues[i].id as string, inserted[i].id as string);
        }
        counts.venues = inserted.length;
      }
    }
  }

  // ── Copy tags ──────────────────────────────────────────────────
  const copiedTagNames = new Set<string>();

  if (options.copy_tags) {
    let query = supabase
      .from('tags')
      .select('name, color, description, category, emoji, is_default')
      .eq('program_id', sourceProgramId);

    if (options.tag_categories && options.tag_categories.length > 0) {
      query = query.in('category', options.tag_categories);
    }

    const { data: tags, error: fetchErr } = await query;

    if (fetchErr) {
      throw new Error(`Failed to fetch tags: ${fetchErr.message}`);
    }

    if (tags && tags.length > 0) {
      const rows = tags.map((t: Record<string, unknown>) => ({
        ...t,
        program_id: newProgramId,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('tags')
        .insert(rows)
        .select('id, name');

      if (insertErr) {
        throw new Error(`Failed to copy tags: ${insertErr.message}`);
      }

      if (inserted) {
        counts.tags = inserted.length;
        for (const t of inserted) {
          copiedTagNames.add(t.name as string);
        }
      }
    }
  }

  // ── Copy event templates ───────────────────────────────────────
  if (options.copy_templates) {
    const { data: templates, error: fetchErr } = await supabase
      .from('session_templates')
      .select('name, template_type, rotation_mode, instructor_id, day_of_week, grade_groups, start_time, end_time, duration_minutes, venue_id, required_skills, additional_tags, sort_order, is_active, week_cycle_length, week_in_cycle, scheduling_mode, starts_on, ends_on, duration_weeks, session_count, within_weeks, sessions_per_week')
      .eq('program_id', sourceProgramId);

    if (fetchErr) {
      throw new Error(`Failed to fetch templates: ${fetchErr.message}`);
    }

    if (templates && templates.length > 0) {
      const rows = templates.map((t: Record<string, unknown>) => {
        const row: Record<string, unknown> = {
          ...t,
          program_id: newProgramId,
        };

        // Clear venue_id if venues weren't copied, or remap to new ID
        if (t.venue_id) {
          if (!options.copy_venues) {
            row.venue_id = null;
          } else {
            row.venue_id = venueIdMap.get(t.venue_id as string) ?? null;
          }
        }

        // Clear instructor_id if staff weren't copied, or remap to new ID
        if (t.instructor_id) {
          if (!options.copy_staff) {
            row.instructor_id = null;
          } else {
            row.instructor_id = staffIdMap.get(t.instructor_id as string) ?? null;
          }
        }

        // Filter required_skills (tag names) to only those present in new program
        if (options.copy_tags && t.required_skills && Array.isArray(t.required_skills)) {
          row.required_skills = (t.required_skills as string[]).filter(
            (name) => copiedTagNames.has(name)
          );
          if ((row.required_skills as string[]).length === 0) {
            row.required_skills = null;
          }
        } else if (!options.copy_tags) {
          row.required_skills = null;
        }

        // Filter additional_tags to only those present in new program
        if (options.copy_tags && t.additional_tags && Array.isArray(t.additional_tags)) {
          row.additional_tags = (t.additional_tags as string[]).filter(
            (name) => copiedTagNames.has(name)
          );
          if ((row.additional_tags as string[]).length === 0) {
            row.additional_tags = null;
          }
        } else if (!options.copy_tags) {
          row.additional_tags = null;
        }

        return row;
      });

      const { data: inserted, error: insertErr } = await supabase
        .from('session_templates')
        .insert(rows)
        .select('id');

      if (insertErr) {
        throw new Error(`Failed to copy templates: ${insertErr.message}`);
      }

      counts.templates = inserted?.length ?? 0;
    }
  }

  return { counts, staffIdMap, venueIdMap };
}
