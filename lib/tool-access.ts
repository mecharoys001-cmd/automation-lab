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

  const visibility: ToolVisibility = config?.visibility ?? 'public';

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

  return { hasAccess: !!access, visibility };
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

  // Get all public tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: publicTools } = await (svc.from('tool_config') as any)
    .select('tool_id')
    .or('visibility.eq.public,visibility.is.null');

  const toolIds = new Set(
    (publicTools ?? []).map((t: { tool_id: string }) => t.tool_id),
  );

  // Get granted restricted/hidden tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: grantedAccess } = await (svc.from('tool_access') as any)
    .select('tool_id')
    .ilike('user_email', email);

  for (const row of grantedAccess ?? []) {
    toolIds.add(row.tool_id);
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
