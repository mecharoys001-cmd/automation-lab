# Cache Invalidation After Delete All Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the UI immediately reflects deleted data without requiring hard refresh when users click "Delete All Data" or "Clear Sessions"

**Problem:** The `requestCache` singleton caches API responses for 2 minutes. After clicking "Delete All Data", the cache still serves stale data (instructors, venues, templates) until user manually hard-refreshes the browser.

**Root Cause:** The `handleClearData()` function in `app/tools/scheduler/admin/settings/page.tsx` doesn't invalidate the request cache after successful deletion.

**Architecture:** Add explicit cache invalidation after DELETE operations complete successfully. Use existing `requestCache.invalidate()` and `requestCache.clear()` methods to bust cached entries.

**Tech Stack:** 
- Existing: `requestCache` singleton (`lib/requestCache.ts`)
- Pattern: Call `requestCache.clear()` or `requestCache.invalidate()` after mutations
- Locations: Settings page, bulk operations, CSV import flows

---

## File Structure

**Modified Files:**
- `app/tools/scheduler/admin/settings/page.tsx` — Add cache invalidation after clear-all/clear-sessions
- `app/tools/scheduler/admin/people/page.tsx` — Add cache invalidation after instructor/venue delete/import
- `app/tools/scheduler/admin/event-templates/page.tsx` — Add cache invalidation after template operations (if needed)

**No new files required** — using existing `requestCache` utilities.

---

## Task 1: Add Cache Invalidation to Settings Page Clear Operations

**Files:**
- Modify: `app/tools/scheduler/admin/settings/page.tsx:450-510`

### Step 1.1: Locate the handleClearData function

- [ ] **Navigate to handleClearData function**

The function starts around line 450. It handles both "clear-all" and "clear-sessions" operations.

Current code structure:
```typescript
async function handleClearData() {
  // ... deletion logic ...
  
  // Success toast
  setToast({ message: '...', type: 'success' });
}
```

### Step 1.2: Import requestCache at top of file

- [ ] **Add import statement**

After existing imports (around line 1-20), add:

```typescript
import { requestCache } from '@/lib/requestCache';
```

### Step 1.3: Add cache invalidation before success toast

- [ ] **Insert cache clear call**

Find this block (around line 486):
```typescript
      setClearModalOpen(false);
      setToast({
        message: parts.length > 0
          ? `Cleared: ${parts.join(', ')}`
          : clearMode === 'all'
            ? 'All data cleared (nothing to delete)'
            : 'Sessions cleared (nothing to delete)',
        type: 'success',
        id: Date.now(),
      });
```

**Replace with:**
```typescript
      // Invalidate all cached API responses so UI reflects empty state immediately
      requestCache.clear();

      setClearModalOpen(false);
      setToast({
        message: parts.length > 0
          ? `Cleared: ${parts.join(', ')}`
          : clearMode === 'all'
            ? 'All data cleared (nothing to delete)'
            : 'Sessions cleared (nothing to delete)',
        type: 'success',
        id: Date.now(),
      });
```

### Step 1.4: Test clear-all operation

- [ ] **Manual test: Delete All Data**

Steps:
1. Navigate to Settings page
2. Click "Delete All Data"
3. Confirm deletion
4. Immediately navigate to People tab
5. **Expected:** Instructors and venues list should be empty WITHOUT hard refresh
6. **Expected:** No stale data visible

### Step 1.5: Test clear-sessions operation

- [ ] **Manual test: Clear Sessions Only**

Steps:
1. Add test data (instructors, venues, sessions)
2. Navigate to Settings page
3. Select "Clear Sessions Only"
4. Click "Delete"
5. Navigate to Calendar tab
6. **Expected:** No sessions visible WITHOUT hard refresh
7. **Expected:** Instructors and venues still visible (not deleted)

### Step 1.6: Commit changes

- [ ] **Commit**

```bash
git add app/tools/scheduler/admin/settings/page.tsx
git commit -m "fix: invalidate cache after Delete All Data / Clear Sessions

- Import requestCache singleton
- Call requestCache.clear() after successful deletion
- Ensures UI reflects empty state without hard refresh
- Fixes stale data bug reported in #ui-rework

Closes: cache-invalidation-after-delete"
```

---

## Task 2: Add Cache Invalidation to Instructor/Venue Operations

**Files:**
- Modify: `app/tools/scheduler/admin/people/page.tsx` (multiple functions)

### Step 2.1: Import requestCache

- [ ] **Add import at top of file**

```typescript
import { requestCache } from '@/lib/requestCache';
```

### Step 2.2: Invalidate cache after instructor delete

- [ ] **Find handleDeleteInstructor function (around line 1683)**

Current code:
```typescript
const res = await fetch(`/api/instructors/${editingInstructor.id}`, { method: 'DELETE' });
if (!res.ok) throw new Error('Delete failed');

setEditingInstructor(null);
setToast({ message: 'Instructor deleted', type: 'success', id: Date.now() });
```

**Add after successful delete:**
```typescript
const res = await fetch(`/api/instructors/${editingInstructor.id}`, { method: 'DELETE' });
if (!res.ok) throw new Error('Delete failed');

// Invalidate instructor cache
requestCache.invalidate(/\/api\/instructors/);

setEditingInstructor(null);
setToast({ message: 'Instructor deleted', type: 'success', id: Date.now() });
```

### Step 2.3: Invalidate cache after venue delete

- [ ] **Find handleDeleteVenue function (around line 1569)**

```typescript
const res = await fetch(`/api/venues/${selectedVenue.id}`, { method: 'DELETE' });
if (!res.ok) throw new Error('Delete failed');

// Invalidate venue cache
requestCache.invalidate(/\/api\/venues/);

setSelectedVenue(null);
setToast({ message: 'Venue deleted', type: 'success', id: Date.now() });
```

### Step 2.4: Invalidate cache after instructor CSV import

- [ ] **Find instructor import handler (around line 2218)**

After successful import (`if (data.success)`):

```typescript
if (data.success) {
  setImportMode(null);
  setImportFile(null);
  
  // Invalidate instructor cache so new imports appear immediately
  requestCache.invalidate(/\/api\/instructors/);
  
  setToast({
    message: `Imported ${data.imported ?? 0} instructors`,
    type: 'success',
    id: Date.now(),
  });
}
```

### Step 2.5: Invalidate cache after venue CSV import

- [ ] **Find venue import handler (around line 2178)**

```typescript
if (data.success) {
  setImportMode(null);
  setImportFile(null);
  
  // Invalidate venue cache so new imports appear immediately
  requestCache.invalidate(/\/api\/venues/);
  
  setToast({
    message: `Imported ${data.imported ?? 0} venues`,
    type: 'success',
    id: Date.now(),
  });
}
```

### Step 2.6: Invalidate cache after instructor save/create

- [ ] **Find handleSaveInstructor function (around line 1524)**

After successful POST/PUT:

```typescript
const res = await fetch(
  editingInstructor?.id ? `/api/instructors/${editingInstructor.id}` : '/api/instructors',
  {
    method: editingInstructor?.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
);

if (!res.ok) throw new Error('Save failed');

// Invalidate instructor cache
requestCache.invalidate(/\/api\/instructors/);

setEditingInstructor(null);
setToast({ message: 'Instructor saved', type: 'success', id: Date.now() });
```

### Step 2.7: Invalidate cache after venue save/create

- [ ] **Find handleSaveVenue function (around line 1546)**

```typescript
const res = await fetch(
  editingVenue?.id ? `/api/venues/${editingVenue.id}` : '/api/venues',
  {
    method: editingVenue?.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
);

if (!res.ok) throw new Error('Save failed');

// Invalidate venue cache
requestCache.invalidate(/\/api\/venues/);

setEditingVenue(null);
setToast({ message: 'Venue saved', type: 'success', id: Date.now() });
```

### Step 2.8: Test instructor operations

- [ ] **Manual test: Delete instructor**

1. Navigate to People tab
2. Delete an instructor
3. **Expected:** Instructor disappears immediately from list
4. Refresh instructor dropdown on Calendar page — should not show deleted instructor

- [ ] **Manual test: CSV import instructors**

1. Import CSV with new instructors
2. **Expected:** New instructors appear immediately in People tab
3. Navigate to Calendar → instructor dropdown should include new instructors

### Step 2.9: Test venue operations

- [ ] **Manual test: Delete venue**

1. Navigate to People tab → Venues
2. Delete a venue
3. **Expected:** Venue disappears immediately
4. Check Calendar page venue filters — deleted venue should be gone

- [ ] **Manual test: CSV import venues**

1. Import CSV with new venues
2. **Expected:** New venues appear immediately
3. Check Calendar venue filters — new venues should be present

### Step 2.10: Commit changes

- [ ] **Commit**

```bash
git add app/tools/scheduler/admin/people/page.tsx
git commit -m "fix: invalidate cache after instructor/venue mutations

- Invalidate /api/instructors cache after create/update/delete/import
- Invalidate /api/venues cache after create/update/delete/import
- Ensures People tab updates immediately without refresh
- Prevents stale dropdowns on Calendar page

Part of: cache-invalidation-after-delete"
```

---

## Task 3: Add Cache Invalidation to Template Operations (If Needed)

**Files:**
- Modify: `app/tools/scheduler/admin/event-templates/page.tsx` (conditional — only if templates aren't auto-refreshing)

### Step 3.1: Check if template operations already invalidate cache

- [ ] **Manual test: Create/delete template**

1. Navigate to Event Templates tab
2. Create a new template
3. Check if it appears immediately in the list
4. Delete a template
5. Check if it disappears immediately

**If templates already update immediately:** Skip this task (Next.js may be revalidating automatically).

**If templates show stale data:** Continue to Step 3.2.

### Step 3.2: (Conditional) Add cache invalidation to template operations

- [ ] **Import requestCache**

```typescript
import { requestCache } from '@/lib/requestCache';
```

- [ ] **Find template create/update/delete handlers**

After successful mutations, add:

```typescript
// Invalidate template cache
requestCache.invalidate(/\/api\/session_templates|\/api\/templates/);
```

### Step 3.3: (Conditional) Test and commit

- [ ] **Test template operations**

- [ ] **Commit if changes were needed**

```bash
git add app/tools/scheduler/admin/event-templates/page.tsx
git commit -m "fix: invalidate cache after template mutations

Part of: cache-invalidation-after-delete"
```

---

## Task 4: Documentation and User Guidance

**Files:**
- Create: `docs/cache-invalidation.md`

### Step 4.1: Document cache invalidation pattern

- [ ] **Create documentation file**

```markdown
# Cache Invalidation Pattern

## Overview

The Symphonix Scheduler uses a request cache (`lib/requestCache.ts`) to deduplicate concurrent API calls and cache responses for 2 minutes. This improves performance during navigation but requires explicit invalidation after mutations.

## When to Invalidate

**Always invalidate the cache after:**
- DELETE operations (instructor, venue, template, session, etc.)
- POST/PUT operations (create/update)
- CSV imports
- Bulk operations (clear-all, clear-sessions)

## How to Invalidate

### Full Cache Clear

Use when clearing all data:

\`\`\`typescript
import { requestCache } from '@/lib/requestCache';

// After successful delete-all operation
requestCache.clear();
\`\`\`

### Pattern-Based Invalidation

Use when mutating specific resources:

\`\`\`typescript
// After instructor operations
requestCache.invalidate(/\/api\/instructors/);

// After venue operations
requestCache.invalidate(/\/api\/venues/);

// After template operations
requestCache.invalidate(/\/api\/session_templates|\/api\/templates/);

// After session operations
requestCache.invalidate(/\/api\/sessions/);
\`\`\`

## Examples

### Delete Operation
\`\`\`typescript
async function handleDelete(id: string) {
  const res = await fetch(\`/api/instructors/\${id}\`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');

  // ⚠️ CRITICAL: Invalidate cache
  requestCache.invalidate(/\/api\/instructors/);

  setToast({ message: 'Deleted', type: 'success' });
}
\`\`\`

### CSV Import
\`\`\`typescript
const res = await fetch('/api/venues/import', { method: 'POST', body: formData });
const data = await res.json();

if (data.success) {
  // ⚠️ CRITICAL: Invalidate cache
  requestCache.invalidate(/\/api\/venues/);
  
  setToast({ message: \`Imported \${data.imported} venues\`, type: 'success' });
}
\`\`\`

## Testing Cache Invalidation

1. **Perform mutation** (delete, create, import)
2. **Navigate to another tab** that displays the affected data
3. **Expected:** Data should reflect changes WITHOUT hard refresh
4. **If stale data appears:** Cache invalidation is missing

## Common Mistakes

❌ **Forgetting to import:**
\`\`\`typescript
// Missing import!
requestCache.invalidate(/\/api\/instructors/);
\`\`\`

❌ **Invalidating before operation completes:**
\`\`\`typescript
fetch('/api/delete', { method: 'DELETE' }); // No await!
requestCache.clear(); // Runs before delete finishes
\`\`\`

❌ **Wrong regex pattern:**
\`\`\`typescript
// Too broad — invalidates everything
requestCache.invalidate(/.*/);

// Better — target specific endpoints
requestCache.invalidate(/\/api\/instructors/);
\`\`\`

## Performance Notes

- Cache invalidation is **instant** (no network calls)
- Next fetch after invalidation will trigger a fresh API call
- Cache TTL is 2 minutes — entries auto-expire
- Auto-cleanup runs every 60 seconds to remove expired entries
\`\`\`

### Step 4.2: Commit documentation

- [ ] **Commit**

```bash
git add docs/cache-invalidation.md
git commit -m "docs: add cache invalidation pattern guide

- When and how to invalidate requestCache
- Examples for DELETE, POST, CSV import
- Testing checklist
- Common mistakes section

Part of: cache-invalidation-after-delete"
```

---

## Task 5: Comprehensive Testing

### Step 5.1: Test full workflow (Delete All Data)

- [ ] **End-to-end test**

**Setup:**
1. Fresh database with test data (instructors, venues, templates, sessions)
2. Open Symphonix admin in browser

**Test:**
1. Navigate to Settings
2. Click "Delete All Data"
3. Confirm deletion
4. **Without hard refresh**, navigate to:
   - People tab → **Expected:** Empty instructor/venue lists
   - Event Templates tab → **Expected:** Empty template list
   - Calendar tab → **Expected:** Empty calendar grid
5. Navigate back to Settings
6. **Expected:** No stale data in any dropdowns/lists

### Step 5.2: Test individual operations

- [ ] **Delete instructor**
  - Delete instructor → navigate to Calendar → check dropdown → should not appear

- [ ] **Delete venue**
  - Delete venue → navigate to Calendar → check venue filter → should not appear

- [ ] **CSV import instructors**
  - Import CSV → check People tab → new instructors appear immediately

- [ ] **CSV import venues**
  - Import CSV → check People tab → new venues appear immediately

### Step 5.3: Test cross-tab consistency

- [ ] **Multi-tab test**

1. Open Symphonix in **two browser tabs**
2. In Tab 1: Delete an instructor
3. In Tab 2: Navigate to Calendar page
4. **Expected:** Deleted instructor should disappear in Tab 2 after navigation (next API call fetches fresh data)

**Note:** Real-time sync between tabs is NOT expected — cache invalidation only affects the tab where the mutation occurred. Other tabs will see fresh data on their next API call (when cache entry expires or they navigate).

### Step 5.4: Verify no broken functionality

- [ ] **Regression test**

Ensure no existing features broke:
- Instructor editing still works
- Venue editing still works
- Template editing still works
- Calendar navigation still works
- Session creation still works

### Step 5.5: Test error handling

- [ ] **Network failure test**

1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Try deleting an instructor
4. **Expected:** Error toast appears
5. **Expected:** Cache is NOT invalidated (delete failed)
6. Disable offline mode
7. **Expected:** Instructor still visible (not deleted)

### Step 5.6: Document test results

- [ ] **Create test report**

```markdown
# Cache Invalidation Test Report

**Date:** [Current Date]
**Tester:** [Your Name]

## Test Results

### Delete All Data
- ✅ Instructors cleared immediately
- ✅ Venues cleared immediately
- ✅ Templates cleared immediately
- ✅ Sessions cleared immediately
- ✅ No hard refresh required

### Individual Operations
- ✅ Delete instructor → immediate UI update
- ✅ Delete venue → immediate UI update
- ✅ CSV import instructors → immediate appearance
- ✅ CSV import venues → immediate appearance

### Cross-Tab Consistency
- ⚠️ Expected behavior: Other tabs update on next navigation
- ✅ Verified: Tab 1 changes reflect in Tab 2 after navigation

### Error Handling
- ✅ Network failure → cache NOT invalidated
- ✅ Data remains visible after failed delete

## Issues Found
[None]

## Recommendation
✅ Ready for production
\`\`\`

### Step 5.7: Commit test results

- [ ] **Commit**

```bash
git add docs/test-reports/cache-invalidation-test.md
git commit -m "test: verify cache invalidation across all mutation paths

- Delete All Data clears cache successfully
- Individual operations invalidate correctly
- Error handling preserves cache integrity
- No regressions detected

Part of: cache-invalidation-after-delete"
```

---

## Task 6: Final Verification and Deployment Prep

### Step 6.1: Code review checklist

- [ ] **Self-review**

Check:
- ✅ All `requestCache.invalidate()` calls use correct regex patterns
- ✅ All mutations (DELETE/POST/PUT) have cache invalidation
- ✅ Cache invalidation happens AFTER successful response
- ✅ No cache invalidation on error paths
- ✅ Import statements added to all modified files

### Step 6.2: Update MEMORY.md

- [ ] **Document in project memory**

Add to `MEMORY.md`:

```markdown
## Cache Invalidation Fix (2026-03-29)
- **Issue:** Delete All Data left stale data visible until hard refresh
- **Root cause:** `requestCache` 2-minute TTL not invalidated after mutations
- **Fix:** Added `requestCache.clear()` after clear-all, `requestCache.invalidate()` after individual operations
- **Files changed:**
  - `app/tools/scheduler/admin/settings/page.tsx` — clear-all/clear-sessions
  - `app/tools/scheduler/admin/people/page.tsx` — instructor/venue mutations
- **Testing:** End-to-end verified, no hard refresh required
- **Docs:** `docs/cache-invalidation.md` — pattern guide for future mutations
```

### Step 6.3: Create pull request (if using Git workflow)

- [ ] **Create PR**

**Title:** `fix: invalidate cache after mutations to prevent stale UI`

**Description:**
```markdown
## Problem
Users saw stale data (instructors, venues, sessions) after clicking "Delete All Data" until they manually hard-refreshed the browser.

## Root Cause
The `requestCache` singleton caches API responses for 2 minutes to improve performance. Mutation operations (DELETE/POST/PUT) weren't invalidating the cache, leaving stale entries.

## Solution
- Added `requestCache.clear()` after "Delete All Data" and "Clear Sessions"
- Added `requestCache.invalidate(pattern)` after:
  - Instructor create/update/delete/import
  - Venue create/update/delete/import
- Ensures UI reflects changes immediately without hard refresh

## Testing
- ✅ Delete All Data → immediate UI update
- ✅ Individual instructor/venue operations → immediate update
- ✅ CSV imports → immediate appearance
- ✅ Error handling preserves cache integrity

## Documentation
- Created `docs/cache-invalidation.md` with pattern guide
- Updated `MEMORY.md` with fix summary

## Closes
Fixes stale data issue reported in #ui-rework (2026-03-29)
\`\`\`

### Step 6.4: Verify deployment checklist

- [ ] **Pre-deployment verification**

- ✅ All tests pass
- ✅ No console errors in browser DevTools
- ✅ No TypeScript errors (`npm run build`)
- ✅ Git history is clean (meaningful commit messages)
- ✅ Documentation is complete
- ✅ MEMORY.md updated

### Step 6.5: Deploy to staging/production

- [ ] **Deploy**

```bash
# If using Vercel
git push origin main
# Wait for Vercel deployment
# Test on preview URL before promoting to production
```

### Step 6.6: Post-deployment verification

- [ ] **Smoke test on production**

1. Open production URL
2. Navigate to Settings
3. Click "Delete All Data"
4. **Expected:** UI updates immediately, no hard refresh needed
5. Test instructor/venue operations
6. **Expected:** All mutations reflect immediately

### Step 6.7: Mark issue resolved

- [ ] **Close Discord thread / GitHub issue**

Message:
```
✅ Fixed stale data bug after "Delete All Data"

**Changes:**
- Added cache invalidation after all mutation operations
- Tested end-to-end — no hard refresh needed
- Documented pattern in `docs/cache-invalidation.md`

**Deployed:** [Production URL]

Thanks for the clear bug report! Let me know if you see any other cache issues.
\`\`\`

---

## Summary

**What This Plan Fixes:**
- ❌ Before: Delete All Data left stale instructors/venues visible
- ✅ After: Delete All Data immediately clears UI (no hard refresh)
- ✅ All mutations (create/update/delete/import) invalidate cache correctly
- ✅ Pattern documented for future development

**Files Modified:**
1. `app/tools/scheduler/admin/settings/page.tsx` — clear-all/clear-sessions
2. `app/tools/scheduler/admin/people/page.tsx` — instructor/venue operations
3. `docs/cache-invalidation.md` — new pattern guide

**Testing Strategy:**
- End-to-end workflow (Delete All Data)
- Individual operations (delete, import, save)
- Cross-tab consistency verification
- Error handling verification

**Estimated Time:** 2-3 hours (including testing)

**Risk Level:** Low (using existing `requestCache` API, no new dependencies)

---

**Ready to execute?** Choose:
1. **Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks
2. **Inline Execution** — Execute in this session with checkpoints
