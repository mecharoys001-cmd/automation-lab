# Symphonix Scheduler — Event Template CSV Import Guide

## Overview

The event template CSV importer lets you bulk-create session templates from a spreadsheet. Files can include **comment rows** (lines starting with `#`) which are stripped automatically before parsing.

## Columns

| Column | Type | Format | Required | Valid Values / Notes |
|---|---|---|---|---|
| `name` | Text | — | No | Display name for the template |
| `day` | Text | Mon–Sun or 0–6 | **Yes** | Day of the week (case-insensitive; Sun/Monday/tue/3 all work) |
| `start_time` | Time | HH:MM | **Yes** | 24-hour format (e.g. `09:00`, `14:30`) |
| `end_time` | Time | HH:MM | **Yes** | Must be after `start_time` |
| `venue` | Text | — | No | Matched against existing venues (case-insensitive) |
| `instructor` | Text | — | No | Matched against existing staff members |
| `subjects` | Text | Semicolon-separated | No | Event types (e.g. `Piano;Theory`) |
| `grades` | Text | Semicolon-separated | No | Grade levels (e.g. `K;1st;2nd`) — valid: Pre-K, K, 1st–12th |
| `scheduling_mode` | Enum | — | No | `ongoing`, `date_range`, `duration`, `session_count` (defaults to `ongoing`) |
| `starts_on` | Date | YYYY-MM-DD | Mode-dependent | Start date for non-ongoing modes |
| `ends_on` | Date | YYYY-MM-DD | Mode-dependent | End date (required for `date_range`) |
| `duration_weeks` | Integer | — | Mode-dependent | Number of weeks (required for `duration`) |
| `session_count` | Integer | — | Mode-dependent | Number of events (required for `session_count`) |
| `within_weeks` | Integer | — | No | Time window for `session_count` mode |
| `week_cycle_length` | Integer | — | No | Total weeks in a rotation cycle |
| `week_in_cycle` | Integer | 0-indexed | No | Which week in the cycle this runs (0 = week 1) |
| `additional_tags` | Text | Semicolon-separated | No | Extra tags (e.g. `Performance;Holiday`) |

## Scheduling Modes

Choose the mode that matches how you want the template to generate events:

```
Which mode do I need?
│
├─ Events run every week for the whole program?
│  └─ Use: ongoing (or leave blank)
│
├─ Events run between specific dates?
│  └─ Use: date_range
│     Requires: starts_on, ends_on
│
├─ Events run for a fixed number of weeks?
│  └─ Use: duration
│     Requires: starts_on, duration_weeks
│
└─ I need a specific number of events?
   └─ Use: session_count
      Requires: session_count
      Optional: starts_on, within_weeks
```

### ongoing (default)

No extra fields needed. The template generates events every week for the entire program duration.

### date_range

Requires `starts_on` and `ends_on`. Events are generated weekly between those two dates (inclusive).

### duration

Requires `starts_on` and `duration_weeks`. Events are generated weekly starting from `starts_on` for the specified number of weeks.

### session_count

Requires `session_count`. Generates exactly that many events. Optionally provide `starts_on` (defaults to program start) and `within_weeks` (constrains the time window).

## Multi-Week Cycles

Use `week_cycle_length` and `week_in_cycle` for alternating or rotating schedules.

**Example: alternating A/B weeks**

- Template A: `week_cycle_length=2`, `week_in_cycle=0` — runs on odd weeks
- Template B: `week_cycle_length=2`, `week_in_cycle=1` — runs on even weeks

**Example: 3-week rotation**

- Week 1 template: `week_cycle_length=3`, `week_in_cycle=0`
- Week 2 template: `week_cycle_length=3`, `week_in_cycle=1`
- Week 3 template: `week_cycle_length=3`, `week_in_cycle=2`

The `week_in_cycle` field is 0-indexed: `0` = first week, `1` = second week, etc.

## Common Mistakes and Fixes

| Mistake | Symptom | Fix |
|---|---|---|
| Using commas inside subjects/grades | Columns shift, parse errors | Use **semicolons** to separate multiple values |
| Wrong time format (`9:00 AM`) | Validation error on start/end time | Use 24-hour format: `09:00`, `14:30` |
| Wrong date format (`03/25/2026`) | Validation error on dates | Use ISO format: `2026-03-25` |
| Missing required fields for mode | Validation error | Check which fields your scheduling mode requires (see decision tree above) |
| `end_time` before `start_time` | "Must be after start time" | Ensure end is later than start in 24-hour time |
| Spaces around semicolons | Values may not match | `Piano;Theory` works, `Piano; Theory` also works (trimmed automatically) |
| Excel saving as `.xlsx` | "Please upload a .csv file" | Save As → CSV (Comma delimited) from Excel |
| BOM characters in file | Usually handled automatically | The parser strips UTF-8 BOM; re-save as UTF-8 if issues persist |

## Full Example CSV

```csv
# SYMPHONIX EVENT TEMPLATE IMPORT
# ─────────────────────────────────
# REQUIRED: day (Mon-Sun), start_time (HH:MM), end_time (HH:MM)
# OPTIONAL: name, venue, instructor, subjects, grades
#
# SCHEDULING MODES:
#   ongoing        — Runs every week (default)
#   date_range     — Requires: starts_on, ends_on
#   duration       — Requires: starts_on, duration_weeks
#   session_count  — Requires: session_count, optional: starts_on, within_weeks
# ─────────────────────────────────
name,day,start_time,end_time,venue,instructor,subjects,grades,scheduling_mode,starts_on,ends_on,duration_weeks,session_count,within_weeks,week_cycle_length,week_in_cycle,additional_tags
Piano Lab,Monday,09:00,10:00,Classroom 101,John Smith,Piano,3rd;4th,ongoing,,,,,,,,
Strings,Tuesday,10:00,11:30,Stage,Jane Doe,Strings,5th;6th,date_range,2026-09-01,2026-12-15,,,,2,1,
Choir,Wednesday,13:00,14:00,Cafe,,Choral,K;1st;2nd,duration,2026-09-01,,12,,,,,Performance;Holiday
Guitar,Thursday,14:00,15:00,Classroom 101,,Guitar,7th;8th,session_count,2026-09-01,,,10,20,,,
```
