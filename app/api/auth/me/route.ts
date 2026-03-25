import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's admin profile including role_level
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

    // Look up the admin record by google_email
    const serviceClient = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin, error: adminError } = await (serviceClient.from('admins') as any)
      .select('*')
      .eq('google_email', user.email)
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'Admin profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: admin.id,
      google_email: admin.google_email,
      display_name: admin.display_name,
      role_level: admin.role_level,
    });
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
