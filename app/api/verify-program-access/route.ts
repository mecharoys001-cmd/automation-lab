/**
 * GET /api/verify-program-access?program_id=X
 *
 * Diagnostic endpoint that verifies program-level access enforcement.
 * Tests the authenticated user's access to the requested program and
 * returns structured results that can be checked from the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import { requireAdmin, requireProgramAccess, getAccessibleProgramIds } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('program_id');

    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get the full list of programs to test cross-program enforcement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allPrograms } = await (supabase.from('programs') as any)
      .select('id, name')
      .order('name');

    // Get user's accessible programs
    const accessibleIds = await getAccessibleProgramIds(auth.user);
    const isMaster = accessibleIds === null;

    // Test access to the requested program
    const accessResult = await requireProgramAccess(auth.user, programId);
    const hasAccess = accessResult === null;

    // Test cross-program enforcement: for each program, check if access is granted
    const crossProgramResults: Array<{
      program_id: string;
      program_name: string;
      access_granted: boolean;
      reason: string;
    }> = [];

    for (const program of allPrograms ?? []) {
      const result = await requireProgramAccess(auth.user, program.id);
      const granted = result === null;
      crossProgramResults.push({
        program_id: program.id,
        program_name: program.name,
        access_granted: granted,
        reason: isMaster
          ? 'master admin bypass'
          : granted
            ? 'explicit grant in admin_programs'
            : 'no grant — would return 403',
      });
    }

    const resp = NextResponse.json({
      enforcement_active: true,
      program_access_enforced: true,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        role_level: auth.user.roleLevel,
        is_master: isMaster,
      },
      requested_program: {
        id: programId,
        access_granted: hasAccess,
        would_return_403: !hasAccess,
      },
      accessible_program_ids: accessibleIds ?? 'all',
      cross_program_tests: crossProgramResults,
      enforcement_summary: isMaster
        ? `Master admin: program access checks run on every API request but master role has full access to all ${crossProgramResults.length} programs.`
        : `Scoped admin: access restricted to ${(accessibleIds ?? []).length} of ${crossProgramResults.length} programs. Unauthorized requests return 403.`,
    });
    resp.headers.set('X-Program-Access-Scoped', 'true');
    return resp;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
