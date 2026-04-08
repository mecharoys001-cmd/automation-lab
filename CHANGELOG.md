# Symphonix Scheduler — Changelog

## 2026-04-07

### ✨ New Features
- **Calendar Status Tooltips & Inline Details** — School Calendar day cells now show status type details (No School, Early Dismissal, Staff Exception) inline with description, time, and instructor name. Rich tooltips on hover.
- **Additional Tags for Staff & Venues** — Staff and Venues now support Additional Tags (same as Event Templates). New `staff_tags` and `venue_tags` junction tables. TagSelector added to Staff edit modal and Venue detail panel.
- **Tag Filters for Staff & Venues** — Separate tag filter dropdowns on the People page for filtering by Space Type, Event Type, etc.
- **Drag-and-Drop Tag Category Reassignment** — Tags can be dragged between categories on the Tags page, with ghost card preview.
- **Program Export** — Download entire program data as JSON from Settings → Backup & Export. Includes staff, venues, tags, templates, sessions, calendar, settings, and rules.
- **Program Duplication** — Duplicate a program with selective data copying.
- **Calendar Time Range Persistence** — Visible time range (start/end hours) persists per user and program via localStorage.
- **Start Year Dropdown** — Staff intake form and admin modal now use a dropdown for the start_year field.

### 🐛 Bug Fixes
- **Tooltip Positioning** — Fixed tooltips appearing in top-left corner when wrapper uses `display:contents`. Added `firstElementChild` fallback for `getBoundingClientRect()`.
- **Filter Bar Z-Index** — Filter bar no longer overlaps modals (lowered from z-100 to z-10, modal raised to z-1000).
- **Staff Portal Header in Year View** — Header no longer disappears when switching to Year view. Fixed with proper flex layout constraints.
- **Case-Insensitive Email Login** — Staff portal login now uses case-insensitive email matching (`.ilike()` instead of `.eq()`).
- **Staff Portal Admin Links** — Removed "Set up Event Templates" and "Add Staff & Venues" links from staff portal empty state.
- **Staff Duplication** — Fixed silent failure when duplicating staff records.
- **Email Login Redirect** — Force full redirect after email login to prevent stale state.
- **Program Export Errors** — Fixed `schedule_versions` and `settings` tables missing `program_id` column.
- **Publish Permissions** — Clarified publish error messages and made notification phase non-fatal.
- **Build Fixes** — Excluded vitest config from tsconfig, added vitest devDependency.

### 🧹 Cleanup
- **Removed Import Data Page** — Redundant with CSV imports on each page. Page still exists at `/admin/import` but removed from sidebar.

### 🧹 Other
- add changelog for 2026-04-07 session

### 🐛 Bug Fixes
- avoid large bulk update query
