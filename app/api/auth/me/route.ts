import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getAccessibleProgramIds } from '@/lib/api-auth';
import type { RoleLevel } from '@/types/database';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 * Checks admins table first, then instructors table.
 * Returns org_role ('admin' | 'staff') alongside role_level.
 */
export async function GET() {
  try {
    // Get the current user's session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const serviceClient = createServiceClient();

    // Check site_admins first (highest privilege — overrides everything)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: siteAdmin } = await (serviceClient.from('site_admins') as any)
      .select('id, google_email, display_name, role_level')
      .ilike('google_email', user.email!)
      .maybeSingle();

    if (siteAdmin) {
      return NextResponse.json({
        id: siteAdmin.id,
        email: siteAdmin.google_email,
        google_email: siteAdmin.google_email,
        display_name: siteAdmin.display_name,
        role_level: siteAdmin.role_level ?? 'master',
        org_role: 'admin',
        is_site_admin: true,
        authorized_programs: 'all',
        program_access_enforced: true,
      });
    }

    // Check admins table (tool-level admin)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin } = await (serviceClient.from('admins') as any)
      .select('id, google_email, display_name, role_level')
      .eq('google_email', user.email)
      .maybeSingle();

    if (admin) {
      const authorizedPrograms = await getAccessibleProgramIds({
        id: admin.id,
        email: admin.google_email,
        role: 'admin',
        roleLevel: admin.role_level as RoleLevel,
      });

      return NextResponse.json({
        id: admin.id,
        email: admin.google_email,
        google_email: admin.google_email,
        display_name: admin.display_name,
        role_level: admin.role_level,
        org_role: 'admin',
        authorized_programs: authorizedPrograms ?? 'all',
        program_access_enforced: true,
      });
    }

    // Check instructors table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: instructor } = await (serviceClient.from('staff') as any)
      .select('id, first_name, last_name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (instructor) {
      return NextResponse.json({
        id: instructor.id,
        email: instructor.email,
        google_email: instructor.email,
        display_name: [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') || null,
        role_level: null,
        org_role: 'staff',
      });
    }

    return NextResponse.json(
      { error: 'No admin or staff profile found for this account' },
      { status: 404 }
    );
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
