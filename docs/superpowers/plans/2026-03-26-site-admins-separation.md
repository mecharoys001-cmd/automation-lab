# Site Admins Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate site-wide admin access (Impact Dashboard, activity feed, usage tracking, admin management) from scheduler-specific admin access. Scheduler admins should NOT automatically have access to the Automation Lab website admin tools.

**Architecture:** Create a new `site_admins` table for Automation Lab website admin access. Add new RBAC helpers (`isSiteAdmin`, `getSiteAdminRole`) that check this table. Update middleware and all site-admin-protected routes to use the new table. The existing `admins` table remains untouched for scheduler access. The Admin Accounts tab on the Impact Dashboard manages `site_admins` instead of `admins`.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + service client), existing middleware, TypeScript.

---

## Current State

The `admins` table is used for BOTH:
1. **Scheduler access** — middleware checks `admins` for `/tools/scheduler/admin/*`
2. **Site-wide access** — middleware checks `admins` for `/tools/admin/*`, `/tools/analytics/admin/*`
3. **API routes** — `getOrgMembership()` and `isAdmin()` in `lib/rbac.ts` check `admins`
4. **Impact Dashboard APIs** — `/api/usage/stats`, `/api/usage/config`, `/api/activity/feed` use `isAdmin()` from rbac
5. **Admin Accounts UI** — manages the `admins` table via `/api/admins`

## Target State

| Resource | Auth Check |
|---|---|
| `/tools/scheduler/admin/*` | `admins` table (unchanged) |
| `/tools/scheduler/portal/*` | `instructors` table (unchanged) |
| `/tools/admin/impact/*` | **`site_admins` table (NEW)** |
| `/tools/analytics/admin/*` | **`site_admins` table (NEW)** |
| `/api/usage/stats` | **`isSiteAdmin()` (NEW)** |
| `/api/usage/config` | **`isSiteAdmin()` (NEW)** |
| `/api/activity/feed` | **`isSiteAdmin()` (NEW)** |
| `/api/site-admins` | **NEW endpoint, requires site master admin** |
| Admin Accounts tab | **manages `site_admins` (NEW)** |

---

## File Structure

```
# New files
supabase/migrations/20260326_site_admins.sql      — Create site_admins table
app/api/site-admins/route.ts                        — CRUD for site_admins (GET/POST/PATCH/DELETE)
lib/site-rbac.ts                                    — Site-specific RBAC: getSiteAdmin(), isSiteAdmin(), isSiteMasterAdmin()

# Modified files
middleware.ts                                       — /tools/admin/* and /tools/analytics/admin/* check site_admins instead of admins
app/api/usage/stats/route.ts                        — Use isSiteAdmin() instead of isAdmin()
app/api/usage/config/route.ts                       — Use isSiteAdmin() instead of isAdmin()
app/api/activity/feed/route.ts                      — Use isSiteAdmin() instead of isAdmin()
app/tools/admin/impact/AdminAccounts.tsx             — Hit /api/site-admins instead of /api/admins

# Unchanged files
lib/rbac.ts                                         — Untouched, still used by scheduler
lib/api-auth.ts                                     — Untouched, still used by scheduler API routes
app/api/admins/route.ts                             — Untouched, still manages scheduler admins
```

---

### Task 1: Database — Create site_admins Table

**Files:**
- Create: `supabase/migrations/20260326_site_admins.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Site-wide admins for the Automation Lab website
-- Separate from scheduler admins in the 'admins' table
CREATE TABLE IF NOT EXISTS site_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role_level TEXT NOT NULL DEFAULT 'standard' CHECK (role_level IN ('master', 'standard')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_site_admins_email ON site_admins(google_email);
ALTER TABLE site_admins ENABLE ROW LEVEL SECURITY;

-- Seed: Copy current admins who should have site access
-- (User should manually add the right emails after migration)
```

- [ ] **Step 2: User runs migration in Supabase SQL Editor**

After running the SQL, the user should manually insert their email:
```sql
INSERT INTO site_admins (google_email, display_name, role_level)
VALUES ('your-email@gmail.com', 'Your Name', 'master');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260326_site_admins.sql
git commit -m "feat: create site_admins table separate from scheduler admins"
```

---

### Task 2: Site-Specific RBAC Helper

**Files:**
- Create: `lib/site-rbac.ts`

- [ ] **Step 1: Create the site RBAC module**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/site-rbac.ts
git commit -m "feat: add site-specific RBAC helper (site_admins table)"
```

---

### Task 3: Site Admins API — CRUD Endpoint

**Files:**
- Create: `app/api/site-admins/route.ts`

- [ ] **Step 1: Create the endpoint**

Model after `app/api/admins/route.ts` but:
- Check `site_admins` table for auth (not `admins`)
- Only site master admins can manage site admins
- GET returns all site_admins
- POST creates a new site admin (email, display_name, role_level)
- PATCH updates role_level or display_name
- DELETE removes a site admin (cannot delete last master)
- All operations on the `site_admins` table

Auth pattern:
```typescript
import { createClient } from '@/lib/supabase/server';
import { getSiteAdmin, isSiteMasterAdmin } from '@/lib/site-rbac';

// In each handler:
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user?.email) return 401;

const siteAdmin = await getSiteAdmin(user.email);
if (!isSiteMasterAdmin(siteAdmin)) return 403;
```

- [ ] **Step 2: Commit**

```bash
git add app/api/site-admins/route.ts
git commit -m "feat: add /api/site-admins CRUD endpoint for site admin management"
```

---

### Task 4: Update Middleware — Site Admin Routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Change `/tools/admin/*` check to use site_admins**

Find the block:
```typescript
// ── RBAC for impact/usage admin ──────────────────────────────────────
if (user && path.startsWith('/tools/admin')) {
```

Change the query from:
```typescript
const { data: admin } = await (svc.from('admins') as any)
  .select('role_level')
  .eq('google_email', user.email)
  .maybeSingle()
```

To:
```typescript
const { data: siteAdmin } = await (svc.from('site_admins') as any)
  .select('role_level')
  .eq('google_email', user.email)
  .maybeSingle()

if (!siteAdmin) {
  // redirect to /tools
}
```

- [ ] **Step 2: Change `/tools/analytics/admin/*` check to use site_admins**

Same change — replace `admins` table lookup with `site_admins`.

- [ ] **Step 3: Leave scheduler blocks UNTOUCHED**

The `/tools/scheduler/admin/*` and `/tools/scheduler/portal/*` blocks must keep checking the `admins` and `instructors` tables. Do NOT modify those.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware checks site_admins for /tools/admin, keeps admins for scheduler"
```

---

### Task 5: Update API Routes — Use Site RBAC

**Files:**
- Modify: `app/api/usage/stats/route.ts`
- Modify: `app/api/usage/config/route.ts`
- Modify: `app/api/activity/feed/route.ts`

- [ ] **Step 1: Update usage stats route**

Replace:
```typescript
import { getOrgMembership, isAdmin } from '@/lib/rbac';
// ...
const membership = await getOrgMembership(user.email);
if (!isAdmin(membership)) { return 403 }
```

With:
```typescript
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';
// ...
const siteAdmin = await getSiteAdmin(user.email);
if (!isSiteAdmin(siteAdmin)) { return 403 }
```

- [ ] **Step 2: Update usage config route**

Same replacement in the `requireAdmin` helper function at the top of the file.

- [ ] **Step 3: Update activity feed route**

Same replacement.

- [ ] **Step 4: Commit**

```bash
git add app/api/usage/stats/route.ts app/api/usage/config/route.ts app/api/activity/feed/route.ts
git commit -m "feat: usage/activity APIs check site_admins instead of scheduler admins"
```

---

### Task 6: Update Admin Accounts UI

**Files:**
- Modify: `app/tools/admin/impact/AdminAccounts.tsx`

- [ ] **Step 1: Change API calls from /api/admins to /api/site-admins**

Replace all instances of:
- `fetch('/api/admins')` → `fetch('/api/site-admins')`
- `fetch('/api/admins', ...)` → `fetch('/api/site-admins', ...)`
- `fetch(\`/api/admins?id=...\`)` → `fetch(\`/api/site-admins?id=...\`)`

- [ ] **Step 2: Update UI labels**

Change header from "Admin Accounts" to "Site Admin Accounts" and add a note:
"These accounts have access to the Impact Dashboard and site-wide analytics. Scheduler admin accounts are managed separately."

- [ ] **Step 3: Commit**

```bash
git add app/tools/admin/impact/AdminAccounts.tsx
git commit -m "feat: Admin Accounts tab manages site_admins, not scheduler admins"
```

---

### Task 7: Final Build, Test & Deploy

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Smoke test checklist**

1. As a site_admin: Can access `/tools/admin/impact` ✓
2. As a scheduler admin (in `admins` but NOT `site_admins`): Cannot access `/tools/admin/impact`, redirects to `/tools` ✓
3. As a scheduler admin: Can still access `/tools/scheduler/admin` ✓
4. Admin Accounts tab: Shows site_admins, not scheduler admins ✓
5. Add/remove site admin works via the UI ✓
6. Impact Stats, Activity Feed, Config editing all work ✓
7. `/api/usage/summary` (public) still works without auth ✓

- [ ] **Step 3: Commit and deploy**

```bash
git add -A
git commit -m "feat: complete site_admins separation from scheduler admins"
git push
```
