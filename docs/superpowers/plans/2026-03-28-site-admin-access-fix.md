# Fix: Site Admins Must Access All Tools — Always

**Created:** 2026-03-28
**Status:** Draft — awaiting approval

## Problem

Site admins (`site_admins` table) cannot access all tools despite having master-level access. The middleware has multiple access gates that each independently check permissions, and several have bugs or gaps.

## Root Cause Analysis

The middleware runs **three sequential access gates** for a path like `/tools/scheduler/admin`:

### Gate 1: Tool Visibility (line 123)
- Extracts `toolSlug` from URL (`scheduler`)
- Checks `tool_config.visibility`
- If `restricted` → checks `site_admins` → ✅ This works correctly
- **But**: skips paths starting with `/tools/admin` — this is for the Impact Dashboard, not scheduler admin

### Gate 2: Impact/Analytics Admin RBAC (lines 195-236)
- Checks `/tools/analytics/admin` and `/tools/admin/*`
- ✅ Works correctly for site admins

### Gate 3: Scheduler RBAC (line 247)
- Checks `/tools/scheduler/admin` and `/tools/scheduler/portal`
- Checks `site_admins` → sets `isSiteAdminUser` → ✅ bypasses org membership check
- **BUG (line 297):** Role-level enforcement runs `admin.role_level` but when user is ONLY a site admin (not in scheduler `admins` table), `admin` is `null`. This crashes or returns undefined, causing the role check to fail/redirect.

```typescript
// Line 297 — admin can be null for site-only admins!
if (isAdmin && path.startsWith('/tools/scheduler/admin')) {
  const roleLevel = admin.role_level as string  // 💥 null.role_level
```

### Summary of Bugs

1. **Crash on role-level check**: Site admins not in scheduler `admins` table hit `admin.role_level` where `admin` is null
2. **No early return for site admins**: Site admins should skip ALL subsequent checks — they're god-mode users
3. **Redundant site_admins queries**: The same table is queried up to 3 times per request for the same user
4. **No future-proofing**: Every new tool gate requires manually adding site_admin checks

## Solution

### Principle: Site admins bypass EVERYTHING early

Add a single site_admin check near the top of the middleware, right after authentication. If the user is a site admin, skip all access gates and return immediately.

## Implementation Plan

### Task 1: Add early site-admin bypass

After the auth check and public route exceptions (scheduler intake, reports), add:

```typescript
// ── Site admins bypass all access gates ─────────────────────────
if (user) {
  const { createServiceClient } = await import('@/lib/supabase-service')
  const svc = createServiceClient()
  const { data: siteAdmin } = await (svc.from('site_admins') as any)
    .select('role_level')
    .ilike('google_email', user.email!)
    .maybeSingle()
  
  if (siteAdmin) {
    applySecurityHeaders(supabaseResponse, nonce)
    return supabaseResponse
  }
}
```

This single check replaces all downstream site_admin lookups.

### Task 2: Clean up redundant checks

Remove the individual `site_admins` queries from:
- Tool visibility gate (line 145)
- Analytics admin gate (line 197)
- Impact admin gate (line 223)
- Scheduler RBAC gate (line 250)
- Suite manager gate (implicit)

These are now dead code since site admins never reach them.

### Task 3: Fix the null crash in scheduler role-level check

Even after the early bypass, fix the defensive bug:

```typescript
// Before:
const roleLevel = admin.role_level as string

// After:
const roleLevel = admin?.role_level as string ?? ''
```

### Task 4: Apply same pattern to lib/tool-access.ts

The `checkToolAccess()` and `getUserAccessibleToolIds()` functions also check site admins — these are fine (they already short-circuit), but verify they work correctly for future tools not yet in tool_config.

### Task 5: Verify all tool paths

Verify site admin access works for every tool path:
- `/tools` (tools listing)
- `/tools/scheduler/admin` (scheduler admin)
- `/tools/scheduler/portal` (instructor portal)
- `/tools/csv-dedup` (CSV dedup tool)
- `/tools/reports` (transaction reports)
- `/tools/mail-merge` (mail merge)
- `/tools/mailing-list-builder` (mailing list)
- `/tools/admin/impact` (impact dashboard)
- `/tools/admin/suite-manager` (suite manager)
- `/tools/analytics/admin` (analytics admin)
- Any future `/tools/*` path

## Files Modified

- `middleware.ts` — early site-admin bypass + cleanup redundant checks + null fix

## Risk Assessment

**Low risk.** We're adding an early return that bypasses all subsequent logic for site admins. The downstream checks remain intact for non-admin users. No database schema changes.
