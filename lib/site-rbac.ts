// lib/site-rbac.ts
import { createServiceClient } from '@/lib/supabase-service';

export type SiteRoleLevel = 'master' | 'standard';

export interface SiteAdminInfo {
  isSiteAdmin: boolean;
  roleLevel: SiteRoleLevel | null;
}

const NOT_ADMIN: SiteAdminInfo = { isSiteAdmin: false, roleLevel: null };

/**
 * Check if a user is a site admin by looking up their email
 * in the site_admins table. This is SEPARATE from the scheduler
 * admins table used by lib/rbac.ts.
 */
export async function getSiteAdmin(userEmail: string | undefined): Promise<SiteAdminInfo> {
  if (!userEmail) return NOT_ADMIN;

  const svc = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('site_admins') as any)
    .select('role_level')
    .eq('google_email', userEmail)
    .maybeSingle();

  if (!data) return NOT_ADMIN;

  return {
    isSiteAdmin: true,
    roleLevel: data.role_level as SiteRoleLevel,
  };
}

export function isSiteAdmin(info: SiteAdminInfo): boolean {
  return info.isSiteAdmin;
}

export function isSiteMasterAdmin(info: SiteAdminInfo): boolean {
  return info.isSiteAdmin && info.roleLevel === 'master';
}
