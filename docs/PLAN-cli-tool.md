# Plan: Symphonix CLI Tool

## Goal
Build a comprehensive CLI tool (`symphonix`) that hits the app's existing API endpoints, enabling:
- Automated testing after deploys
- Data querying and management from the terminal
- Smoke tests and health checks
- Agent-driven QA (AUTO can test the app via `exec`)

---

## Architecture

### Tech Stack
- **Runtime:** Node.js (v22) with `tsx` for TypeScript execution
- **CLI framework:** None needed — use a simple command parser (minimal deps)
- **HTTP client:** Built-in `fetch` (Node 22 has native fetch)
- **Output:** Formatted tables via simple string formatting (no deps)
- **Config:** Environment variables from `.env.local` or flags

### File Structure
```
cli/
  symphonix.ts          ← Main entry point + command router
  lib/
    api.ts              ← HTTP client wrapper (base URL, auth, error handling)
    format.ts           ← Table formatting, colors, output helpers
    config.ts           ← Load env vars, resolve base URL
  commands/
    staff.ts            ← staff list, staff add, staff get, staff delete
    venues.ts           ← venues list, venues add, venues get, venues delete
    events.ts           ← events list, events create, events edit, events delete
    tags.ts             ← tags list, tags add, tags delete
    programs.ts         ← programs list, programs create, programs import
    templates.ts        ← templates list, templates create
    reports.ts          ← reports summary, reports hours-by-tag, reports staff-hours, reports detail
    schedule.ts         ← schedule generate, schedule validate, schedule clear, schedule publish
    conflicts.ts        ← conflicts check (venue conflict detection)
    export.ts           ← export csv, export pdf
    status.ts           ← status (health check, DB counts, issues)
    test.ts             ← test smoke, test full (automated test suites)
```

### Entry Point
```bash
# Run via npx tsx
npx tsx cli/symphonix.ts <command> <subcommand> [--flags]

# Or add to package.json scripts:
"symphonix": "tsx cli/symphonix.ts"
# Then: npm run symphonix -- staff list
```

---

## Detailed Command Spec

### Global Flags (all commands)
| Flag | Description | Default |
|------|-------------|---------|
| `--base-url <url>` | API base URL | `https://tools.artsnwct.org` |
| `--program <name\|id>` | Target program | First program found |
| `--json` | Output raw JSON instead of formatted tables | false |
| `--quiet` | Suppress non-essential output | false |

---

### 1. `status` — Health Check
**API endpoints used:** `/api/data/counts`, `/api/programs`, `/api/scheduler/validate`

```bash
symphonix status
```

**Output:**
```
Symphonix Status
─────────────────────────────────
Program:     Symphonix 2025-2026
Base URL:    https://tools.artsnwct.org

Data Counts:
  Programs:        1
  Event Templates: 12
  Sessions:        47
  Staff:           6
  Venues:          2
  Tags:            18

Readiness:
  ✅ Event Templates: 12 active, all configured
  ⚠️  Staff: 2 of 6 need attention
  ✅ Venues: 2 active, all configured
```

**Implementation:**
```typescript
// cli/commands/status.ts
export async function status(api: ApiClient, flags: Flags) {
  // 1. GET /api/programs → list programs, pick selected or first
  // 2. GET /api/data/counts?program_id=X → get counts
  // 3. GET /api/scheduler/validate?program_id=X → get readiness
  // 4. Format and print
}
```

---

### 2. `staff` — Staff Management
**API endpoints:** `/api/instructors`, `/api/instructors/[id]`

```bash
symphonix staff list                              # List all staff
symphonix staff list --active                     # Active only
symphonix staff list --skills "Math"              # Filter by skill
symphonix staff get <id>                          # Get one staff member
symphonix staff add --first "Jane" --last "Doe" --email "jane@test.com" --skills "Math,Science"
symphonix staff delete <id>
```

**List output:**
```
Staff (6 total, program: Symphonix 2025-2026)
──────────────────────────────────────────────────────────────
ID          Name                Skills              Status
─────────── ─────────────────── ─────────────────── ──────
abc123      booper mcswizzle    Math, Science       Active
def456      stacy p             Art                 Active
...
```

**Implementation:**
```typescript
// cli/commands/staff.ts
export async function staffList(api: ApiClient, flags: Flags) {
  const params = new URLSearchParams({ program_id: flags.programId });
  if (flags.active) params.set('is_active', 'true');
  if (flags.skills) params.set('skills', flags.skills);
  const { instructors } = await api.get(`/api/instructors?${params}`);
  // Format as table
}

export async function staffAdd(api: ApiClient, flags: Flags) {
  const body = {
    first_name: flags.first,
    last_name: flags.last,
    email: flags.email,
    skills: flags.skills?.split(',') ?? [],
    is_active: true,
    program_id: flags.programId,
  };
  const result = await api.post('/api/instructors', body);
  // Print created staff
}
```

---

### 3. `venues` — Venue Management
**API endpoints:** `/api/venues`, `/api/venues/[id]`

```bash
symphonix venues list
symphonix venues add --name "Room 101" --capacity 30 --space-type "Classroom"
symphonix venues get <id>
symphonix venues delete <id>
```

**Implementation:**
```typescript
// cli/commands/venues.ts
export async function venuesList(api: ApiClient, flags: Flags) {
  const { venues } = await api.get(`/api/venues?program_id=${flags.programId}`);
  // Format as table: ID, Name, Capacity, Space Type
}
```

---

### 4. `events` — Session/Event Management
**API endpoints:** `/api/sessions`, `/api/sessions/[id]`

```bash
symphonix events list                                    # All events
symphonix events list --week 2026-03-09                  # Events for a specific week
symphonix events list --date 2026-03-10                  # Events on a specific date
symphonix events list --staff "booper"                   # Events for a staff member
symphonix events list --venue "smashatorium"              # Events at a venue
symphonix events create --name "Piano 101" --venue "clown room" --date 2026-03-20 --time 10:00 --duration 60
symphonix events get <id>
symphonix events delete <id>
symphonix events cancel <id>
```

**List output:**
```
Events (47 total, Week of Mar 9, 2026)
──────────────────────────────────────────────────────────────────────────
Date        Time          Event Name         Staff              Venue          Status
─────────── ───────────── ────────────────── ────────────────── ────────────── ────────
2026-03-09  10:00-11:00   boops              booper mcswizzle   smashatorium   scheduled
2026-03-09  10:30-11:30   Science Session    stacy p            clown room     scheduled
...
```

**Implementation:**
```typescript
// cli/commands/events.ts
export async function eventsList(api: ApiClient, flags: Flags) {
  const params = new URLSearchParams({ program_id: flags.programId });
  // Calculate date range from --week, --date, --month flags
  if (flags.week) {
    const mon = getMonday(flags.week);
    const sun = addDays(mon, 6);
    params.set('start_date', mon);
    params.set('end_date', sun);
  }
  if (flags.date) {
    params.set('start_date', flags.date);
    params.set('end_date', flags.date);
  }
  const { sessions } = await api.get(`/api/sessions?${params}`);
  // Filter by --staff, --venue if provided (client-side)
  // Format as table
}
```

---

### 5. `tags` — Tag Management
**API endpoints:** `/api/tags`, `/api/tags/[id]`

```bash
symphonix tags list                                      # All tags
symphonix tags list --category "Event Type"              # Filter by category
symphonix tags add --name "Drama" --category "Event Type" --emoji "🎭"
symphonix tags delete <id>
```

---

### 6. `templates` — Event Template Management
**API endpoints:** `/api/templates`, `/api/templates/[id]`

```bash
symphonix templates list                                 # All templates
symphonix templates get <id>                             # Template details
```

---

### 7. `programs` — Program Management
**API endpoints:** `/api/programs`, `/api/programs/[id]`, `/api/programs/[id]/import`

```bash
symphonix programs list                                  # All programs
symphonix programs create --name "Summer 2026" --start 2026-06-01 --end 2026-08-31
symphonix programs import --target <id> --source <id> --staff --venues --tags
```

---

### 8. `reports` — Reports
**API endpoints:** `/api/reports/summary`, `/api/reports/instructor-detail`

```bash
symphonix reports summary                                # Overview stats
symphonix reports hours-by-tag                           # Hours by tag breakdown
symphonix reports staff-hours                            # Staff hours breakdown
symphonix reports staff-detail <id>                      # Individual staff detail
```

**Summary output:**
```
Report Summary (Symphonix 2025-2026, Nov 2025 – Jun 2026)
──────────────────────────────────────────────────────────────
Total Sessions:  47
Unassigned:      3

Hours by Tag:
  Math           12.0h  (18 sessions)
  Science         8.5h  (12 sessions)
  Art             6.0h  (9 sessions)

Staff Hours:
  booper mcswizzle   4.0h  (4 sessions)
  stacy p            3.5h  (3 sessions)
  ...
```

---

### 9. `schedule` — Schedule Operations
**API endpoints:** `/api/scheduler/generate`, `/api/scheduler/validate`, `/api/data/clear-sessions`, `/api/notifications/publish`

```bash
symphonix schedule validate                              # Check readiness
symphonix schedule generate                              # Run auto-scheduler
symphonix schedule clear                                 # Clear all events (DANGEROUS)
symphonix schedule publish                               # Publish schedule
```

---

### 10. `conflicts` — Venue Conflict Check
**API endpoint:** `/api/sessions/check-conflict`

```bash
symphonix conflicts check --venue "smashatorium" --date 2026-03-10 --start 10:00 --end 11:00
```

**Output:**
```
⚠️  Conflict: smashatorium is booked from 10:00 to 11:00 (boops)
```
or
```
✅ No conflict: smashatorium is available 10:00-11:00 on 2026-03-10
```

---

### 11. `export` — Export Data
**API endpoints:** Uses same data as events list

```bash
symphonix export csv --week 2026-03-09                   # CSV export for a week
symphonix export csv --month 2026-03                     # CSV export for a month
symphonix export csv --all                               # Full program CSV
```

Writes to stdout or `--output <file>`.

---

### 12. `test` — Automated Test Suites
**No external API — calls other commands internally**

```bash
symphonix test smoke                                     # Quick health check
symphonix test full                                      # Comprehensive test suite
```

#### `test smoke` (runs in ~5 seconds):
```
1. ✅ API reachable (200 from /api/programs)
2. ✅ Programs loaded (1 found)
3. ✅ Staff endpoint works (6 staff)
4. ✅ Venues endpoint works (2 venues)
5. ✅ Tags endpoint works (18 tags)
6. ✅ Events endpoint works (47 sessions)
7. ✅ Reports endpoint works
8. ✅ Validation endpoint works
9. ✅ Conflict check endpoint works

Smoke test: 9/9 passed ✅
```

#### `test full` (runs in ~15 seconds):
Everything in smoke, plus:
```
10. ✅ Create test staff → 201
11. ✅ Create test venue → 201
12. ✅ Create test tag → 201
13. ✅ Create test event → 201
14. ✅ Verify event appears in list
15. ✅ Conflict check detects new event
16. ✅ Edit event → 200
17. ✅ Cancel event → 200
18. ✅ Delete test data (cleanup)
19. ✅ Reports include correct data
20. ✅ Export generates valid CSV

Full test: 20/20 passed ✅
```

---

## Implementation Details

### `cli/lib/api.ts` — HTTP Client
```typescript
export class ApiClient {
  constructor(private baseUrl: string) {}

  async get(path: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
    return res.json();
  }

  async post(path: string, body: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${res.status}: ${err.error ?? res.statusText}`);
    }
    return res.json();
  }

  async patch(path: string, body: any): Promise<any> { /* similar */ }
  async delete(path: string): Promise<any> { /* similar */ }
}
```

### `cli/lib/format.ts` — Output Formatting
```typescript
export function table(headers: string[], rows: string[][]): string {
  // Calculate column widths
  // Pad cells
  // Add separator lines
  // Return formatted string
}

export function success(msg: string) { console.log(`✅ ${msg}`); }
export function warning(msg: string) { console.log(`⚠️  ${msg}`); }
export function error(msg: string) { console.error(`❌ ${msg}`); }
export function heading(msg: string) { console.log(`\n${msg}\n${'─'.repeat(60)}`); }
```

### `cli/lib/config.ts` — Configuration
```typescript
export interface Config {
  baseUrl: string;
  programId: string | null;
  programName: string | null;
}

export async function resolveConfig(flags: Flags): Promise<Config> {
  const baseUrl = flags.baseUrl ?? process.env.SYMPHONIX_BASE_URL ?? 'https://tools.artsnwct.org';

  // Resolve program: by name or ID, or pick first
  const api = new ApiClient(baseUrl);
  const { programs } = await api.get('/api/programs');

  let program = null;
  if (flags.program) {
    program = programs.find(p => p.name === flags.program || p.id === flags.program);
    if (!program) throw new Error(`Program not found: ${flags.program}`);
  } else {
    program = programs[0];
  }

  return {
    baseUrl,
    programId: program?.id ?? null,
    programName: program?.name ?? null,
  };
}
```

### `cli/symphonix.ts` — Main Entry Point
```typescript
#!/usr/bin/env tsx

const [command, subcommand, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

// Route to command handler
switch (command) {
  case 'status':     return statusCmd(flags);
  case 'staff':      return staffCmd(subcommand, flags);
  case 'venues':     return venuesCmd(subcommand, flags);
  case 'events':     return eventsCmd(subcommand, flags);
  case 'tags':       return tagsCmd(subcommand, flags);
  case 'templates':  return templatesCmd(subcommand, flags);
  case 'programs':   return programsCmd(subcommand, flags);
  case 'reports':    return reportsCmd(subcommand, flags);
  case 'schedule':   return scheduleCmd(subcommand, flags);
  case 'conflicts':  return conflictsCmd(subcommand, flags);
  case 'export':     return exportCmd(subcommand, flags);
  case 'test':       return testCmd(subcommand, flags);
  case 'help':
  default:           return printHelp();
}
```

### Flag Parser
```typescript
function parseFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true; // boolean flag
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      // Positional arg — store as '_0', '_1', etc.
      const posIdx = Object.keys(flags).filter(k => k.startsWith('_')).length;
      flags[`_${posIdx}`] = arg;
    }
  }
  return flags;
}
```

---

## package.json Addition

```json
"scripts": {
  "symphonix": "tsx cli/symphonix.ts"
}
```

Usage: `npm run symphonix -- staff list --active`
Or directly: `npx tsx cli/symphonix.ts staff list --active`

---

## Execution Order

1. **Create file structure** — `cli/` directory with all files
2. **Build core** — `api.ts`, `format.ts`, `config.ts`, `symphonix.ts` (entry + flag parser + help)
3. **Build `status` command** — first working command, validates architecture
4. **Build data commands** — `staff`, `venues`, `tags`, `templates`, `programs`, `events`
5. **Build operations** — `schedule`, `conflicts`, `export`, `reports`
6. **Build test suites** — `test smoke`, `test full`
7. **Add to package.json** — `symphonix` script
8. **Test everything** — run each command, verify output
9. **Commit**

---

## Files Created (Complete List)

```
cli/
  symphonix.ts              ← ~80 lines: entry point, command router, help text
  lib/
    api.ts                  ← ~60 lines: HTTP client (get/post/patch/delete)
    format.ts               ← ~80 lines: table formatter, status icons, heading
    config.ts               ← ~40 lines: env loading, program resolution
  commands/
    status.ts               ← ~40 lines
    staff.ts                ← ~80 lines (list, add, get, delete)
    venues.ts               ← ~60 lines (list, add, get, delete)
    events.ts               ← ~100 lines (list, create, get, delete, cancel)
    tags.ts                 ← ~50 lines (list, add, delete)
    templates.ts            ← ~40 lines (list, get)
    programs.ts             ← ~60 lines (list, create, import)
    reports.ts              ← ~80 lines (summary, hours-by-tag, staff-hours, detail)
    schedule.ts             ← ~50 lines (validate, generate, clear, publish)
    conflicts.ts            ← ~30 lines (check)
    export.ts               ← ~50 lines (csv)
    test.ts                 ← ~120 lines (smoke, full)
```

**Total: ~15 files, ~940 lines estimated**

---

## Verification

After building, run these commands to verify:
```bash
npx tsx cli/symphonix.ts help
npx tsx cli/symphonix.ts status
npx tsx cli/symphonix.ts staff list
npx tsx cli/symphonix.ts venues list
npx tsx cli/symphonix.ts events list --week 2026-03-09
npx tsx cli/symphonix.ts tags list
npx tsx cli/symphonix.ts reports summary
npx tsx cli/symphonix.ts conflicts check --venue "smashatorium" --date 2026-03-10 --start 10:00 --end 11:00
npx tsx cli/symphonix.ts test smoke
```
