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
import { copyResources } from './copy-resources';

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
      const { counts } = await copyResources(supabase, sourceProgramId, newProgramId, {
        copy_staff,
        copy_venues,
        copy_tags,
        copy_templates,
        tag_categories,
      });

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
