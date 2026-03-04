import { createServiceClient } from '@/lib/supabase-service';
import type { RoleLevel } from '@/types/database';

// ── Role types ─────────────────────────────────────────────────────────────

export type OrgRole = 'admin' | 'instructor' | null;

export interface OrgMembership {
  role: OrgRole;
  /** Admin role_level when role === 'admin' */
  adminLevel: RoleLevel | null;
  /** Instructor id when role === 'instructor' */
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
    .eq('google_email', userEmail)
    .maybeSingle();

  if (admin) {
    return { role: 'admin', adminLevel: admin.role_level, instructorId: null };
  }

  // Check instructors table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: instructor } = await (supabase.from('instructors') as any)
    .select('id')
    .eq('email', userEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (instructor) {
    return { role: 'instructor', adminLevel: null, instructorId: instructor.id };
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
