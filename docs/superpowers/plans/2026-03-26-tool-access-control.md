# Tool Access Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow site admins to control which users can access which tools. Each tool can be set to "public" (any logged-in user), "restricted" (specific users/emails only), or "hidden" (not visible on the tools page). Admins manage access from the Impact Dashboard.

**Architecture:** New `tool_access` Supabase table maps tool_ids to allowed user emails. A `visibility` column on `tool_config` controls whether a tool is public, restricted, or hidden. Middleware checks `tool_access` for restricted tools. The tools listing page filters based on the user's access. A new "Tool Access" tab on the Impact Dashboard lets admins manage permissions per tool.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + service client), existing middleware, TypeScript.

---

## Current State

- All tools require login (middleware redirects unauthenticated users to `/login`)
- Exceptions: `/tools/reports` and `/tools/scheduler/intake` are public
- Once logged in, ANY user can access ANY tool — no per-tool access control
- The tools listing page (`app/tools/page.tsx`) shows all tools to everyone
- Tool routes: csv-dedup, reports, scheduler, mailing-list-builder (and several placeholder routes)

## Target State

| Visibility | Behavior |
|---|---|
| `public` | Any logged-in user can see and use it. Shown on tools page to everyone. |
| `restricted` | Only users in `tool_access` table can see/use it. Hidden from tools page for others. |
| `hidden` | Not shown on tools page. Only accessible via direct URL by users in `tool_access` (or admins). |

Site admins always have access to all tools regardless of visibility settings.

---

## File Structure

```
# New files
supabase/migrations/20260326_tool_access.sql          — Create tool_access table + add visibility to tool_config
lib/tool-access.ts                                      — Helper: checkToolAccess(email, toolId), getUserTools(email)
app/api/tool-access/route.ts                            — CRUD for tool_access (admin-only)
app/tools/admin/impact/ToolAccess.tsx                    — Admin UI: manage per-tool access lists

# Modified files
middleware.ts                                           — Check tool_access for restricted/hidden tools
app/tools/page.tsx                                      — Filter tools based on user's access permissions
app/tools/admin/impact/page.tsx                         — Add "Tool Access" tab
app/api/usage/config/route.ts                           — Accept visibility field in POST/PUT
app/tools/admin/impact/ImpactDashboard.tsx              — Show visibility badge on tool cards
```

---

### Task 1: Database — tool_access Table + visibility Column

**Files:**
- Create: `supabase/migrations/20260326_tool_access.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Per-tool access control
CREATE TABLE IF NOT EXISTS tool_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id TEXT NOT NULL,                     -- References tool slug (e.g., 'csv-dedup', 'scheduler')
  user_email TEXT NOT NULL,                  -- Email of allowed user
  granted_by TEXT,                           -- Email of admin who granted access
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tool_id, user_email)               -- One entry per user per tool
);

CREATE INDEX idx_tool_access_tool_id ON tool_access(tool_id);
CREATE INDEX idx_tool_access_user_email ON tool_access(user_email);
ALTER TABLE tool_access ENABLE ROW LEVEL SECURITY;

-- Add visibility column to tool_config
-- 'public' = any logged-in user, 'restricted' = only tool_access users, 'hidden' = restricted + not on tools page
ALTER TABLE tool_config ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'restricted', 'hidden'));
```

- [ ] **Step 2: User runs migration in Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260326_tool_access.sql
git commit -m "feat: create tool_access table and visibility column"
```

---

### Task 2: Tool Access Helper Library

**Files:**
- Create: `lib/tool-access.ts`

- [ ] **Step 1: Create the helper module**

```typescript
// lib/tool-access.ts
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin } from '@/lib/site-rbac';

export type ToolVisibility = 'public' | 'restricted' | 'hidden';

interface ToolAccessResult {
  hasAccess: boolean;
  visibility: ToolVisibility;
}

/**
 * Check if a user has access to a specific tool.
 * - Site admins always have access.
 * - Public tools: any logged-in user.
 * - Restricted/hidden tools: only users in tool_access table.
 */
export async function checkToolAccess(
  userEmail: string,
  toolId: string
): Promise<ToolAccessResult> {
  const svc = createServiceClient();

  // Get tool visibility from tool_config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (svc.from('tool_config') as any)
    .select('visibility')
    .eq('tool_id', toolId)
    .maybeSingle();

  const visibility: ToolVisibility = config?.visibility || 'public';

  // Public tools: everyone has access
  if (visibility === 'public') {
    return { hasAccess: true, visibility };
  }

  // Site admins always have access
  const siteAdmin = await getSiteAdmin(userEmail);
  if (siteAdmin.isSiteAdmin) {
    return { hasAccess: true, visibility };
  }

  // Check tool_access table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: access } = await (svc.from('tool_access') as any)
    .select('id')
    .ilike('user_email', userEmail)
    .eq('tool_id', toolId)
    .maybeSingle();

  return { hasAccess: !!access, visibility };
}

/**
 * Get list of tool_ids a user has access to.
 * Returns all public tools + any restricted/hidden tools they're granted.
 * Site admins get all tools.
 */
export async function getUserAccessibleToolIds(
  userEmail: string
): Promise<string[]> {
  const svc = createServiceClient();

  // Site admins get everything
  const siteAdmin = await getSiteAdmin(userEmail);

  // Get all active tool configs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: configs } = await (svc.from('tool_config') as any)
    .select('tool_id, visibility')
    .eq('is_active', true);

  if (!configs) return [];

  if (siteAdmin.isSiteAdmin) {
    return configs.map((c: { tool_id: string }) => c.tool_id);
  }

  // Public tools
  const publicTools = configs
    .filter((c: { visibility: string }) => c.visibility === 'public')
    .map((c: { tool_id: string }) => c.tool_id);

  // User's granted tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: grants } = await (svc.from('tool_access') as any)
    .select('tool_id')
    .ilike('user_email', userEmail);

  const grantedToolIds = (grants || []).map((g: { tool_id: string }) => g.tool_id);

  // Combine: public + granted (but only if tool is restricted or hidden, not inactive)
  const restrictedGranted = configs
    .filter((c: { tool_id: string; visibility: string }) =>
      (c.visibility === 'restricted' || c.visibility === 'hidden') &&
      grantedToolIds.includes(c.tool_id)
    )
    .map((c: { tool_id: string }) => c.tool_id);

  return [...new Set([...publicTools, ...restrictedGranted])];
}

/**
 * Get all users who have access to a specific tool.
 */
export async function getToolAccessList(toolId: string): Promise<Array<{
  id: string;
  user_email: string;
  granted_by: string | null;
  granted_at: string;
}>> {
  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('tool_access') as any)
    .select('*')
    .eq('tool_id', toolId)
    .order('granted_at', { ascending: false });

  return data || [];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/tool-access.ts
git commit -m "feat: tool access helper library"
```

---

### Task 3: Tool Access API — CRUD Endpoint

**Files:**
- Create: `app/api/tool-access/route.ts`

- [ ] **Step 1: Create the endpoint**

- **GET** `?tool_id=csv-dedup` — returns list of users with access to that tool
- **POST** `{ tool_id, user_email }` — grant access (adds row to tool_access, records granted_by from session)
- **DELETE** `?tool_id=csv-dedup&user_email=someone@gmail.com` — revoke access
- All operations require site admin auth (getSiteAdmin/isSiteAdmin)
- Use case-insensitive email matching (ilike)

- [ ] **Step 2: Commit**

```bash
git add app/api/tool-access/route.ts
git commit -m "feat: add /api/tool-access CRUD endpoint"
```

---

### Task 4: Update Middleware — Per-Tool Access Checks

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add per-tool access check**

After the general `/tools` auth check (line ~94 where unauthenticated users are redirected), add a new block for per-tool access control:

```typescript
// ── Per-tool access control ────────────────────────────────────────────
// Check if the tool route matches a restricted/hidden tool
if (user && path.startsWith('/tools/') && !path.startsWith('/tools/admin')) {
  // Extract tool slug from path: /tools/csv-dedup/... → csv-dedup
  const toolSlug = path.split('/')[2];
  
  if (toolSlug) {
    const { createServiceClient } = await import('@/lib/supabase-service');
    const svc = createServiceClient();
    
    // Check tool visibility
    const { data: config } = await (svc.from('tool_config') as any)
      .select('visibility')
      .eq('tool_id', toolSlug)
      .maybeSingle();
    
    if (config && (config.visibility === 'restricted' || config.visibility === 'hidden')) {
      // Check if user is a site admin (always allowed)
      const { data: siteAdmin } = await (svc.from('site_admins') as any)
        .select('role_level')
        .ilike('google_email', user.email)
        .maybeSingle();
      
      if (!siteAdmin) {
        // Check tool_access table
        const { data: access } = await (svc.from('tool_access') as any)
          .select('id')
          .eq('tool_id', toolSlug)
          .ilike('user_email', user.email)
          .maybeSingle();
        
        if (!access) {
          // No access — redirect to tools page
          const url = request.nextUrl.clone();
          url.pathname = '/tools';
          return NextResponse.redirect(url);
        }
      }
    }
  }
}
```

Place this AFTER the general auth check but BEFORE the scheduler RBAC blocks.

**Important:** This block should NOT run for:
- `/tools/admin/*` (handled by site admin check)
- `/tools/scheduler/intake` (already allowed public)
- `/tools/analytics/*` (handled by analytics admin check)

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware enforces per-tool access for restricted/hidden tools"
```

---

### Task 5: Update Tools Page — Filter by Access

**Files:**
- Modify: `app/tools/page.tsx`

- [ ] **Step 1: Convert to server component that checks access**

The tools page currently shows all tools statically. Make it check the user's access:

1. Get the authenticated user via `createClient()` 
2. Call `getUserAccessibleToolIds(user.email)` from `lib/tool-access.ts`
3. Filter the tools array to only show tools the user can access
4. Also check `tool_config` visibility — don't show `hidden` tools even in the list (restricted tools can appear with a "Restricted" badge, hidden tools don't appear at all unless user has access)
5. Site admins see all tools with visibility badges

If the page is currently a static page with `export const metadata`, convert it to a dynamic server component.

- [ ] **Step 2: Commit**

```bash
git add app/tools/page.tsx
git commit -m "feat: tools page filters by user access permissions"
```

---

### Task 6: Update tool_config API — Accept Visibility

**Files:**
- Modify: `app/api/usage/config/route.ts`

- [ ] **Step 1: Accept visibility in POST and PUT**

In the POST handler, accept `visibility` field (default to 'public' if not provided).
In the PUT handler, accept `visibility` field in updates.

Validate that visibility is one of: 'public', 'restricted', 'hidden'.

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/config/route.ts
git commit -m "feat: tool config API accepts visibility field"
```

---

### Task 7: Tool Access Management UI

**Files:**
- Create: `app/tools/admin/impact/ToolAccess.tsx`
- Modify: `app/tools/admin/impact/page.tsx`

- [ ] **Step 1: Create the Tool Access management component**

Build a client component with:

**Tool list with visibility controls:**
- Shows all tools (from `/api/usage/config`)
- Each tool has a visibility dropdown: Public / Restricted / Hidden
- Changing visibility calls PUT `/api/usage/config` with the new visibility

**Per-tool access list (for restricted/hidden tools):**
- When a restricted/hidden tool is selected, show its access list
- List of email addresses with access (from GET `/api/tool-access?tool_id=X`)
- "Add User" input — enter an email, click Add, calls POST `/api/tool-access`
- "Remove" button on each user — calls DELETE `/api/tool-access?tool_id=X&user_email=Y`
- Shows "Granted by: admin@example.com" and "Granted: Mar 26, 2026" for each entry

**Layout:**
- Left panel: list of tools with visibility dropdowns
- Right panel: access list for selected tool
- Light theme, teal accents, matching existing dashboard

- [ ] **Step 2: Add "Tool Access" tab to page.tsx**

Add a 4th tab alongside Impact Stats, Activity Feed, Admin Accounts.

- [ ] **Step 3: Commit**

```bash
git add app/tools/admin/impact/ToolAccess.tsx app/tools/admin/impact/page.tsx
git commit -m "feat: Tool Access management tab on Impact Dashboard"
```

---

### Task 8: Update Impact Dashboard — Visibility Badges

**Files:**
- Modify: `app/tools/admin/impact/ImpactDashboard.tsx`

- [ ] **Step 1: Show visibility badge on tool cards**

For each tool card in the stats view, show a small badge indicating visibility:
- 🟢 "Public" (green badge)
- 🔒 "Restricted" (amber badge)  
- 👁 "Hidden" (gray badge)

The visibility value comes from the stats response (already includes tool_config data).

- [ ] **Step 2: Commit**

```bash
git add app/tools/admin/impact/ImpactDashboard.tsx
git commit -m "feat: visibility badges on tool cards"
```

---

### Task 9: Final Build, Test & Deploy

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Smoke test checklist**

1. Set CSV Deduplicator to "restricted" via Tool Access tab
2. Add a specific email to CSV Deduplicator access list
3. As that user: can see and use CSV Deduplicator ✓
4. As a different user: cannot see CSV Deduplicator on tools page, gets redirected if visiting URL directly ✓
5. As site admin: can see and use all tools regardless of visibility ✓
6. Set a tool to "hidden": not visible on tools page for any non-admin, but accessible via URL for granted users ✓
7. Set a tool back to "public": everyone can see and use it ✓
8. Visibility badges show correctly on Impact Dashboard ✓

- [ ] **Step 3: Deploy**

```bash
git add -A
git commit -m "feat: complete tool access control system"
git push
vercel --prod --yes
```
