import { createServiceClient } from '@/lib/supabase-service';
import type { RoleLevel } from '@/types/database';

// ── Role types ─────────────────────────────────────────────────────────────

export type OrgRole = 'admin' | 'staff' | null;

export interface OrgMembership {
  role: OrgRole;
  /** Admin role_level when role === 'admin' */
  adminLevel: RoleLevel | null;
  /** Instructor id when role === 'staff' */
  instructorId: string | null;
}

const NO_MEMBERSHIP: OrgMembership = { role: null, adminLevel: null, instructorId: null };

// ── Core lookup ────────────────────────────────────────────────────────────

/**
 * Resolve a user's org membership by checking the admins and instructors
 * tables against the user's email. Admins take precedence over instructors.
 */
export async function getOrgMembership(userEmail: string | undefined): Promise<OrgMembership> {
  if (!userEmail) return NO_MEMBERSHIP;

  const supabase = createServiceClient();

  // Check admins table first (higher privilege)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (supabase.from('admins') as any)
    .select('role_level')
    .ilike('google_email', userEmail)
    .maybeSingle();

  if (admin) {
    return { role: 'admin', adminLevel: admin.role_level, instructorId: null };
  }

  // Check site_admins table — site admins get full scheduler admin access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siteAdmin } = await (supabase.from('site_admins') as any)
    .select('role_level')
    .ilike('google_email', userEmail)
    .maybeSingle();

  if (siteAdmin) {
    return { role: 'admin', adminLevel: 'master', instructorId: null };
  }

  // Check instructors table (use .limit(1) instead of .maybeSingle() to handle
  // staff with the same email in multiple programs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: instructors } = await (supabase.from('staff') as any)
    .select('id')
    .ilike('email', userEmail)
    .eq('is_active', true)
    .limit(1);

  if (instructors && instructors.length > 0) {
    return { role: 'staff', adminLevel: null, instructorId: instructors[0].id };
  }

  return NO_MEMBERSHIP;
}

// ── Guard helpers (for API routes) ─────────────────────────────────────────

export function isOrgMember(m: OrgMembership): boolean {
  return m.role !== null;
}

export function isAdmin(m: OrgMembership): boolean {
  return m.role === 'admin';
}

export function isMasterAdmin(m: OrgMembership): boolean {
  return m.role === 'admin' && m.adminLevel === 'master';
}
