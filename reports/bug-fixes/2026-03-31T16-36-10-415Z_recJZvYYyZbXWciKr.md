# Bug Fix Report: recJZvYYyZbXWciKr

**Priority:** High
**Page:** Calendar
**Decision:** fixed
**Category:** UNCATEGORIZED

## Feedback
PROBLEM: The app's primary teal color rgb(18, 130, 162) fails WCAG AA contrast on both white and light green backgrounds. On white it scores 4.43:1 and on the green onboarding background rgb(236, 253, 245) it scores 4.21:1. The minimum for normal-size text is 4.5:1.

HOW TO FIX:
1. Open your Tailwind config (or global CSS) and find the teal/primary color value #1282A2 (which is rgb(18,130,162)).
2. Darken it slightly to pass 4.5:1. Change it to #0F7490 (rgb(15,116,144)) or darker. You can verify at https://webaim.org/resources/contrastchecker/ by entering the foreground color and #FFFFFF as background.
3. Also check the green onboarding panel background. If you keep rgb(236,253,245) as the background, the foreground needs to be at least #0E6D88 to pass 4.5:1 on that surface.
4. After updating, search the codebase for any hardcoded references to #1282A2 or the old teal value and update those too.

WHAT I WILL CHECK: I will compute the contrast ratio of the primary link/action color against white and against the onboarding background. Both must be >= 4.5:1.

---
QA NOTE (2026-03-31): NOT FIXED. Primary teal link color rgb(18, 130, 162) vs white has contrast ratio 4.43:1, failing WCAG AA (needs 4.5:1). Blue-500 action color rgb(59, 130, 246) vs white has ratio 3.68:1, also failing AA. Sidebar inactive items use rgb(241, 245, 249) which is extremely low contrast.

## Analysis
Bug fixed and deployed

## Fix Result
**Success:** Yes

### Changes
- Delegated to Claude Code
- Output: All clean. Here's a summary of what was changed:

**Primary teal color (WCAG AA fix):**
- `--color-teal` in `globals.css`: `#1282a2` → `#0F7490` (contrast on white: ~4.90:1, on green onboarding bg: ~4...




---
*Generated: 2026-03-31T16:36:10.415Z*
