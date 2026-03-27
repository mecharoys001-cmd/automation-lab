# Tool Suites & Delegated Access Control

**Created:** 2026-03-27
**Status:** Draft — awaiting approval
**Branch:** `feature/tool-suites`

## Problem

Right now, tool access is per-tool, per-user email. This works for a few tools and a handful of users, but doesn't scale when:
- An organization needs access to 10 tools — you'd have to add each user to each tool individually
- Organizations want to manage their own users without contacting us
- New tools are added to a suite — every user must be manually granted access

## Solution: Tool Suites with Delegated Management

### Core Concepts

1. **Tool Visibility** (already exists) — `public`, `restricted`, `hidden`
2. **Tool Suites** (new) — Named groups of tools (e.g., "NWCT Arts Council Suite", "FCH Suite")
3. **Suite Managers** (new) — Users who can add/remove members from a suite they manage
4. **Suite Membership** (new) — Users assigned to a suite get access to all tools in that suite

### Access Resolution Order

When a user tries to access a tool:
1. **Public?** → Allow (any logged-in user)
2. **Site admin?** → Allow (bypass all restrictions)
3. **Direct tool_access grant?** → Allow (existing per-tool grants, kept for edge cases)
4. **Member of a suite that contains this tool?** → Allow
5. **Deny** → Redirect to `/tools`

---

## Database Schema

### New Tables

#### `tool_suites`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| name | TEXT NOT NULL | e.g., "NWCT Arts Council" |
| slug | TEXT NOT NULL UNIQUE | URL-safe, e.g., "nwct-arts-council" |
| description | TEXT | Optional description |
| created_by | TEXT | Email of creator |
| created_at | TIMESTAMPTZ | Default NOW() |
| updated_at | TIMESTAMPTZ | Default NOW() |

#### `tool_suite_tools`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| suite_id | UUID FK → tool_suites.id | ON DELETE CASCADE |
| tool_id | TEXT NOT NULL | Matches tool_config.tool_id |
| added_at | TIMESTAMPTZ | Default NOW() |
| UNIQUE(suite_id, tool_id) | | Prevent duplicates |

#### `tool_suite_members`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| suite_id | UUID FK → tool_suites.id | ON DELETE CASCADE |
| user_email | TEXT NOT NULL | Case-insensitive lookups |
| role | TEXT NOT NULL DEFAULT 'member' | 'member' or 'manager' |
| granted_by | TEXT | Email of who added them |
| granted_at | TIMESTAMPTZ | Default NOW() |
| UNIQUE(suite_id, user_email) | | One role per suite per user |

### Roles

| Role | Can see suite tools | Can add/remove members | Can add/remove tools | Can delete suite |
|------|--------------------|-----------------------|---------------------|-----------------|
| **member** | ✅ | ❌ | ❌ | ❌ |
| **manager** | ✅ | ✅ (members only, not other managers) | ❌ | ❌ |
| **site_admin** | ✅ (all suites) | ✅ (anyone) | ✅ | ✅ |

Key constraint: **Managers can add/remove members, but cannot promote to manager or remove other managers.** Only site admins can assign manager role.

---

## Implementation Tasks

### Task 0: Branch Setup
- Create `feature/tool-suites` branch from master
- All work on this branch until approved

### Task 1: SQL Migration
Create `supabase/migrations/20260327_tool_suites.sql`:
- Create `tool_suites`, `tool_suite_tools`, `tool_suite_members` tables
- Add indexes on suite_id, tool_id, user_email
- Enable RLS on all three tables
- Keep existing `tool_access` table (backward compatible)

### Task 2: Access Resolution Library
Update `lib/tool-access.ts`:
- Add `checkSuiteAccess(email, toolId)` — checks if user is member of any suite containing this tool
- Modify `checkToolAccess()` to include suite check after direct grant check
- Add `getUserSuites(email)` — returns all suites a user belongs to
- Add `getUserAccessibleToolIds()` update to include suite-granted tools
- All email lookups use `.ilike()` (case-insensitive)

### Task 3: Suite Management API
Create `app/api/tool-suites/route.ts`:
- `GET` — List all suites (site admins see all; managers/members see their own)
- `POST { name, slug, description }` — Create suite (site admin only)
- `PUT { id, name, description }` — Update suite (site admin only)
- `DELETE { id }` — Delete suite (site admin only)

Create `app/api/tool-suites/[id]/tools/route.ts`:
- `GET` — List tools in suite
- `POST { tool_id }` — Add tool to suite (site admin only)
- `DELETE { tool_id }` — Remove tool from suite (site admin only)

Create `app/api/tool-suites/[id]/members/route.ts`:
- `GET` — List members (site admin or suite manager)
- `POST { user_email, role }` — Add member (site admin can set any role; manager can add 'member' only)
- `PUT { user_email, role }` — Change role (site admin only)
- `DELETE { user_email }` — Remove member (site admin: anyone; manager: members only, not other managers)

### Task 4: Middleware Update
Update `middleware.ts`:
- After existing tool visibility check, add suite membership check
- A restricted/hidden tool is accessible if user is member of a suite containing it
- No changes needed for public tools

### Task 5: Tools Page Update
Update `app/tools/page.tsx`:
- Include suite-granted tools in the visible tool list
- Optionally group tools by suite (e.g., "Your Tools — NWCT Arts Council")

### Task 6: Admin UI — Suite Management
Add new tab to Impact Dashboard or create `app/tools/admin/suites/`:
- **Suites list** — Create, edit, delete suites
- **Suite detail** — Add/remove tools, add/remove members, set roles
- Clean UI with tooltips on everything

### Task 7: Manager UI — Member Management
Create `app/tools/admin/suite-manager/` (or integrate into existing tools page):
- Managers see only their suites
- Can add/remove members (not managers)
- Cannot modify tool assignments
- Simple, clean interface — these are nonprofit staff, not developers

### Task 8: Notification (Optional, Phase 2)
- Email notification when added to a suite
- Email notification when given manager role
- Skip for initial build, add later if needed

### Task 9: Testing & Verification
- Verify: Public tools still visible to everyone
- Verify: Restricted tools only visible to direct-granted users + suite members
- Verify: Hidden tools not shown on tools page, only accessible via direct URL if granted
- Verify: Manager can add/remove members but not managers
- Verify: Removing a tool from a suite immediately removes access for suite members (unless they have direct grant)
- Verify: Removing a user from a suite immediately removes their access to suite tools (unless directly granted)
- Verify: Site admins see everything always

---

## Example Usage

**Setup:**
1. Site admin creates suite "NWCT Arts Council" (slug: `nwct`)
2. Adds tools: `scheduler`, `csv-dedup`, `mail-merge`, `volunteer-tracker`
3. Sets all four tools to `restricted` visibility
4. Adds Steph Burr as `manager`
5. Adds two staff members as `member`

**Day-to-day:**
- Steph logs in → sees all 4 tools on `/tools` page
- Steph adds a new hire → they immediately see all 4 tools
- Steph removes someone who left → they lose access instantly
- If Steph needs a new tool added to the suite, she asks us

**Another org:**
1. Site admin creates "FCH Suite"
2. Adds different tools
3. Assigns their contact as manager
4. That organization is fully self-service for user management

---

## Migration Path

- Existing `tool_access` direct grants continue to work (checked before suite check)
- No breaking changes to current access
- Suites are additive — you can use both direct grants AND suites
- Over time, migrate direct grants into suites as it makes sense

## Files Modified/Created

**New files:**
- `supabase/migrations/20260327_tool_suites.sql`
- `app/api/tool-suites/route.ts`
- `app/api/tool-suites/[id]/tools/route.ts`
- `app/api/tool-suites/[id]/members/route.ts`
- `app/tools/admin/impact/SuiteManagement.tsx` (or separate page)
- `app/tools/admin/suite-manager/page.tsx` (manager-facing UI)

**Modified files:**
- `lib/tool-access.ts` — add suite checks
- `middleware.ts` — add suite check to access resolution
- `app/tools/page.tsx` — show suite-grouped tools
- `app/tools/admin/impact/ImpactDashboard.tsx` — add Suites tab
