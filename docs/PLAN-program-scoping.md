# Plan: Program-Scoped Data (Siloed Environments)

## Goal
Make each Program a fully isolated environment. Staff, Venues, Tags, and Events are scoped to the selected program. When switching programs, all data changes. New programs can import data from existing programs.

---

## Current State

### What's already scoped to programs:
- `session_templates` — has `program_id` column ✅
- `sessions` — scoped via template relationship ✅
- `programs` — exists, has selector in UI ✅
- Venues API — already accepts optional `program_id` param (but column may not exist yet)

### What's NOT scoped (global today):
- `instructors` — no `program_id`, fetched globally
- `venues` — no `program_id` in DB (API has param but no column)
- `tags` — no `program_id`, fetched globally

### Default tags defined in:
- `app/api/seed/default-tags.ts` — DEFAULT_TAGS (skills, instruments, class types) + DEFAULT_SPACE_TYPES

---

## Phase 1: Database Migration

**File:** `supabase/migrations/20260316_program_scoped_data.sql`

### Steps:
1. Add `program_id` column (UUID, nullable initially) to:
   - `instructors`
   - `venues`
   - `tags`

2. Find existing program ID:
   ```sql
   -- Get the Symphonix 2025-2026 program ID for migration
   ```

3. Backfill existing data:
   ```sql
   UPDATE instructors SET program_id = '<symphonix_id>' WHERE program_id IS NULL;
   UPDATE venues SET program_id = '<symphonix_id>' WHERE program_id IS NULL;
   UPDATE tags SET program_id = '<symphonix_id>' WHERE program_id IS NULL;
   ```

4. Make `program_id` NOT NULL after backfill:
   ```sql
   ALTER TABLE instructors ALTER COLUMN program_id SET NOT NULL;
   ALTER TABLE venues ALTER COLUMN program_id SET NOT NULL;
   ALTER TABLE tags ALTER COLUMN program_id SET NOT NULL;
   ```

5. Add foreign key constraints and indexes.

**Note:** Since this is Supabase/Postgres, use standard ALTER TABLE syntax.

---

## Phase 2: API Changes

### 2a. Instructors API
**File:** `app/api/instructors/route.ts`

- **GET:** Add `program_id` query param (required). Filter: `.eq('program_id', programId)`
- **POST:** Require `program_id` in body. Include when inserting.
- Return 400 if `program_id` missing.

**File:** `app/api/instructors/[id]/route.ts`
- **PATCH/DELETE:** No change needed (operates on specific ID).

**File:** `app/api/instructors/import/route.ts`
- Require `program_id` — set on each imported instructor.

### 2b. Venues API
**File:** `app/api/venues/route.ts`

- **GET:** Make `program_id` required (currently optional). Filter: `.eq('program_id', programId)`
- **POST:** Require `program_id` in body.

**File:** `app/api/venues/[id]/route.ts`
- **PATCH/DELETE:** No change needed.

**File:** `app/api/venues/import/route.ts`
- Require `program_id`.

### 2c. Tags API
**File:** `app/api/tags/route.ts`

- **GET:** Add `program_id` query param (required). Filter: `.eq('program_id', programId)`
- **POST:** Require `program_id` in body. Include when inserting.

**File:** `app/api/tags/[id]/route.ts`
- **PATCH/DELETE:** No change needed.

**File:** `app/api/tags/import/route.ts`
- Require `program_id`.

### 2d. Other APIs that query these tables
Each of these needs `program_id` filtering where they query instructors/venues/tags:

| File | Table(s) | Change |
|------|----------|--------|
| `app/api/scheduler/validate/route.ts` | instructors, venues | Already has `program_id` for templates; add to instructor/venue queries |
| `app/api/data/clear-all/route.ts` | all | Scope deletes to program_id |
| `app/api/data/counts/route.ts` | all | Scope counts to program_id |
| `app/api/seed/route.ts` | all | Scope seeding to program_id |
| `app/api/seed/ensure-defaults/route.ts` | tags | Scope to program_id |
| `app/api/sessions/check-conflict/route.ts` | venues | Already scoped via venue_id |
| `app/api/sessions/route.ts` | instructors, venues | Add program_id filter where needed |
| `app/api/sessions/[id]/route.ts` | instructors, venues | Add program_id filter where needed |
| `app/api/sessions/bulk-assign/route.ts` | instructors | Add program_id filter |
| `app/api/templates/route.ts` | instructors | Add program_id filter on instructor queries |
| `app/api/templates/[id]/route.ts` | instructors | Add program_id filter |
| `app/api/templates/import/route.ts` | instructors, venues | Add program_id |
| `app/api/reports/instructor-detail/route.ts` | instructors | Add program_id filter |
| `app/api/instructor-sessions/route.ts` | instructors | Add program_id filter |
| `app/api/intake/submit/route.ts` | tags | Add program_id filter |
| `app/api/versions/save/route.ts` | all | Scope snapshot to program_id |
| `app/api/import/seed-data/route.ts` | tags, venues | Add program_id |
| `app/api/exceptions/substitute-candidates/route.ts` | instructors | Add program_id filter |
| `app/api/exceptions/resolve/route.ts` | instructors | Add program_id filter |
| `app/api/notifications/publish/route.ts` | instructors | Add program_id filter |

### 2e. New API: Program Import
**File:** `app/api/programs/[id]/import/route.ts` (NEW)

```typescript
// POST /api/programs/:id/import
// Body: {
//   source_program_id: string,
//   import_staff: boolean,
//   import_venues: boolean,
//   import_tags: boolean,
//   tag_categories?: string[]  // if provided, only import these categories
// }
//
// Logic:
// 1. Fetch selected items from source program
// 2. Strip IDs (let DB generate new ones)
// 3. Set program_id to target program
// 4. Insert as new records
// 5. Return counts of imported items
```

### 2f. Program Creation: Auto-copy defaults
**File:** `app/api/programs/route.ts` (modify POST)

After creating a new program:
1. Copy all DEFAULT_TAGS and DEFAULT_SPACE_TYPES from `default-tags.ts`
2. Insert them with the new program's ID
3. This ensures every new program starts with the standard tag set

---

## Phase 3: UI Changes

### 3a. People page (Staff & Venues)
**File:** `app/tools/scheduler/admin/people/page.tsx`

Current fetches (NO program_id):
- `fetch('/api/instructors')` → change to `fetch('/api/instructors?program_id=${selectedProgramId}')`
- `fetch('/api/venues')` → change to `fetch('/api/venues?program_id=${selectedProgramId}')`
- `fetch('/api/tags')` → change to `fetch('/api/tags?program_id=${selectedProgramId}')`

Also:
- POST requests for new instructors/venues must include `program_id` in body
- Re-fetch when `selectedProgramId` changes

### 3b. Tags page
**File:** `app/tools/scheduler/admin/tags/page.tsx`

- `fetch('/api/tags')` → `fetch('/api/tags?program_id=${selectedProgramId}')`
- POST new tags: include `program_id` in body
- Re-fetch when `selectedProgramId` changes

### 3c. Calendar page
**File:** `app/tools/scheduler/admin/page.tsx`

Already uses `selectedProgramId` for sessions/templates. Update:
- Instructor fetches: add `program_id`
- Venue fetches: add `program_id`
- Tag fetches: add `program_id`

### 3d. Event Templates page
**File:** `app/tools/scheduler/admin/event-templates/page.tsx`

- Already scoped by program for templates
- Update instructor/venue/tag fetches to include `program_id`

### 3e. Reports pages
**Files:**
- `app/tools/scheduler/admin/reports/page.tsx`
- `app/tools/scheduler/admin/reports/instructor-hours/page.tsx`
- `app/tools/scheduler/admin/reports/sessions-by-template/page.tsx`
- `app/tools/scheduler/admin/reports/hours-by-tag/page.tsx`

- Add `program_id` to any instructor/venue/tag fetches

### 3f. Intake page
**File:** `app/tools/scheduler/intake/page.tsx`

- Add `program_id` to tag fetches

### 3g. Settings page
**File:** `app/tools/scheduler/admin/settings/page.tsx`

- If it fetches instructors/venues/tags, add `program_id`

### 3h. TagSelector component
**File:** `app/tools/scheduler/components/ui/TagSelector.tsx`

- Currently fetches from `/api/tags` without program_id
- Add `programId` prop
- Fetch: `/api/tags?program_id=${programId}`
- All consumers must pass `programId`

### 3i. New Program Import UI
**Location:** Add to program creation flow or settings

**New component:** `ImportFromProgramModal.tsx`

UI:
1. "Import from existing program" section
2. Source program dropdown (list all other programs)
3. Checkboxes:
   - ☑ Import Staff (X instructors)
   - ☑ Import Venues (X venues)
   - ☑ Import Tags
     - When checked, expand to show category checkboxes:
       - ☑ Select All
       - ☑ Event Type (X tags)
       - ☑ Space Types (X tags)
       - ☑ Skill Level (X tags)
       - ☑ Instrument (X tags)
       - etc.
4. "Import" button → calls POST /api/programs/:id/import
5. Success toast with counts

---

## Phase 4: Data Integrity

### Things to verify after migration:
1. Switching programs in the UI only shows that program's data
2. Creating new staff/venues/tags assigns them to the selected program
3. Creating a new program auto-copies default tags
4. Import from existing program creates separate copies (new IDs)
5. Calendar events still render correctly (they're already scoped)
6. Reports only show data from the selected program
7. TagSelector dropdowns only show the current program's tags
8. Auto-scheduler only uses the current program's instructors/venues
9. Venue conflict checks only consider the same program's sessions
10. Clear Events / Generate Schedule only affects the current program

---

## Execution Order

1. **Database migration** (Phase 1) — foundation
2. **API changes** (Phase 2a-2d) — all endpoints scoped
3. **Program creation + defaults** (Phase 2e-2f) — new programs get defaults
4. **UI page updates** (Phase 3a-3g) — pass program_id everywhere
5. **TagSelector update** (Phase 3h) — component-level fix
6. **Import UI** (Phase 3i) — new feature
7. **Testing** (Phase 4) — verify everything

---

## Files Changed (Complete List)

### New files:
- `supabase/migrations/20260316_program_scoped_data.sql`
- `app/api/programs/[id]/import/route.ts`
- `app/tools/scheduler/components/modals/ImportFromProgramModal.tsx`

### Modified API files (18):
- `app/api/instructors/route.ts`
- `app/api/instructors/import/route.ts`
- `app/api/venues/route.ts`
- `app/api/venues/import/route.ts`
- `app/api/tags/route.ts`
- `app/api/tags/import/route.ts`
- `app/api/programs/route.ts`
- `app/api/scheduler/validate/route.ts`
- `app/api/data/clear-all/route.ts`
- `app/api/data/counts/route.ts`
- `app/api/seed/route.ts`
- `app/api/seed/ensure-defaults/route.ts`
- `app/api/sessions/route.ts`
- `app/api/sessions/bulk-assign/route.ts`
- `app/api/templates/route.ts`
- `app/api/templates/import/route.ts`
- `app/api/reports/instructor-detail/route.ts`
- `app/api/import/seed-data/route.ts`

### Modified UI files (10):
- `app/tools/scheduler/admin/people/page.tsx`
- `app/tools/scheduler/admin/tags/page.tsx`
- `app/tools/scheduler/admin/page.tsx`
- `app/tools/scheduler/admin/event-templates/page.tsx`
- `app/tools/scheduler/admin/settings/page.tsx`
- `app/tools/scheduler/admin/reports/page.tsx`
- `app/tools/scheduler/admin/reports/instructor-hours/page.tsx`
- `app/tools/scheduler/admin/reports/sessions-by-template/page.tsx`
- `app/tools/scheduler/admin/reports/hours-by-tag/page.tsx`
- `app/tools/scheduler/intake/page.tsx`

### Modified components (1):
- `app/tools/scheduler/components/ui/TagSelector.tsx`
