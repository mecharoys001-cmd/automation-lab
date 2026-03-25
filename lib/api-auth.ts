import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import type { RoleLevel } from '@/types/database';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin';
  roleLevel: RoleLevel;
}

type AuthSuccess = { user: AuthUser; error: null };
type AuthFailure = { user: null; error: NextResponse };

// ── Core auth check ─────────────────────────────────────────────────────────

/**
 * Extract session from cookies, verify the user is an admin, and return
 * their role_level. Returns a 401/403 NextResponse on failure.
 */
export async function requireAdmin(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (service.from('admins') as any)
    .select('id, role_level')
    .eq('google_email', user.email)
    .maybeSingle();

  if (!admin) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }),
    };
  }

  return {
    user: {
      id: admin.id,
      email: user.email,
      role: 'admin',
      roleLevel: admin.role_level as RoleLevel,
    },
    error: null,
  };
}

// ── Permission helpers ──────────────────────────────────────────────────────

/**
 * Only master admins can modify the admins table (create, update, delete admins).
 */
export function requireMasterAdmin(
  authUser: AuthUser,
): NextResponse | null {
  if (authUser.roleLevel !== 'master') {
    return NextResponse.json(
      { error: 'Forbidden: only master admins can manage admin accounts' },
      { status: 403 },
    );
  }
  return null;
}
