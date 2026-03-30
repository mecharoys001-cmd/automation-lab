# School Calendar CSV Date Range Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date range inputs (program start/end dates) to School Calendar CSV import dialog to automatically filter imported dates to only those within the program period.

**Current Behavior:** CSV import accepts all dates in the file regardless of program date range.

**New Behavior:** Before import preview, show two date inputs (First Day, Last Day) pre-filled with program start/end dates. Only show/import rows with dates between these bounds (inclusive).

**Architecture:** 
- Add date range state to `CsvImportDialog` component
- Pass program start/end dates as props from calendar page
- Filter parsed CSV rows before validation and preview
- Update validation logic to check date bounds
- Preserve existing CSV structure (no new columns)

**Tech Stack:** 
- React (useState for date range state)
- Existing `CsvImportDialog` component
- Program context (already provides program dates)
- Date validation utilities

---

## File Structure

**Modified Files:**
- `app/tools/scheduler/components/ui/CsvImportDialog.tsx` — Add date range inputs and filtering logic
- `app/tools/scheduler/admin/calendar/page.tsx` — Pass program dates to CsvImportDialog
- No new files required

**No database changes** — filtering happens in UI layer before import.

---

## Task 1: Add Date Range Props to CsvImportDialog

**Files:**
- Modify: `app/tools/scheduler/components/ui/CsvImportDialog.tsx:37-56` (interface)
- Modify: `app/tools/scheduler/components/ui/CsvImportDialog.tsx:58-77` (component signature)

### Step 1.1: Add date range props to interface

- [ ] **Extend CsvImportDialogProps interface**

Find the interface (around line 37):
```typescript
export interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: CsvColumnDef[];
  validateRow: (row: CsvRow, rowIndex: number) => ValidationError[];
  onImport: (rows: CsvRow[]) => Promise<{ imported: number; skipped: number }>;
  exampleCsv?: string;
  templateFilename?: string;
  helpContent?: React.ReactNode;
}
```

**Add after `helpContent`:**
```typescript
export interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: CsvColumnDef[];
  validateRow: (row: CsvRow, rowIndex: number) => ValidationError[];
  onImport: (rows: CsvRow[]) => Promise<{ imported: number; skipped: number }>;
  exampleCsv?: string;
  templateFilename?: string;
  helpContent?: React.ReactNode;
  /** Optional date range filter: program start date (YYYY-MM-DD) */
  dateRangeStart?: string;
  /** Optional date range filter: program end date (YYYY-MM-DD) */
  dateRangeEnd?: string;
  /** Optional: column name containing the date to filter (default: 'date') */
  dateColumnName?: string;
}
```

### Step 1.2: Add props to component signature and state

- [ ] **Update component destructuring**

Find the component definition (around line 58):
```typescript
export function CsvImportDialog({
  open,
  onClose,
  title,
  columns,
  validateRow,
  onImport,
  exampleCsv,
  templateFilename = 'template.csv',
  helpContent,
}: CsvImportDialogProps) {
```

**Replace with:**
```typescript
export function CsvImportDialog({
  open,
  onClose,
  title,
  columns,
  validateRow,
  onImport,
  exampleCsv,
  templateFilename = 'template.csv',
  helpContent,
  dateRangeStart,
  dateRangeEnd,
  dateColumnName = 'date',
}: CsvImportDialogProps) {
```

### Step 1.3: Add date range state

- [ ] **Add state for user-editable date range**

After the existing state declarations (around line 68-77), add:
```typescript
  const [filterStartDate, setFilterStartDate] = useState<string>(dateRangeStart || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(dateRangeEnd || '');
```

### Step 1.4: Reset date filter state when dialog opens

- [ ] **Update reset function**

Find the `reset` callback (around line 71):
```typescript
  const reset = useCallback(() => {
    setRows([]);
    setHeaders([]);
    setErrors([]);
    setImporting(false);
    setResult(null);
    setParseError(null);
    setDragOver(false);
  }, []);
```

**Replace with:**
```typescript
  const reset = useCallback(() => {
    setRows([]);
    setHeaders([]);
    setErrors([]);
    setImporting(false);
    setResult(null);
    setParseError(null);
    setDragOver(false);
    setFilterStartDate(dateRangeStart || '');
    setFilterEndDate(dateRangeEnd || '');
  }, [dateRangeStart, dateRangeEnd]);
```

### Step 1.5: Commit changes

- [ ] **Commit**

```bash
git add app/tools/scheduler/components/ui/CsvImportDialog.tsx
git commit -m "feat(calendar-csv): add date range filter props to CsvImportDialog

- Add dateRangeStart, dateRangeEnd, dateColumnName props
- Add internal state for user-editable date range
- Update reset callback to restore default date range

Part of: school-calendar-date-range-filter"
```

---

## Task 2: Add Date Range Input UI

**Files:**
- Modify: `app/tools/scheduler/components/ui/CsvImportDialog.tsx` (render section)

### Step 2.1: Add date range input section to dialog

- [ ] **Insert date range UI after file upload section**

Find the upload section (look for "Drop your CSV file here" around line 200-250). After the upload area and before the preview section, add:

```typescript
      {/* Date Range Filter (shown after file upload, before preview) */}
      {rows.length > 0 && (dateRangeStart || dateRangeEnd) && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm font-medium text-slate-700">
              Filter by Date Range
            </label>
            <Tooltip content="Only show calendar entries between these dates (inclusive). Pre-filled with program start/end dates." position="top">
              <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor="filter-start-date" className="block text-xs font-medium text-slate-600 mb-1">
                First Day (Start)
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="filter-end-date" className="block text-xs font-medium text-slate-600 mb-1">
                Last Day (End)
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {filterStartDate && filterEndDate 
              ? `Showing entries from ${filterStartDate} to ${filterEndDate} (${filteredRows.length} of ${rows.length} rows)`
              : 'Set date range to filter entries'}
          </p>
        </div>
      )}
```

**Important:** This section should appear AFTER the file upload area but BEFORE the preview table. Look for the section that starts rendering the preview (around `{rows.length > 0 && ...`).

### Step 2.2: Commit UI changes

- [ ] **Commit**

```bash
git add app/tools/scheduler/components/ui/CsvImportDialog.tsx
git commit -m "feat(calendar-csv): add date range input UI to import dialog

- Two date inputs (First Day, Last Day) with labels
- Tooltip explaining filter purpose
- Counter showing X of Y rows after filtering
- Only visible when dateRangeStart/End props provided

Part of: school-calendar-date-range-filter"
```

---

## Task 3: Implement Date Filtering Logic

**Files:**
- Modify: `app/tools/scheduler/components/ui/CsvImportDialog.tsx` (filtering logic)

### Step 3.1: Add date filtering helper function

- [ ] **Create filter logic before component render**

After the `processFile` callback (around line 110-140), add this helper:

```typescript
  // Filter rows by date range (if date range is set)
  const filteredRows = useMemo(() => {
    if (!filterStartDate || !filterEndDate || rows.length === 0) {
      return rows;
    }

    const startMs = new Date(filterStartDate).getTime();
    const endMs = new Date(filterEndDate).getTime();

    return rows.filter((row) => {
      const dateValue = row[dateColumnName]?.trim();
      if (!dateValue) return false; // Exclude rows without date

      const dateMs = new Date(dateValue).getTime();
      // Include if date is between start and end (inclusive)
      return dateMs >= startMs && dateMs <= endMs;
    });
  }, [rows, filterStartDate, filterEndDate, dateColumnName]);
```

### Step 3.2: Update validation to use filtered rows

- [ ] **Replace validation logic to filter before validating**

Find where validation runs (look for `validateRow` calls, likely around line 100-130 in `processFile`). The validation currently runs on `parsed.rows`. We need to:

1. Store ALL parsed rows in state
2. Filter them based on date range
3. Validate only the filtered rows

Find this block:
```typescript
      const parsed = parseCSV(strippedText);
      if (parsed.rows.length === 0) {
        setParseError('No data rows found in file');
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);

      // Validate all rows
      const allErrors: ValidationError[] = [];
      parsed.rows.forEach((row, idx) => {
        const rowErrors = validateRow(row, idx);
        allErrors.push(...rowErrors);
      });
      setErrors(allErrors);
```

**Replace the validation section with:**
```typescript
      const parsed = parseCSV(strippedText);
      if (parsed.rows.length === 0) {
        setParseError('No data rows found in file');
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows); // Store ALL rows (filtering happens in useMemo)
```

### Step 3.3: Add separate validation effect for filtered rows

- [ ] **Add useEffect to validate filtered rows**

After the `useMemo` for `filteredRows`, add:

```typescript
  // Validate filtered rows whenever filtering changes
  useEffect(() => {
    if (filteredRows.length === 0) {
      setErrors([]);
      return;
    }

    const allErrors: ValidationError[] = [];
    filteredRows.forEach((row, idx) => {
      const rowErrors = validateRow(row, idx);
      allErrors.push(...rowErrors);
    });
    setErrors(allErrors);
  }, [filteredRows, validateRow]);
```

### Step 3.4: Update preview and import to use filteredRows

- [ ] **Find all references to `rows` in render and replace with `filteredRows`**

Search for these patterns in the component JSX (around line 200-400):

1. Preview table rendering: `{rows.length > 0 && ...` → `{filteredRows.length > 0 && ...`
2. Row count displays: `${rows.length} rows` → `${filteredRows.length} rows`
3. Import button handler: Pass `filteredRows` to `onImport` instead of `rows`

**Specifically find:**
```typescript
  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(rows); // ← Change to filteredRows
```

**Change to:**
```typescript
  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(filteredRows); // ← Use filtered rows
```

### Step 3.5: Commit filtering logic

- [ ] **Commit**

```bash
git add app/tools/scheduler/components/ui/CsvImportDialog.tsx
git commit -m "feat(calendar-csv): implement date range filtering logic

- Add useMemo to filter rows by date range
- Validate only filtered rows (useEffect)
- Pass filteredRows to onImport instead of all rows
- Update preview/counts to show filtered results

Part of: school-calendar-date-range-filter"
```

---

## Task 4: Wire Up Program Dates in Calendar Page

**Files:**
- Modify: `app/tools/scheduler/admin/calendar/page.tsx`

### Step 4.1: Access program dates from context

- [ ] **Add selectedProgram to useProgram destructuring**

Find the `useProgram` hook (around line 404):
```typescript
  const { selectedProgramId } = useProgram();
```

**Replace with:**
```typescript
  const { selectedProgramId, selectedProgram } = useProgram();
```

### Step 4.2: Pass date range props to CsvImportDialog

- [ ] **Find CsvImportDialog component**

Look for `<CsvImportDialog` (around line 1793). Current props:
```typescript
      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import School Calendar from CSV"
        columns={CALENDAR_CSV_COLUMNS}
        validateRow={validateCalendarCsvRow}
        onImport={async (csvRows: CsvRow[]) => {
          // ... import logic
        }}
        exampleCsv={CALENDAR_CSV_EXAMPLE}
        templateFilename="school-calendar.csv"
      />
```

**Add date range props:**
```typescript
      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import School Calendar from CSV"
        columns={CALENDAR_CSV_COLUMNS}
        validateRow={validateCalendarCsvRow}
        onImport={async (csvRows: CsvRow[]) => {
          // ... import logic
        }}
        exampleCsv={CALENDAR_CSV_EXAMPLE}
        templateFilename="school-calendar.csv"
        dateRangeStart={selectedProgram?.start_date}
        dateRangeEnd={selectedProgram?.end_date}
        dateColumnName="date"
      />
```

### Step 4.3: Commit calendar page wiring

- [ ] **Commit**

```bash
git add app/tools/scheduler/admin/calendar/page.tsx
git commit -m "feat(calendar-csv): wire program dates to import dialog

- Access selectedProgram from ProgramContext
- Pass start_date/end_date as dateRangeStart/End props
- Specify 'date' as dateColumnName (explicit)

Part of: school-calendar-date-range-filter"
```

---

## Task 5: Manual Testing

**Files:**
- No file changes

### Step 5.1: Test basic date filtering

- [ ] **Test: Upload CSV with dates spanning multiple years**

Create test CSV:
```csv
date,description,status_type
2025-01-15,Old Entry,no_school
2026-09-01,In Range Start,no_school
2026-10-15,In Range Middle,early_dismissal
2027-12-31,Future Entry,no_school
```

**Program dates:** 2026-09-01 to 2027-06-30

Steps:
1. Navigate to Calendar tab
2. Click "Import CSV"
3. Upload test CSV
4. **Expected:** Date range inputs show 2026-09-01 to 2027-06-30
5. **Expected:** Preview shows only 3 rows (2025 entry excluded)
6. **Expected:** Counter says "3 of 4 rows"

### Step 5.2: Test manual date range adjustment

- [ ] **Test: Change date range before import**

Continuing from 5.1:
1. Change "Last Day" to 2026-10-01
2. **Expected:** Preview updates immediately to show 2 rows (2026-09-01, 2026-10-15 excluded)
3. **Expected:** Counter updates to "2 of 4 rows"
4. Click Import
5. **Expected:** Only 2 entries imported
6. Check calendar view
7. **Expected:** Only 2 entries visible (no 2025 or 2027-12-31 entries)

### Step 5.3: Test with no date range

- [ ] **Test: Import without program dates (fallback)**

1. Manually test on a program with NULL start/end dates (if exists)
2. Or temporarily comment out `dateRangeStart`/`dateRangeEnd` props
3. Upload CSV
4. **Expected:** No date range inputs shown
5. **Expected:** All rows visible in preview (no filtering)
6. **Expected:** All valid rows imported

### Step 5.4: Test edge cases

- [ ] **Test: Rows without date column**

CSV:
```csv
description,status_type
Missing Date,no_school
```

**Expected:** Row excluded from preview (no date = filtered out)

- [ ] **Test: Invalid date formats**

CSV:
```csv
date,description,status_type
2026-13-45,Invalid,no_school
2026-09-01,Valid,no_school
```

**Expected:** Invalid date excluded from preview, validation error NOT shown (already filtered)

- [ ] **Test: Boundary dates (inclusive)**

**Program dates:** 2026-09-01 to 2027-06-30

CSV:
```csv
date,description,status_type
2026-08-31,Before Start,no_school
2026-09-01,Exact Start,no_school
2027-06-30,Exact End,no_school
2027-07-01,After End,no_school
```

**Expected:** Preview shows 2 rows (09-01 and 06-30), excludes 08-31 and 07-01

### Step 5.5: Document test results

- [ ] **Create test report**

```markdown
# School Calendar Date Range Filter — Test Report

**Date:** [Current Date]
**Tester:** [Name]

## Test Results

### Basic Filtering
- ✅ Date range inputs pre-filled with program dates
- ✅ Rows outside range excluded from preview
- ✅ Counter shows "X of Y rows" correctly

### Manual Adjustment
- ✅ Changing date range updates preview immediately
- ✅ Import respects adjusted date range
- ✅ Only filtered entries appear in calendar

### Fallback (No Date Range)
- ✅ No date inputs shown when program has no dates
- ✅ All rows visible (no filtering)

### Edge Cases
- ✅ Rows without date column excluded
- ✅ Invalid date formats excluded
- ✅ Boundary dates (start/end) included (inclusive filter)

## Issues Found
[None]

## Recommendation
✅ Ready for production
```

---

## Task 6: Update Documentation

**Files:**
- Create: `docs/school-calendar-csv-date-filter.md`

### Step 6.1: Create user documentation

- [ ] **Document the new feature**

```markdown
# School Calendar CSV Date Range Filter

## Overview

When importing School Calendar entries via CSV, the import dialog now includes date range inputs to filter imported entries to only those within the program's active period.

## How It Works

1. **Pre-filled Dates:** When you open the CSV import dialog, the "First Day" and "Last Day" inputs are automatically populated with your program's start and end dates.

2. **Automatic Filtering:** As soon as you upload a CSV file, only rows with dates between the specified range (inclusive) are shown in the preview.

3. **Adjustable Range:** You can manually adjust the date range before importing if you want to restrict the import to a subset of the program period.

4. **Import Only Visible Rows:** Only the filtered rows visible in the preview will be imported when you click "Import."

## Example

**Program Dates:** September 1, 2026 – June 30, 2027

**CSV File:**
\`\`\`csv
date,description,status_type
2025-12-25,Old Holiday,no_school
2026-09-01,Labor Day,no_school
2026-11-26,Thanksgiving,no_school
2027-08-15,Future Event,no_school
\`\`\`

**Result:** Only 2 rows imported (Labor Day, Thanksgiving). Old Holiday and Future Event excluded.

## Benefits

- **Prevents accidental imports** of old or future calendar entries
- **Reduces clutter** in the calendar view
- **Saves time** — no need to manually remove out-of-range entries after import
- **Flexible** — adjust the range if you need to import historical or future data

## FAQ

### Can I disable the filter?

Clear both date inputs to disable filtering and see all rows.

### Are boundary dates included?

Yes, the filter is inclusive. Dates matching the start or end date are included.

### What happens to rows without a date?

Rows without a valid date in the "date" column are excluded from the preview and import.

### Can I change the date range after uploading the CSV?

Yes! Adjust the date inputs and the preview updates immediately. Import respects the current date range.
\`\`\`

### Step 6.2: Commit documentation

- [ ] **Commit**

```bash
git add docs/school-calendar-csv-date-filter.md
git commit -m "docs: add School Calendar CSV date filter guide

- Explains pre-filled date range inputs
- Documents automatic filtering behavior
- Provides examples and FAQ

Part of: school-calendar-date-range-filter"
```

---

## Task 7: Update MEMORY.md

**Files:**
- Modify: `MEMORY.md`

### Step 7.1: Add feature summary to MEMORY.md

- [ ] **Document feature in project memory**

Add after the existing feature sections:

```markdown
## School Calendar CSV Date Range Filter (2026-03-30)

**Feature:** Import dialog now filters calendar entries by program date range.

**Implementation:**
- `CsvImportDialog.tsx`: Added `dateRangeStart`/`dateRangeEnd` props + date inputs UI
- `calendar/page.tsx`: Passes `selectedProgram.start_date` / `end_date` to dialog
- Filtering: `useMemo` filters rows by date before validation/preview
- UI: Two date inputs (First Day, Last Day) shown after file upload

**User Impact:**
- Prevents importing old/future calendar entries outside program period
- Date range pre-filled with program dates, adjustable before import
- Counter shows "X of Y rows" after filtering

**Testing:** Manual tests confirmed:
- Filtering works with various date ranges
- Boundary dates included (inclusive filter)
- Fallback works (no date range = show all rows)

**Docs:** `docs/school-calendar-csv-date-filter.md`
\`\`\`

### Step 7.2: Commit MEMORY.md update

- [ ] **Commit**

```bash
git add MEMORY.md
git commit -m "docs: document School Calendar CSV date filter in MEMORY.md

Part of: school-calendar-date-range-filter"
```

---

## Task 8: Final Verification and Deployment

**Files:**
- No file changes

### Step 8.1: TypeScript compilation check

- [ ] **Verify no TypeScript errors**

```bash
cd /home/ethan/.openclaw/workspace/automation-lab
npm run build
```

**Expected:** Build succeeds with no errors

### Step 8.2: Review commit history

- [ ] **Check commits are clean and atomic**

```bash
git log --oneline -7
```

**Expected:** 7 commits (one per task), all with proper messages

### Step 8.3: Deploy to production

- [ ] **Push to master**

```bash
git push origin master
```

Wait for Vercel deployment to complete.

### Step 8.4: Test on production

- [ ] **Smoke test on live site**

1. Navigate to production URL: https://tools.artsnwct.org/tools/scheduler/admin
2. Go to Calendar tab
3. Click "Import CSV"
4. **Expected:** Date range inputs visible and pre-filled
5. Upload test CSV
6. **Expected:** Filtering works as designed
7. Adjust date range
8. **Expected:** Preview updates immediately
9. Import
10. **Expected:** Only filtered entries saved

### Step 8.5: Close issue/thread

- [ ] **Mark complete**

Post in Discord #ui-rework:
```
✅ School Calendar CSV date range filter shipped

**Changes:**
- Import dialog now shows First Day / Last Day inputs
- Pre-filled with program start/end dates
- Automatically filters CSV rows to program date range
- Counter shows "X of Y rows" after filtering
- Fully tested and deployed to production

**Docs:** `docs/school-calendar-csv-date-filter.md`

Test it live: https://tools.artsnwct.org/tools/scheduler/admin → Calendar → Import CSV
\`\`\`

---

## Summary

**What This Plan Builds:**

✅ **Date Range Inputs:** Two date fields (First Day, Last Day) in School Calendar CSV import dialog

✅ **Auto-Filtering:** CSV rows outside date range automatically excluded from preview/import

✅ **Pre-filled Dates:** Program start/end dates populate inputs by default

✅ **User Control:** Dates adjustable before import (narrower or wider range)

✅ **Visual Feedback:** Counter shows "X of Y rows" after filtering

**Files Modified:** 2
1. `app/tools/scheduler/components/ui/CsvImportDialog.tsx` — Date range UI and filtering logic
2. `app/tools/scheduler/admin/calendar/page.tsx` — Wire program dates to dialog

**Files Created:** 1
- `docs/school-calendar-csv-date-filter.md` — User documentation

**Testing Strategy:**
- Manual testing with various date ranges and edge cases
- Boundary condition verification (inclusive filtering)
- Fallback testing (no program dates)

**Estimated Time:** 2-3 hours (including testing)

**Risk Level:** Low (additive feature, no database changes, existing CSV infrastructure)

---

**Ready to execute?** Choose:
1. **Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks
2. **Inline Execution** — Execute in this session with checkpoints
