# Symphonix Scheduler — Terminology Audit & Fixes

**Date:** 2026-03-10  
**Status:** Proposed changes awaiting approval  
**Goal:** Eliminate ambiguous language and make the workflow clear

---

## Critical Issues Found

### 🔴 High Priority (Major Confusion)

#### 1. **Navigation: Two "Calendar" items**
**File:** `app/tools/scheduler/admin/layout.tsx` (lines 27, 32)

**Current:**
```
- Calendar           → /admin          (the session schedule)
- School Calendar    → /admin/calendar (holidays/special dates)
```

**Problem:** Users don't know which "Calendar" does what.

**Fix:**
```
- Session Calendar   → /admin          (or "Schedule")
- School Calendar    → /admin/calendar (keep as-is)
```

**Alternative naming:**
- "Schedule" / "School Calendar"
- "My Schedule" / "School Calendar"  
- "Class Sessions" / "School Calendar"

**Recommendation:** **"Schedule"** is clearest (single word, matches "Schedule Builder")

---

#### 2. **Schedule Builder: "Publish Schedule" button**
**File:** `app/tools/scheduler/admin/templates/page.tsx` (line 3151)

**Current:**
```tsx
{isPublishing ? 'Publishing…' : 'Publish Schedule'}
```

**Problem:** "Publish" sounds like it makes sessions visible to staff. Actually, it GENERATES calendar sessions.

**Fix:**
```tsx
{isGenerating ? 'Generating…' : 'Create Schedule'}
```

**Also update:**
- Line 3048 tooltip: Change "Publish Schedule to generate calendar sessions" → "Click Create Schedule to generate calendar sessions"
- Line 3779 modal title: "Publish Schedule" → "Create Schedule"
- Variable names: `isPublishing` → `isGenerating`, `handlePublishSchedule` → `handleCreateSchedule`

---

#### 3. **Calendar Page: "Auto-Generate Calendar" button**
**File:** `app/tools/scheduler/admin/page.tsx` (line 1114)

**Current:**
```tsx
{isGenerating ? 'Previewing...' : 'Auto-Generate Calendar'}
```

**Problem:** You're already ON the calendar page, so "generate calendar" is confusing. It's generating SESSIONS.

**Fix:**
```tsx
{isGenerating ? 'Previewing...' : 'Generate Sessions'}
```

**Tooltip update:**
- Line 1109: "Preview and generate a draft schedule using templates" → "Generate draft sessions from your weekly template"

---

### 🟡 Medium Priority (Moderate Confusion)

#### 4. **Schedule Builder: "Your Schedule" sidebar heading**
**File:** `app/tools/scheduler/admin/templates/page.tsx` (line 3287)

**Current:**
```tsx
<h2>Your Schedule</h2>
```

**Problem:** Ambiguous — this is the template list, not the calendar schedule.

**Fix:**
```tsx
<h2>Your Templates</h2>
```

or

```tsx
<h2>Event Templates</h2>
```

---

#### 5. **Schedule Builder: "Clear Schedule" button**
**File:** `app/tools/scheduler/admin/templates/page.tsx` (line 3122)

**Current:**
```
Clear Schedule
```

**Problem:** Sounds like it deletes calendar sessions. Actually clears template placements from the grid.

**Fix:**
```
Clear Grid
```

or

```
Reset Template Grid
```

**Also update modal title (line 3813):**
```
Clear Schedule → Clear Template Grid
```

---

#### 6. **Schedule Builder: "Auto-Fill Schedule" modal**
**File:** `app/tools/scheduler/admin/templates/page.tsx` (line 1049)

**Current:**
```tsx
<h2>Auto-Fill Schedule</h2>
```

**Problem:** "Schedule" is ambiguous here.

**Fix:**
```tsx
<h2>Auto-Fill Template Grid</h2>
```

or

```tsx
<h2>Auto-Place Templates</h2>
```

---

#### 7. **Onboarding: "Build your schedule" step**
**File:** `app/tools/scheduler/components/OnboardingChecklist.tsx` (line 101)

**Current:**
```
title: 'Build your schedule',
description: 'Create event templates and place them on the weekly grid',
```

**Problem:** "Build your schedule" could mean the calendar. The description clarifies, but the title is misleading.

**Fix:**
```
title: 'Build your weekly template',
description: 'Create event templates and arrange them on the weekly grid',
```

---

### 🟢 Low Priority (Minor Improvements)

#### 8. **Navigation tooltip: "Build weekly schedule templates"**
**File:** `app/tools/scheduler/admin/layout.tsx` (line 28)

**Current:**
```
tooltip: 'Build weekly schedule templates and configure day times'
```

**Problem:** "Schedule templates" is redundant (templates are already for scheduling).

**Fix:**
```
tooltip: 'Arrange event templates on a weekly grid to plan your ideal week'
```

---

#### 9. **Event Templates tooltip**
**File:** `app/tools/scheduler/admin/layout.tsx` (line 29)

**Current:**
```
tooltip: 'Create and manage event templates for scheduling'
```

**Fix:**
```
tooltip: 'Define class/session templates with instructors, times, and venues'
```

---

#### 10. **Calendar page: Export menu labels**
**File:** `app/tools/scheduler/admin/page.tsx` (lines 1068, 1077)

**Current:**
```
Export Weekly Schedule (CSV)
Export Monthly Schedule (CSV)
```

**Optional improvement:**
```
Export This Week's Sessions (CSV)
Export This Month's Sessions (CSV)
```

---

## Summary of Changes

| Location | Current Label | Recommended Fix |
|----------|--------------|-----------------|
| **Navigation** | Calendar | **Schedule** |
| **Navigation** | School Calendar | School Calendar (keep) |
| **Schedule Builder button** | Publish Schedule | **Create Schedule** |
| **Schedule Builder tooltip** | "Click Publish Schedule..." | "Click Create Schedule..." |
| **Schedule Builder modal** | Publish Schedule | **Create Schedule** |
| **Schedule Builder sidebar** | Your Schedule | **Your Templates** |
| **Schedule Builder button** | Clear Schedule | **Clear Grid** |
| **Schedule Builder modal** | Auto-Fill Schedule | **Auto-Fill Grid** |
| **Calendar button** | Auto-Generate Calendar | **Generate Sessions** |
| **Calendar tooltip** | "...generate a draft schedule..." | "...generate draft sessions..." |
| **Onboarding step** | Build your schedule | **Build your weekly template** |

---

## Consistent Vocabulary to Use

| Term | Use For | Avoid Using For |
|------|---------|-----------------|
| **Event Template** | Individual class blueprint (Piano, Strings, etc.) | ✅ Correct |
| **Weekly Template** / **Template Grid** | The visual grid where you place templates | "Schedule", "Weekly Schedule" |
| **Sessions** | Real dated calendar events (Oct 15 @ 9 AM) | "Events", "Calendar entries" |
| **Schedule** | The collection of sessions (calendar view) | The template grid, individual templates |
| **Generate** | Creating sessions from templates | "Publish", "Create calendar" |
| **Publish** | Making sessions visible to staff | Generating sessions |

---

## Implementation Plan

### Phase 1: Critical Fixes (High Priority)
1. Rename navigation "Calendar" → "Schedule"
2. Change "Publish Schedule" → "Create Schedule" in Schedule Builder
3. Change "Auto-Generate Calendar" → "Generate Sessions" on Calendar page

### Phase 2: Medium Priority
4. Update sidebar "Your Schedule" → "Your Templates"
5. Update "Clear Schedule" → "Clear Grid"
6. Update "Auto-Fill Schedule" → "Auto-Fill Grid"
7. Fix onboarding step title

### Phase 3: Polish (Low Priority)
8-10. Tooltip improvements

---

## Questions for Stakeholders

1. **Navigation item naming:** Do you prefer:
   - "Schedule" (simple, matches "Schedule Builder")
   - "Session Calendar" (explicit, but longer)
   - "My Schedule" (friendly, but less formal)

2. **"Create Schedule" vs "Generate Schedule":**
   - "Create" = implies human authorship
   - "Generate" = implies automation
   - Which feels right for the Schedule Builder → Calendar action?

3. **Should we add any help icons (?)** next to ambiguous terms that open tooltips explaining the workflow?

---

**Next Step:** Get approval from Ethan/ROY, then implement via Claude Code.
