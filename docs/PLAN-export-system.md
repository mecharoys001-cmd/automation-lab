# Plan: Enhanced Export System

## Goal
Expand the Export dropdown to support CSV and PDF exports of the current calendar view, always respecting active filters. Warn the user when filters are active.

---

## Current State (DO NOT BREAK)

### Existing code in `app/tools/scheduler/admin/page.tsx`:
- **State:** `currentView` (type `CalendarView` = 'day' | 'week' | 'month' | 'year'), line 399
- **State:** `selectedDate` (type `Date`), line 400
- **State:** `activeFilters` (type `ActiveFilters` = `Record<string, string[]>`), line 401
- **State:** `showExportMenu` (boolean), line 424
- **State:** `events` (type `CalendarEvent[]`) — all events for current date range
- **Computed:** `filteredEvents` (line 499) — events filtered by `activeFilters`
- **Existing functions:** `handleExportWeekly`, `handleExportMonthly`, `handleExportYearly` (lines 1145-1176)
- **Existing helper:** `exportEventsCsv(events, filenameTag)` (line 366) — generates CSV and triggers download
- **Existing helper:** `eventToCsvRow(event)` (line 348) — converts CalendarEvent to CSV row
- **CSV_COLUMNS** (line 334): Date, Day of Week, Start Time, End Time, Duration (min), Event Name, Event Type, Staff, Venue, Grade Group, Status, Notes
- **Export dropdown UI:** lines 1295-1345 — has 3 buttons (Weekly, Monthly, Yearly CSV)
- **Program info:** `selectedProgram` from `useProgram()` context

### CalendarEvent type (from `components/calendar/types.ts`):
Has fields: id, title, date, time, endTime, instructor, instructorId, venue, venueId, subjects, gradeGroups, status, type, tags, durationMinutes, sessionName, subtitle

---

## Changes Required

### Step 1: Add `getCurrentViewDateRange()` helper function

Add BEFORE the component function (near line 330, with the other helpers):

```typescript
/** Returns start/end date strings (YYYY-MM-DD) for the current calendar view */
function getCurrentViewDateRange(
  view: CalendarView,
  anchor: Date,
  program?: { start_date?: string; end_date?: string } | null
): { start: string; end: string; label: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (view) {
    case 'day':
      return { start: fmt(anchor), end: fmt(anchor), label: 'Day' };
    case 'week': {
      const mon = new Date(anchor);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // Monday
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      return { start: fmt(mon), end: fmt(sun), label: 'Week' };
    }
    case 'month': {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start: fmt(first), end: fmt(last), label: 'Month' };
    }
    case 'year':
      return {
        start: program?.start_date ?? fmt(new Date(anchor.getFullYear(), 0, 1)),
        end: program?.end_date ?? fmt(new Date(anchor.getFullYear(), 11, 31)),
        label: 'Year',
      };
  }
}
```

### Step 2: Add `activeFilterSummary` computed value

Add inside the component, near other useMemo blocks:

```typescript
const activeFilterSummary = useMemo(() => {
  const parts: string[] = [];
  for (const [key, values] of Object.entries(activeFilters)) {
    if (values && values.length > 0) {
      // Capitalize the filter key name
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      parts.push(`${label} (${values.length})`);
    }
  }
  return parts;
}, [activeFilters]);

const hasActiveFilters = activeFilterSummary.length > 0;
```

### Step 3: Add new export handler functions

Replace the 3 existing export handlers (`handleExportWeekly`, `handleExportMonthly`, `handleExportYearly`) with:

```typescript
// Get events for the current view's date range
const getViewEvents = useCallback((scope: 'current' | 'full') => {
  if (scope === 'full') return filteredEvents;
  const range = getCurrentViewDateRange(currentView, selectedDate, selectedProgram);
  return filteredEvents.filter(e => e.date && e.date >= range.start && e.date <= range.end);
}, [filteredEvents, currentView, selectedDate, selectedProgram]);

const handleExportCsv = useCallback((scope: 'current' | 'full') => {
  const evts = getViewEvents(scope);
  const range = getCurrentViewDateRange(currentView, selectedDate, selectedProgram);
  const tag = scope === 'full' ? 'full-year' : range.label.toLowerCase();
  const count = exportEventsCsv(evts, tag);
  showToast(`Exported ${count} event${count !== 1 ? 's' : ''} as CSV`);
  setShowExportMenu(false);
}, [getViewEvents, currentView, selectedDate, selectedProgram]);

const handleExportPdf = useCallback((scope: 'current' | 'full') => {
  const evts = getViewEvents(scope);
  const range = getCurrentViewDateRange(currentView, selectedDate, selectedProgram);
  const title = selectedProgram?.name ?? 'Schedule';
  const subtitle = scope === 'full'
    ? 'Full Program Year'
    : `${range.label} View: ${range.start} to ${range.end}`;
  const filterNote = hasActiveFilters
    ? `Filtered by: ${activeFilterSummary.join(', ')}`
    : undefined;

  openPrintView(evts, title, subtitle, filterNote);
  setShowExportMenu(false);
}, [getViewEvents, currentView, selectedDate, selectedProgram, hasActiveFilters, activeFilterSummary]);
```

### Step 4: Create `openPrintView()` function

Add as a standalone function (outside the component, or inside — either works):

```typescript
function openPrintView(
  events: CalendarEvent[],
  title: string,
  subtitle: string,
  filterNote?: string
) {
  // Sort events by date, then time
  const sorted = [...events].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')
  );

  // Group by date
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const evt of sorted) {
    const d = evt.date ?? 'Unknown';
    (grouped[d] ??= []).push(evt);
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Build HTML
  let html = `<!DOCTYPE html><html><head><title>${title} — Export</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { font-size: 13px; color: #64748b; margin-bottom: 4px; }
  .filter-note { font-size: 12px; color: #b45309; background: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; display: inline-block; }
  .date-header { font-size: 14px; font-weight: 600; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
  th { text-align: left; padding: 4px 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }
  td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .generated { font-size: 10px; color: #94a3b8; margin-top: 24px; }
  @media print { body { margin: 12px; } }
</style></head><body>`;

  html += `<h1>${title}</h1>`;
  html += `<div class="subtitle">${subtitle}</div>`;
  if (filterNote) html += `<div class="filter-note">⚠ ${filterNote}</div>`;

  html += `<div style="font-size:12px;color:#64748b;margin-bottom:12px;">${sorted.length} event${sorted.length !== 1 ? 's' : ''}</div>`;

  for (const [date, dateEvents] of Object.entries(grouped)) {
    const dayName = date !== 'Unknown' ? DAY_NAMES[new Date(date + 'T00:00:00').getDay()] : '';
    html += `<div class="date-header">${dayName}, ${date}</div>`;
    html += `<table><thead><tr>
      <th>Time</th><th>Event</th><th>Event Type</th><th>Staff</th><th>Venue</th><th>Grade</th><th>Status</th>
    </tr></thead><tbody>`;

    for (const evt of dateEvents) {
      html += `<tr>
        <td>${evt.time ?? ''}–${evt.endTime ?? ''}</td>
        <td>${evt.sessionName ?? evt.title ?? ''}</td>
        <td>${(evt.subjects ?? []).join(', ')}</td>
        <td>${evt.instructor ?? ''}</td>
        <td>${evt.venue ?? ''}</td>
        <td>${(evt.gradeGroups ?? []).join(', ')}</td>
        <td>${evt.status ?? ''}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<div class="generated">Generated ${new Date().toLocaleString()}</div>`;
  html += `</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
```

### Step 5: Replace Export Dropdown UI

Replace the existing dropdown (lines ~1295-1345) with the new structure.

The dropdown should have this exact structure:

```
┌─────────────────────────────────────────────┐
│ ⚠ Filtered: Staff (2), Venue (1)           │  ← yellow banner, only when filters active
│   Export includes filtered events only       │
├─────────────────────────────────────────────┤
│ CSV                                          │  ← section header (small, gray, uppercase)
│   📥 Current View (Week)                     │  ← dynamic label from currentView
│   📥 Full Program Year                       │
├─────────────────────────────────────────────┤
│ PDF / Print                                  │  ← section header
│   🖨 Current View (Week)                     │  ← dynamic label from currentView
│   🖨 Full Program Year                       │
└─────────────────────────────────────────────┘
```

Each button should have:
- Icon (Download for CSV, Printer for PDF)
- Tooltip explaining what will be exported
- onClick calls the appropriate handler

Use Lucide icons: `Download` for CSV buttons, `Printer` for PDF buttons.
Import `Printer` from lucide-react if not already imported.

### Step 6: Update the `eventToCsvRow` function

The current `eventToCsvRow` (line 348) is missing some fields that are in CSV_COLUMNS. Fix it to match the columns:

```
CSV_COLUMNS: Date, Day of Week, Start Time, End Time, Duration (min), Event Name, Event Type, Staff, Venue, Grade Group, Status, Notes
```

Make sure the fields array in `eventToCsvRow` has exactly 12 fields matching these 12 columns in order:
1. date
2. dayOfWeek
3. event.time
4. event.endTime
5. String(event.durationMinutes ?? '')
6. event.sessionName ?? event.title
7. (event.subjects ?? []).join('; ')
8. event.instructor ?? ''
9. event.venue ?? ''
10. (event.gradeGroups ?? []).join('; ')
11. event.status ?? ''
12. (event.tags ?? []).join('; ')

### Step 7: Build verification

Run `npm run build` to verify no TypeScript errors.

### Step 8: Commit

Commit all changes with a descriptive message.

---

## Files Changed
- `app/tools/scheduler/admin/page.tsx` — updated export dropdown, handlers, helpers
- NO new files needed (print view is generated inline via window.open)

## Verification
After implementation, verify:
1. Export dropdown shows filter warning when filters are active
2. "Current View" label changes with Day/Week/Month/Year tabs
3. CSV download works for both current view and full year
4. PDF opens in new tab with clean print layout
5. Both CSV and PDF respect active filters
6. Tooltips on all buttons
7. Build passes with no TypeScript errors
