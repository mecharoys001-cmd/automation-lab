import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 * Checks admins table first, then instructors table.
 * Returns org_role ('admin' | 'instructor') alongside role_level.
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

    // Check admins table first (higher privilege)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin } = await (serviceClient.from('admins') as any)
      .select('id, google_email, display_name, role_level')
      .eq('google_email', user.email)
      .maybeSingle();

    if (admin) {
      return NextResponse.json({
        id: admin.id,
        email: admin.google_email,
        google_email: admin.google_email,
        display_name: admin.display_name,
        role_level: admin.role_level,
        org_role: 'admin',
      });
    }

    // Check instructors table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: instructor } = await (serviceClient.from('instructors') as any)
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
        org_role: 'instructor',
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
