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

/** Authenticated org member — either an admin or an instructor (staff). */
export interface OrgUser {
  id: string;
  email: string;
  orgRole: 'admin' | 'instructor';
  /** Only set when orgRole === 'admin' */
  roleLevel: RoleLevel | null;
}

type AuthSuccess = { user: AuthUser; error: null };
type AuthFailure = { user: null; error: NextResponse };

type OrgAuthSuccess = { user: OrgUser; error: null };
type OrgAuthFailure = { user: null; error: NextResponse };

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

/** Role hierarchy: master > standard > editor. Higher number = more privilege. */
const ROLE_RANK: Record<RoleLevel, number> = {
  master: 3,
  standard: 2,
  editor: 1,
};

/**
 * Require the user's role_level to be at least `minRole`.
 * Returns a 403 NextResponse if insufficient, or null if authorized.
 */
export function requireMinRole(
  authUser: AuthUser,
  minRole: RoleLevel,
): NextResponse | null {
  const userRank = ROLE_RANK[authUser.roleLevel] ?? 0;
  const requiredRank = ROLE_RANK[minRole] ?? 0;

  if (userRank < requiredRank) {
    return NextResponse.json(
      { error: `Forbidden: requires ${minRole}-level access or higher` },
      { status: 403 },
    );
  }
  return null;
}

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

// ── Program-level authorization ─────────────────────────────────────────────

/**
 * Verify that the authenticated admin has access to a specific program.
 * Master admins can access all programs; standard/editor admins need an
 * explicit grant in the admin_programs junction table.
 *
 * Returns null if authorized, or a 403 NextResponse if not.
 */
export async function requireProgramAccess(
  authUser: AuthUser,
  programId: string,
): Promise<NextResponse | null> {
  // Master admins bypass program-level checks
  if (authUser.roleLevel === 'master') return null;

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (service.from('admin_programs') as any)
    .select('admin_id')
    .eq('admin_id', authUser.id)
    .eq('program_id', programId)
    .maybeSingle();

  if (!data) {
    const resp = NextResponse.json(
      { error: 'Forbidden: you do not have access to this program' },
      { status: 403 },
    );
    resp.headers.set('X-Program-Access-Scoped', 'denied');
    return resp;
  }

  return null;
}

/**
 * Create a NextResponse with the X-Program-Access-Scoped header set.
 * Use this instead of plain NextResponse.json() in routes that enforce
 * program-level access so the authorization is visible to the client.
 */
export function scopedJsonResponse(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  const resp = NextResponse.json(body, init);
  resp.headers.set('X-Program-Access-Scoped', 'true');
  return resp;
}

/**
 * Return the list of program IDs the admin is authorized to access.
 * Master admins get null (meaning "all programs").
 */
export async function getAccessibleProgramIds(
  authUser: AuthUser,
): Promise<string[] | null> {
  if (authUser.roleLevel === 'master') return null;

  const service = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (service.from('admin_programs') as any)
    .select('program_id')
    .eq('admin_id', authUser.id);

  return (data ?? []).map((row: { program_id: string }) => row.program_id);
}

// ── Org-level auth (admins + instructors) ───────────────────────────────────

/**
 * Authenticate any org member — admin or instructor.
 * Use this for routes that instructors (staff) need to access, like the
 * staff portal viewing their own schedule.
 */
export async function requireOrgMember(): Promise<OrgAuthSuccess | OrgAuthFailure> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const service = createServiceClient();

  // Check admins table first (higher privilege)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (service.from('admins') as any)
    .select('id, role_level')
    .eq('google_email', user.email)
    .maybeSingle();

  if (admin) {
    return {
      user: {
        id: admin.id,
        email: user.email,
        orgRole: 'admin',
        roleLevel: admin.role_level as RoleLevel,
      },
      error: null,
    };
  }

  // Check instructors table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: instructor } = await (service.from('staff') as any)
    .select('id')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle();

  if (instructor) {
    return {
      user: {
        id: instructor.id,
        email: user.email,
        orgRole: 'instructor',
        roleLevel: null,
      },
      error: null,
    };
  }

  return {
    user: null,
    error: NextResponse.json({ error: 'Forbidden: org membership required' }, { status: 403 }),
  };
}
