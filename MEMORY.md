
## School Calendar CSV Date Range Filter (2026-03-30)

**Feature:** Import dialog now filters calendar entries by program date range.

**Implementation:**
- `CsvImportDialog.tsx`: Added `dateRangeStart`/`dateRangeEnd` props + date inputs UI (commits `d37b5c9`, `599e3e7`)
- Filtering: `useMemo` filters rows by date before validation/preview (commit `cbfaac1`)
- `calendar/page.tsx`: Passes `selectedProgram.start_date` / `end_date` to dialog (commit pending)
- UI: Two date inputs (First Day, Last Day) shown after file upload

**User Impact:**
- Prevents importing old/future calendar entries outside program period
- Date range pre-filled with program dates, adjustable before import
- Counter shows "X of Y rows" after filtering

**Testing:** Manual tests pending after deploy

**Docs:** `docs/school-calendar-csv-date-filter.md`

---

## Cache Invalidation Fix (2026-03-29)

**Issue:** "Delete All Data" left stale instructor/venue/template data visible until hard refresh.

**Root Cause:** `requestCache` singleton caches API responses for 2 minutes. Mutation operations weren't invalidating the cache.

**Solution Implemented:**
- **Settings page:** Added `requestCache.clear()` after delete-all/clear-sessions (commit `9dbd678`)
- **People page:** Already had 7+ cache invalidations for instructor/venue operations (commit `856aed6`, March 26)
- **Templates page:** Already had cache invalidation in 4 locations
- **Documentation:** Created `docs/cache-invalidation.md` pattern guide (commit `43a744f`)

**Result:** UI now updates immediately after mutations without requiring hard refresh.

**Testing Required:** Manual verification that delete-all, CSV imports, and individual operations don't show stale data.

**Pattern for future:** Always call `requestCache.invalidate(/pattern/)` after successful mutation operations.

---

## Bug Fixing Workflow (2026-03-27)

**Learned:** There's a validation agent that verifies fixes and unchecks bugs that aren't actually resolved.

**Correct workflow:**
1. Implement actual fix (code changes)
2. Deploy to production
3. Mark as "ROY Fix" 
4. Validation agent tests it
5. If not fixed → agent unchecks and provides feedback

**Do NOT:**
- Mark bugs as "already fixed" without verification
- Assume code exists means it works
- Mark architectural bugs without implementing the solution
- Prioritize checklist completion over actual problem-solving

**Current queue:** 22 bugs need real fixes (validation agent unchecked them)
**Automated system:** Cron running every 30min, uses Claude Code for fixes
