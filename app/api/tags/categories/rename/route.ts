import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireMinRole, requireProgramAccess } from '@/lib/api-auth';
import { isLockedTagCategory, getLockedCategoryReason } from '@/lib/tag-locking';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const roleCheck = requireMinRole(auth.user, 'standard');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { oldName, newName, program_id } = body as {
      oldName?: string;
      newName?: string;
      program_id?: string;
    };

    if (!oldName?.trim() || !newName?.trim()) {
      return NextResponse.json(
        { error: 'Both oldName and newName are required' },
        { status: 400 }
      );
    }

    if (!program_id) {
      return NextResponse.json(
        { error: 'program_id is required' },
        { status: 400 }
      );
    }

    const accessErr = await requireProgramAccess(auth.user, program_id);
    if (accessErr) return accessErr;

    // Protect core category names from being renamed
    if (isLockedTagCategory(oldName)) {
      return NextResponse.json(
        { error: getLockedCategoryReason(oldName) },
        { status: 403 }
      );
    }

    const trimmedNew = newName.trim();
    const trimmedOld = oldName.trim();

    if (isLockedTagCategory(trimmedNew)) {
      return NextResponse.json(
        { error: `${getLockedCategoryReason(trimmedNew)} Choose a different category name.` },
        { status: 403 }
      );
    }

    if (trimmedNew === trimmedOld) {
      return NextResponse.json({ updated: 0 });
    }

    const supabase = createServiceClient();

    // Update all tags in the program with the old category name to the new one
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('tags') as any)
      .update({ category: trimmedNew })
      .eq('category', trimmedOld)
      .eq('program_id', program_id)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
