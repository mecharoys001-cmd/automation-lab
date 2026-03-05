# ⚠️ CALENDAR GRID WARNING

## DO NOT CHANGE THE 42-CELL GRID

The calendar components in `components/calendar/MonthView.tsx` and `components/calendar/YearView.tsx` use a **42-cell grid** (6 weeks × 7 days).

### Why 42 Cells?

Months don't always start on Sunday. Without empty cells before day 1, every month would appear to start on Sunday, which is mathematically impossible.

**Examples:**
- **March 2026** starts on Sunday → 0 empty cells, day 1 in Sunday column
- **April 2026** starts on Wednesday → 3 empty cells, then day 1 in Wednesday column
- **May 2026** starts on Friday → 5 empty cells, then day 1 in Friday column

### The Code Pattern

```typescript
{Array.from({ length: 42 }, (_, cellIndex) => {
  const dayNumber = cellIndex - firstDayOfWeek + 1;
  
  // Empty cell before month starts or after month ends
  if (dayNumber < 1 || dayNumber > daysInMonth) {
    return <div key={cellIndex} className="border-b border-slate-100 bg-slate-50/30" />;
  }
  
  // Actual day rendering...
})}
```

### ❌ NEVER Do This

```typescript
// WRONG! This breaks calendar alignment
{Array.from({ length: daysInMonth }, (_, i) => {
  const day = i + 1;
  // ...
})}
```

This pattern renders only days 1-31 without accounting for which day of the week the month starts on.

### History

- **2026-03-03:** Original implementation - worked correctly
- **2026-03-03:** Bug introduced - accidentally reverted to `daysInMonth`, broke alignment
- **2026-03-03:** Fixed again - restored 42-cell grid
- **2026-03-03:** Bug reintroduced - Claude Code worked from outdated version
- **2026-03-03:** Fixed again + added this warning file

### If You Need to Change Calendar Layout

1. **Test with multiple months** - Don't just check one month
2. **Verify April 2026** - Should start on Wednesday, not Sunday
3. **Check May 2026** - Should start on Friday, not Sunday
4. **The 42-cell grid is non-negotiable** - Find another way to achieve what you need

---

**Last updated:** 2026-03-04
**Last incident:** Calendar grid reverted to `daysInMonth` for the THIRD time, fixed again in both MonthView and YearView
