// lib/tool-access.ts
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';

export type ToolVisibility = 'public' | 'restricted' | 'hidden';

export interface ToolAccessResult {
  hasAccess: boolean;
  visibility: ToolVisibility;
}

export interface ToolAccessRow {
  id: string;
  tool_id: string;
  user_email: string;
  granted_by: string | null;
  granted_at: string;
}

export interface UserSuite {
  suite_id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
}

/**
 * Check if a user has access to a specific tool.
 * Public tools: always accessible.
 * Restricted/hidden tools: site admins always have access, otherwise check tool_access table.
 */
export async function checkToolAccess(
  email: string | undefined,
  toolId: string,
): Promise<ToolAccessResult> {
  if (!email) return { hasAccess: false, visibility: 'hidden' };

  const svc = createServiceClient();

  // Get tool visibility from tool_config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (svc.from('tool_config') as any)
    .select('visibility')
    .eq('tool_id', toolId)
    .maybeSingle();

  // Tools without a config row are treated as restricted (not visible by default)
  // Only explicitly public tools are accessible without grants
  const visibility: ToolVisibility = config?.visibility ?? 'restricted';

  if (visibility === 'public') {
    return { hasAccess: true, visibility };
  }

  // Restricted or hidden — check site_admins first
  const adminInfo = await getSiteAdmin(email);
  if (isSiteAdmin(adminInfo)) {
    return { hasAccess: true, visibility };
  }

  // Check tool_access table (case-insensitive)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: access } = await (svc.from('tool_access') as any)
    .select('id')
    .eq('tool_id', toolId)
    .ilike('user_email', email)
    .maybeSingle();

  if (access) {
    return { hasAccess: true, visibility };
  }

  // Check suite membership
  const suiteAccess = await checkSuiteAccess(email, toolId);
  if (suiteAccess) {
    return { hasAccess: true, visibility };
  }

  // Check tool-specific internal roles (e.g. scheduler admins/staff)
  const internalAccess = await checkToolInternalRoles(email, toolId);
  if (internalAccess) {
    return { hasAccess: true, visibility };
  }

  return { hasAccess: false, visibility };
}

/**
 * Get all tool IDs a user can access.
 * All public tools + any restricted/hidden tools they're granted access to.
 * Site admins get access to all tools.
 */
export async function getUserAccessibleToolIds(
  email: string | undefined,
): Promise<string[]> {
  if (!email) return [];

  const svc = createServiceClient();

  // Check if site admin — gets all tools
  const adminInfo = await getSiteAdmin(email);
  if (isSiteAdmin(adminInfo)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allTools } = await (svc.from('tool_config') as any)
      .select('tool_id');
    return (allTools ?? []).map((t: { tool_id: string }) => t.tool_id);
  }

  // Get all public tools (only explicitly public — null visibility is NOT public)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: publicTools } = await (svc.from('tool_config') as any)
    .select('tool_id')
    .eq('visibility', 'public');

  const toolIds = new Set(
    (publicTools ?? []).map((t: { tool_id: string }) => t.tool_id),
  );

  // Get granted restricted/hidden tools (direct grants)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: grantedAccess } = await (svc.from('tool_access') as any)
    .select('tool_id')
    .ilike('user_email', email);

  for (const row of grantedAccess ?? []) {
    toolIds.add(row.tool_id);
  }

  // Get tools from suites the user belongs to
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (svc.from('tool_suite_members') as any)
    .select('suite_id')
    .ilike('user_email', email);

  if (memberships && memberships.length > 0) {
    const suiteIds = memberships.map((m: { suite_id: string }) => m.suite_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stRows } = await (svc.from('tool_suite_tools') as any)
      .select('tool_id')
      .in('suite_id', suiteIds);
    for (const row of stRows ?? []) {
      toolIds.add(row.tool_id);
    }
  }

  // Check tool-specific internal roles (e.g. scheduler admins/staff)
  const internalToolIds = await getToolIdsFromInternalRoles(email);
  for (const id of internalToolIds) {
    toolIds.add(id);
  }

  return Array.from(toolIds) as string[];
}

/**
 * Get the access list for a specific tool.
 */
export async function getToolAccessList(
  toolId: string,
): Promise<ToolAccessRow[]> {
  const svc = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('tool_access') as any)
    .select('*')
    .eq('tool_id', toolId)
    .order('granted_at', { ascending: false });

  if (error) {
    console.error('[tool-access] getToolAccessList error:', error);
    return [];
  }

  return data ?? [];
}

/**
 * Check if a user has access to a tool via suite membership.
 * Joins tool_suite_members with tool_suite_tools to find a match.
 */
export async function checkSuiteAccess(
  email: string,
  toolId: string,
): Promise<boolean> {
  const svc = createServiceClient();

  // Get suites the user belongs to
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (svc.from('tool_suite_members') as any)
    .select('suite_id')
    .ilike('user_email', email);

  if (!memberships || memberships.length === 0) return false;

  const suiteIds = memberships.map((m: { suite_id: string }) => m.suite_id);

  // Check if any of those suites contain this tool
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: match } = await (svc.from('tool_suite_tools') as any)
    .select('id')
    .in('suite_id', suiteIds)
    .eq('tool_id', toolId)
    .limit(1)
    .maybeSingle();

  return !!match;
}

/**
 * Get all suites a user belongs to, with their role in each.
 */
export async function getUserSuites(
  email: string,
): Promise<UserSuite[]> {
  const svc = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('tool_suite_members') as any)
    .select('suite_id, role, tool_suites(name, slug, description)')
    .ilike('user_email', email);

  if (error) {
    console.error('[tool-access] getUserSuites error:', error);
    return [];
  }

  return (data ?? []).map(
    (row: { suite_id: string; role: string; tool_suites: { name: string; slug: string; description: string | null } }) => ({
      suite_id: row.suite_id,
      name: row.tool_suites.name,
      slug: row.tool_suites.slug,
      description: row.tool_suites.description,
      role: row.role,
    }),
  );
}

/**
 * Check if a user has access to a tool via tool-specific internal roles.
 * This bridges tool-internal permission systems (e.g. scheduler admins/staff)
 * with the central tool_access model, so visibility on /tools stays consistent
 * even if trigger-based sync is delayed or missing.
 *
 * Currently supports: scheduler (admins table + active staff table).
 */
export async function checkToolInternalRoles(
  email: string,
  toolId: string,
): Promise<boolean> {
  if (toolId !== 'scheduler') return false;

  const svc = createServiceClient();

  // Check scheduler admins table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (svc.from('admins') as any)
    .select('id')
    .ilike('google_email', email)
    .maybeSingle();

  if (admin) return true;

  // Check active staff
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staff } = await (svc.from('staff') as any)
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .maybeSingle();

  return !!staff;
}

/**
 * Get tool IDs the user can access via tool-specific internal roles.
 * Returns tool IDs where the user holds an internal role (e.g. scheduler admin/staff).
 */
export async function getToolIdsFromInternalRoles(
  email: string,
): Promise<string[]> {
  const toolIds: string[] = [];

  const svc = createServiceClient();

  // Scheduler: check admins table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (svc.from('admins') as any)
    .select('id')
    .ilike('google_email', email)
    .maybeSingle();

  if (admin) {
    toolIds.push('scheduler');
    return toolIds;
  }

  // Scheduler: check active staff
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staff } = await (svc.from('staff') as any)
    .select('id')
    .ilike('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (staff) {
    toolIds.push('scheduler');
  }

  return toolIds;
}

/**
 * Get all tool_ids that belong to a suite.
 */
export async function getSuiteToolIds(
  suiteId: string,
): Promise<string[]> {
  const svc = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('tool_suite_tools') as any)
    .select('tool_id')
    .eq('suite_id', suiteId);

  if (error) {
    console.error('[tool-access] getSuiteToolIds error:', error);
    return [];
  }

  return (data ?? []).map((row: { tool_id: string }) => row.tool_id);
}
