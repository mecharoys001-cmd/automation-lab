# Staff Time Off — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staff-facing Time Off workflow to the Staff Portal so staff can submit vacation/absence requests. Requests require admin approval before they become active scheduling-impact data. Approved time off surfaces impact warnings in the Schedule Preview without automatically disqualifying staff from recurring assignments.

**Current Behavior:** Staff have no way to request time off. Admins manually handle absence information. The scheduling engine has no per-staff date-specific blackout support.

**New Behavior:** Staff submit time off requests (full-day, partial-day, or multi-day) from a new "Time Off" tab in the Staff Portal. Admins see a pending count indicator on the "Staff & Venues" sidebar item and review/approve/deny requests from the Staff page. Approved requests feed into a new "Exceptions Impact" tab in the Schedule Preview modal showing missed-session counts and percentages for recurring assignments.

**Architecture:**
- New `staff_time_off_requests` table with status workflow (pending → approved/denied)
- New API routes under `/api/staff-time-off/` for staff submission + admin review
- New "Time Off" tab in the Staff Portal page with form + history list
- New review section on the admin Staff & Venues page
- Sidebar badge (red dot) on "Staff & Venues" when pending requests exist
- Dismissible popup alert for admins on first encounter with pending requests
- New "Exceptions Impact" tab in `SchedulerResultModal` for approved time-off scheduling warnings
- Impact calculation service computing missed occurrences against recurring templates

**Tech Stack:** Next.js (App Router), Supabase (Postgres + service client), Vitest, TypeScript, Tailwind CSS.

---

## File Structure

```
# New files
supabase/migrations/20260408_staff_time_off_requests.sql  — Create staff_time_off_requests table + enum
types/staff-time-off.ts                                     — TypeScript interfaces for time off domain
app/api/staff-time-off/route.ts                             — Staff: POST create, GET list own requests
app/api/staff-time-off/pending/route.ts                     — Admin: GET pending count for sidebar badge
app/api/staff-time-off/review/route.ts                      — Admin: GET all requests, PATCH approve/deny
lib/scheduler/time-off-impact.ts                            — Compute missed sessions & percentages for approved time off vs templates
app/tools/scheduler/components/portal/TimeOffTab.tsx        — Staff Portal: submission form + history list
app/tools/scheduler/components/admin/TimeOffReviewPanel.tsx — Admin: pending/resolved request list with approve/deny
app/tools/scheduler/components/modals/ExceptionsImpactTab.tsx — Schedule Preview: impact warnings table

# Test files
app/api/staff-time-off/__tests__/route.test.ts              — API route tests for staff submission
app/api/staff-time-off/__tests__/review.test.ts             — API route tests for admin review
lib/scheduler/__tests__/time-off-impact.test.ts             — Unit tests for impact calculation

# Modified files
types/database.ts                                           — Add StaffTimeOffRequest interface + TimeOffRequestType/Status enums
app/tools/scheduler/portal/page.tsx                         — Add "Time Off" tab toggle, render TimeOffTab
app/tools/scheduler/admin/people/page.tsx                   — Add "Time Off Requests" section, render TimeOffReviewPanel
app/tools/scheduler/components/layout/Sidebar.tsx           — Add optional badge prop to NavItem, render red dot
app/tools/scheduler/routes.ts                               — Add badge support to NavItem interface
app/tools/scheduler/components/modals/SchedulerResultModal.tsx — Add "Exceptions Impact" tab, render ExceptionsImpactTab
```

---

### Task 1: Database — Create staff_time_off_requests Table

**Files:**
- Create: `supabase/migrations/20260408_staff_time_off_requests.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Staff Time Off Requests
-- Stores staff-submitted time off requests with admin approval workflow

-- Enum for request type
DO $$ BEGIN
  CREATE TYPE time_off_request_type AS ENUM ('full_day', 'partial_day', 'multi_day');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum for request status
DO $$ BEGIN
  CREATE TYPE time_off_request_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff_time_off_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  request_type  time_off_request_type NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  start_time    TIME,          -- nullable; used only for partial_day
  end_time      TIME,          -- nullable; used only for partial_day
  note          TEXT NOT NULL DEFAULT '',
  status        time_off_request_status NOT NULL DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID,          -- references admins.id (nullable)
  review_note   TEXT,          -- optional admin note (v1 placeholder)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_staff_time_off_program   ON staff_time_off_requests(program_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_staff     ON staff_time_off_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_status    ON staff_time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_dates     ON staff_time_off_requests(start_date, end_date);

-- Enable RLS (service client bypasses)
ALTER TABLE staff_time_off_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE staff_time_off_requests IS 'Staff-submitted time off requests with admin approval workflow';
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste the SQL into the Supabase dashboard SQL Editor and execute.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260408_staff_time_off_requests.sql
git commit -m "feat: create staff_time_off_requests table with approval workflow"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `types/staff-time-off.ts`
- Modify: `types/database.ts`

- [ ] **Step 1: Create domain types file**

```typescript
// types/staff-time-off.ts

export type TimeOffRequestType = 'full_day' | 'partial_day' | 'multi_day';
export type TimeOffRequestStatus = 'pending' | 'approved' | 'denied';

export interface StaffTimeOffRequest {
  id: string;
  program_id: string;
  staff_id: string;
  request_type: TimeOffRequestType;
  start_date: string;       // YYYY-MM-DD
  end_date: string;         // YYYY-MM-DD
  start_time: string | null; // HH:MM (partial_day only)
  end_time: string | null;   // HH:MM (partial_day only)
  note: string;
  status: TimeOffRequestStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

/** Staff info joined onto a request for admin views */
export interface TimeOffRequestWithStaff extends StaffTimeOffRequest {
  staff_first_name: string;
  staff_last_name: string;
  staff_email: string | null;
}

/** Impact warning row for the Exceptions Impact tab */
export interface TimeOffImpactWarning {
  staff_id: string;
  staff_name: string;
  request_id: string;
  time_off_start: string;
  time_off_end: string;
  template_id: string;
  template_name: string;
  day_of_week: number;
  missed_count: number;
  total_count: number;
  missed_percentage: number;
}
```

- [ ] **Step 2: Add enum re-exports to `types/database.ts`**

Add at the end of the enums section (after `RotationMode`):

```typescript
export type { TimeOffRequestType, TimeOffRequestStatus, StaffTimeOffRequest } from './staff-time-off';
```

- [ ] **Step 3: Commit**

```bash
git add types/staff-time-off.ts types/database.ts
git commit -m "feat: add TypeScript types for staff time off requests and impact warnings"
```

---

### Task 3: Staff Submission API — TDD

**Files:**
- Create: `app/api/staff-time-off/__tests__/route.test.ts`
- Create: `app/api/staff-time-off/route.ts`

- [ ] **Step 1: Write tests first**

Test cases for `POST /api/staff-time-off`:
1. Creates a full_day request with valid fields → 201 + returned request object
2. Creates a partial_day request with start_time/end_time → 201
3. Creates a multi_day request with date range → 201
4. Rejects partial_day missing start_time or end_time → 400
5. Rejects request where end_date < start_date → 400
6. Rejects request with missing required fields (start_date, request_type) → 400
7. Rejects unauthenticated request → 401

Test cases for `GET /api/staff-time-off`:
1. Returns only the current staff member's requests, ordered by submitted_at desc
2. Returns empty array when staff has no requests
3. Rejects unauthenticated request → 401

```bash
npx vitest run app/api/staff-time-off/__tests__/route.test.ts
```

**Expected:** All tests fail (no implementation yet).

- [ ] **Step 2: Implement POST handler**

Auth pattern — staff self-service via email lookup (same as portal page):
```typescript
// Get logged-in user email from /api/auth/me cookie pattern
// Look up staff record by email
// Insert into staff_time_off_requests with status = 'pending'
```

Validation:
- `request_type` must be one of `full_day`, `partial_day`, `multi_day`
- `start_date` required, valid date format
- `end_date` required, `end_date >= start_date`
- For `full_day`: `start_date === end_date`, `start_time`/`end_time` must be null
- For `partial_day`: `start_date === end_date`, `start_time` and `end_time` required, `end_time > start_time`
- For `multi_day`: `end_date > start_date`, `start_time`/`end_time` must be null
- `note` is a string (may be empty)

- [ ] **Step 3: Implement GET handler**

Fetch requests filtered by `staff_id` (derived from authenticated email), ordered `submitted_at DESC`.

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run app/api/staff-time-off/__tests__/route.test.ts
```

**Expected:** All tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/staff-time-off/__tests__/route.test.ts app/api/staff-time-off/route.ts
git commit -m "feat: add staff time off submission API (POST create, GET list own)"
```

---

### Task 4: Admin Review API — TDD

**Files:**
- Create: `app/api/staff-time-off/__tests__/review.test.ts`
- Create: `app/api/staff-time-off/review/route.ts`
- Create: `app/api/staff-time-off/pending/route.ts`

- [ ] **Step 1: Write tests first**

Test cases for `GET /api/staff-time-off/review`:
1. Returns all requests for a program_id with staff name joined, ordered by submitted_at desc
2. Supports `?status=pending` filter
3. Requires admin auth → 401 for unauthenticated
4. Requires program access → 403 for wrong program

Test cases for `PATCH /api/staff-time-off/review`:
1. Approves a pending request → status = 'approved', reviewed_at set, reviewed_by set → 200
2. Denies a pending request → status = 'denied', reviewed_at set → 200
3. Rejects action on already-resolved request → 400
4. Rejects invalid status value → 400
5. Requires admin auth → 401

Test cases for `GET /api/staff-time-off/pending`:
1. Returns `{ count: N }` for a given program_id where status = 'pending'
2. Returns `{ count: 0 }` when no pending requests exist
3. Requires admin auth → 401

```bash
npx vitest run app/api/staff-time-off/__tests__/review.test.ts
```

**Expected:** All tests fail.

- [ ] **Step 2: Implement review GET handler**

```typescript
// Auth: requireAdmin() + requireProgramAccess()
// Query staff_time_off_requests joined with staff (first_name, last_name, email)
// Filter by program_id (required), optional status filter
// Order by submitted_at DESC
```

- [ ] **Step 3: Implement review PATCH handler**

```typescript
// Auth: requireAdmin() + requireMinRole('standard')
// Body: { id: string, status: 'approved' | 'denied', review_note?: string }
// Verify current status is 'pending'
// Update status, reviewed_at = now(), reviewed_by = admin user id
```

- [ ] **Step 4: Implement pending count GET handler**

```typescript
// Auth: requireAdmin() + requireProgramAccess()
// SELECT count(*) FROM staff_time_off_requests WHERE program_id = ? AND status = 'pending'
// Return { count: number }
```

- [ ] **Step 5: Run tests — all pass**

```bash
npx vitest run app/api/staff-time-off/__tests__/review.test.ts
```

**Expected:** All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/staff-time-off/__tests__/review.test.ts app/api/staff-time-off/review/route.ts app/api/staff-time-off/pending/route.ts
git commit -m "feat: add admin review API for time off requests (list, approve/deny, pending count)"
```

---

### Task 5: Impact Calculation Service — TDD

**Files:**
- Create: `lib/scheduler/__tests__/time-off-impact.test.ts`
- Create: `lib/scheduler/time-off-impact.ts`

- [ ] **Step 1: Write tests first**

Test cases for `computeTimeOffImpact()`:
1. Single approved time off covering 1 occurrence of a weekly template → missed_count = 1, correct percentage
2. Multi-day time off covering 3 of 10 weekly occurrences → missed_count = 3, missed_percentage = 30
3. Partial-day time off overlapping template time range → flagged as conflict
4. Partial-day time off NOT overlapping template time range → no impact
5. Staff with no approved time off → empty array
6. Multiple templates affected by same time off → separate warning row per template
7. Time off outside the schedule date range → no impact

```bash
npx vitest run lib/scheduler/__tests__/time-off-impact.test.ts
```

**Expected:** All tests fail.

- [ ] **Step 2: Implement `computeTimeOffImpact()`**

```typescript
// lib/scheduler/time-off-impact.ts

import type { TimeOffImpactWarning } from '@/types/staff-time-off';

interface ApprovedTimeOff {
  id: string;
  staff_id: string;
  staff_name: string;
  request_type: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
}

interface TemplateOccurrence {
  template_id: string;
  template_name: string;
  day_of_week: number;        // 0 = Sunday ... 6 = Saturday
  start_time: string;         // HH:MM
  end_time: string;           // HH:MM
  staff_id: string;
  occurrences: string[];      // array of YYYY-MM-DD dates this template runs
}

/**
 * For each approved time-off block, compute how many occurrences of each
 * recurring template the staff member would miss, along with the percentage.
 */
export function computeTimeOffImpact(
  approvedTimeOff: ApprovedTimeOff[],
  templateOccurrences: TemplateOccurrence[],
): TimeOffImpactWarning[] {
  // For each time off × template combination where staff matches:
  //   - Count occurrences whose date falls within [start_date, end_date]
  //   - For partial_day: also check time overlap
  //   - Build TimeOffImpactWarning with missed_count, total_count, missed_percentage
}
```

- [ ] **Step 3: Run tests — all pass**

```bash
npx vitest run lib/scheduler/__tests__/time-off-impact.test.ts
```

**Expected:** All tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/scheduler/__tests__/time-off-impact.test.ts lib/scheduler/time-off-impact.ts
git commit -m "feat: add time off impact calculation service for recurring template warnings"
```

---

### Task 6: Staff Portal — Time Off Tab

**Files:**
- Create: `app/tools/scheduler/components/portal/TimeOffTab.tsx`
- Modify: `app/tools/scheduler/portal/page.tsx`

- [ ] **Step 1: Create TimeOffTab component**

Layout (all new interactive elements wrapped in `<Tooltip>`):

```
┌────────────────────────────────────────────────────────┐
│  Time Off                                              │
│  Submit a time off request. Your admin will review it. │
│                                                        │
│  ┌─ Submission Form ──────────────────────────────┐    │
│  │  Request Type:  [Full Day ▼]       ← Tooltip   │    │
│  │  Date:          [2026-04-15]       ← Tooltip   │    │
│  │  Note:          [_______________]  ← Tooltip   │    │
│  │                                                │    │
│  │                      [Submit Request] ← Tooltip│    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌─ Your Requests ────────────────────────────────┐    │
│  │  Apr 15, 2026 · Full Day                       │    │
│  │  "Family event"                                │    │
│  │  ● Pending                          ← Badge    │    │
│  │                                                │    │
│  │  Mar 20–22, 2026 · Multi-Day                   │    │
│  │  "Spring break travel"                         │    │
│  │  ✓ Approved · Mar 18, 2026          ← Badge    │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

Props:
```typescript
interface TimeOffTabProps {
  staffId: string;
  programIds: string[];   // staff may belong to multiple programs
}
```

Key behaviors:
- Request type select (`full_day` | `partial_day` | `multi_day`) — each option wrapped in `<Tooltip>` explaining what it means
- Date input: single date for full_day/partial_day, date range picker for multi_day — Tooltip on each input
- Time inputs for partial_day (start_time, end_time) — Tooltip explaining "Specify the hours you'll be away"
- Note textarea — Tooltip: "Add context for your admin (optional)"
- Submit button — Tooltip: "Submit for admin approval"; disabled while submitting; calls `POST /api/staff-time-off`
- No edit/cancel controls on submitted items (spec requirement)
- History list: fetch via `GET /api/staff-time-off`, show date(s), type, note preview, status badge (use existing `Badge` component: amber for Pending, green for Approved, red for Denied), decision timestamp if resolved
- Tooltip on each status badge explaining: "Pending — waiting for admin review", "Approved — your time off is confirmed", "Denied — request was not approved"
- After submit: re-fetch history, clear form, show success toast via `showToast()`

- [ ] **Step 2: Add tab toggle to Staff Portal page**

Modify `app/tools/scheduler/portal/page.tsx`:

Add a top-level tab toggle ("Schedule" | "Time Off") in the header area, styled like the existing schedule mode toggle. Both tabs wrapped in `<Tooltip>`:
- Schedule tooltip: "View your teaching schedule"
- Time Off tooltip: "Submit and track time off requests"

When "Time Off" is selected, render `<TimeOffTab>` instead of the calendar views. Pass `staffId` and `programIds` derived from existing state.

- [ ] **Step 3: Verify no edit/cancel controls exist**

Confirm submitted requests in the history list are read-only — no edit buttons, no delete buttons, no cancel buttons. This is a spec requirement.

- [ ] **Step 4: Commit**

```bash
git add app/tools/scheduler/components/portal/TimeOffTab.tsx app/tools/scheduler/portal/page.tsx
git commit -m "feat: add Time Off tab to Staff Portal with submission form and history list"
```

---

### Task 7: Admin Review Panel — Staff & Venues Page

**Files:**
- Create: `app/tools/scheduler/components/admin/TimeOffReviewPanel.tsx`
- Modify: `app/tools/scheduler/admin/people/page.tsx`

- [ ] **Step 1: Create TimeOffReviewPanel component**

Layout (all interactive elements wrapped in `<Tooltip>`):

```
┌─ Pending Time Off ────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Jane Smith · Apr 15, 2026 · Full Day                    │  │
│  │  "Family event"                                          │  │
│  │  Submitted Apr 10, 2026                                  │  │
│  │                        [✓ Approve] [✗ Deny] ← Tooltips   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  John Doe · Mar 20–22, 2026 · Multi-Day                  │  │
│  │  "Spring break travel"                                   │  │
│  │  Submitted Mar 15, 2026                                  │  │
│  │                        [✓ Approve] [✗ Deny]              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ── Resolved ──────────────────────── [Show/Hide] ← Tooltip   │
│  │  Bob Lee · Feb 10, 2026 · Partial Day (1:00–3:00 PM)    │  │
│  │  ✓ Approved · Feb 8, 2026                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

Props:
```typescript
interface TimeOffReviewPanelProps {
  programId: string;
  onPendingCountChange?: (count: number) => void;
}
```

Key behaviors:
- Fetches requests via `GET /api/staff-time-off/review?program_id={id}`
- Split into Pending (top, always visible) and Resolved (collapsible, initially collapsed)
- Approve button — Tooltip: "Approve this time off request"; calls `PATCH /api/staff-time-off/review` with `status: 'approved'`
- Deny button — Tooltip: "Deny this time off request"; calls `PATCH /api/staff-time-off/review` with `status: 'denied'`
- Show/Hide toggle for resolved — Tooltip: "Toggle visibility of resolved requests"
- After approve/deny: re-fetch list, call `onPendingCountChange` with new count
- Use existing `Badge` component for status indicators
- No bulk approve — one at a time in v1

- [ ] **Step 2: Add TimeOffReviewPanel to Staff & Venues page**

Modify `app/tools/scheduler/admin/people/page.tsx`:

Add a new top-level tab alongside the existing "Staff" and "Venues" tabs: **"Time Off"** — Tooltip: "Review and manage staff time off requests".

When the "Time Off" tab is selected, render `<TimeOffReviewPanel>` with the current `programId`. Track the pending count via the `onPendingCountChange` callback for the sidebar badge (Task 8).

- [ ] **Step 3: Commit**

```bash
git add app/tools/scheduler/components/admin/TimeOffReviewPanel.tsx app/tools/scheduler/admin/people/page.tsx
git commit -m "feat: add Time Off review panel to admin Staff & Venues page"
```

---

### Task 8: Sidebar Badge + Admin Alerts

**Files:**
- Modify: `app/tools/scheduler/routes.ts`
- Modify: `app/tools/scheduler/components/layout/Sidebar.tsx`
- Modify: `app/tools/scheduler/admin/people/page.tsx` (or parent layout)

- [ ] **Step 1: Extend NavItem interface in routes.ts**

Add optional badge field:

```typescript
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tooltip: string;
  badge?: number;  // NEW: if > 0, show red dot with count
}
```

- [ ] **Step 2: Render badge in Sidebar.tsx**

After the `<span className="text-sm">{item.label}</span>`, add:

```tsx
{item.badge != null && item.badge > 0 && (
  <Tooltip text={`${item.badge} pending time off request${item.badge !== 1 ? 's' : ''}`} position="right">
    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
      {item.badge}
    </span>
  </Tooltip>
)}
```

- [ ] **Step 3: Fetch pending count and pass as badge to sidebar nav**

In the admin layout (or the page that renders `<Sidebar>`), fetch `GET /api/staff-time-off/pending?program_id={id}` on mount. Clone the `adminNavItems` array and set the `badge` property on the "Staff & Venues" entry.

- [ ] **Step 4: Add dismissible popup alert**

When the admin navigates to any admin page and pending count > 0, show a dismissible toast/popup:
- Text: "You have {N} pending time off request(s)"
- Action: link to Staff & Venues → Time Off tab
- Dismiss: sets a session-scoped flag (sessionStorage) so it only shows once per session
- Use `showToast()` from `app/tools/scheduler/lib/toast.ts` or a small custom alert banner

- [ ] **Step 5: Commit**

```bash
git add app/tools/scheduler/routes.ts app/tools/scheduler/components/layout/Sidebar.tsx
git commit -m "feat: add pending time off badge to sidebar and dismissible admin alert"
```

---

### Task 9: Exceptions Impact Tab in Schedule Preview

**Files:**
- Create: `app/tools/scheduler/components/modals/ExceptionsImpactTab.tsx`
- Modify: `app/tools/scheduler/components/modals/SchedulerResultModal.tsx`

- [ ] **Step 1: Create ExceptionsImpactTab component**

Layout (all interactive elements wrapped in `<Tooltip>`):

```
┌─ Exceptions Impact ──────────────────────────────────────────────────────┐
│                                                                          │
│  Approved time off that overlaps with recurring assignments.             │
│  Staff are NOT automatically removed — review impact below.              │
│                                                                          │
│  ┌──────────┬────────────────┬─────────────────┬───────┬───────┬──────┐  │
│  │ Staff    │ Time Off       │ Template        │ Missed│ Total │  %   │  │
│  ├──────────┼────────────────┼─────────────────┼───────┼───────┼──────┤  │
│  │ Jane S.  │ Apr 15         │ Mon 3rd Grade   │   1   │  12   │  8%  │  │
│  │ John D.  │ Mar 20–22      │ Wed 5th Grade   │   3   │  10   │ 30%  │  │
│  │ John D.  │ Mar 20–22      │ Fri Art Club    │   1   │  10   │ 10%  │  │
│  └──────────┴────────────────┴─────────────────┴───────┴───────┴──────┘  │
│                                                                          │
│  Severity key: 🟢 <10%  🟡 10–30%  🔴 >30%              ← Tooltip each │
└──────────────────────────────────────────────────────────────────────────┘
```

Props:
```typescript
interface ExceptionsImpactTabProps {
  programId: string;
  scheduleStartDate: string;
  scheduleEndDate: string;
  templateStats: TemplateStats[];
}
```

Key behaviors:
- On mount: fetch approved time off for the program, call `computeTimeOffImpact()` with template occurrences derived from the scheduler result
- Table columns: Staff name, Time Off date/range, Template name, Missed sessions, Total sessions, Missed %, Severity indicator
- Severity indicator — Tooltip on each: green (<10% "Low impact"), amber (10–30% "Moderate impact"), red (>30% "High impact — consider reassignment")
- Column headers each have a Tooltip explaining the data
- If no impact warnings: show "No approved time off conflicts with this schedule"
- Sort by missed_percentage descending (highest impact first)

- [ ] **Step 2: Add Exceptions Impact tab to SchedulerResultModal**

Modify `app/tools/scheduler/components/modals/SchedulerResultModal.tsx`:

Add a tab bar to the modal body with two tabs:
- **"Preview"** (default) — existing content (stat cards, template breakdown, unassigned, skipped dates, etc.)
- **"Exceptions Impact"** — renders `<ExceptionsImpactTab>`

Tab bar styled like the portal's toggle buttons. Each tab wrapped in `<Tooltip>`:
- Preview tooltip: "Session generation summary and unassigned staff"
- Exceptions Impact tooltip: "Impact of approved time off on recurring assignments"

Show a small amber badge on "Exceptions Impact" tab if there are any warnings.

- [ ] **Step 3: Commit**

```bash
git add app/tools/scheduler/components/modals/ExceptionsImpactTab.tsx app/tools/scheduler/components/modals/SchedulerResultModal.tsx
git commit -m "feat: add Exceptions Impact tab to Schedule Preview with time off warnings"
```

---

### Task 10: Build Verification + Smoke Test

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

**Expected:** All existing + new tests pass.

- [ ] **Step 2: Full build**

```bash
npm run build
```

**Expected:** No TypeScript or build errors.

- [ ] **Step 3: Smoke test checklist**

Staff Portal:
1. Log in as staff → see "Schedule" and "Time Off" tabs → Tooltip on each tab ✓
2. Switch to "Time Off" tab → form renders with type selector, date input, note textarea ✓
3. Submit a full_day request → success toast, request appears in history as Pending ✓
4. Submit a partial_day request with times → appears in history ✓
5. Submit a multi_day request with date range → appears in history ✓
6. Verify NO edit or cancel buttons on submitted requests ✓
7. Tooltips appear on all form controls and status badges ✓

Admin:
8. Navigate to Staff & Venues → red badge shows pending count on sidebar item ✓
9. Dismissible alert popup appears on first load with pending requests ✓
10. Switch to "Time Off" tab → pending requests listed with staff names ✓
11. Click Approve → status changes to Approved, badge count decreases ✓
12. Click Deny → status changes to Denied, badge count decreases ✓
13. When no pending requests remain → red dot disappears from sidebar ✓
14. Tooltips on Approve/Deny buttons and all interactive elements ✓

Schedule Preview:
15. Generate a schedule preview → "Exceptions Impact" tab appears ✓
16. Click Exceptions Impact tab → shows impact table with missed counts/percentages ✓
17. Severity indicators render with correct color coding ✓
18. If no approved time off → shows "No approved time off conflicts" message ✓
19. Tooltips on column headers and severity indicators ✓

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: complete staff time off workflow — portal submission, admin review, schedule impact"
```
