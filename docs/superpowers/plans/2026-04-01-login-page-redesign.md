# Login Page Redesign — Two Clear Auth Paths

**Created:** 2026-04-01
**Status:** Draft — awaiting approval
**Branch:** `feature/login-redesign`

## Problem

The current login page shows Google OAuth and email/password fields side-by-side with a small "— or —" divider. Users with Google accounts type their Gmail into the email field instead of clicking "Sign in with Google", which either fails (no password account exists) or creates a duplicate account.

## Solution

Replace the inline email/password fields with a **"Sign in with Email" button** that expands into a separate view/step when clicked. The login page becomes two clear, equal-weight buttons:

1. 🔵 **Sign in with Google** (primary — most users)
2. ✉️ **Sign in with Email** (secondary — expands to email/password form)

## Design

### Default State (Step 1)
```
┌──────────────────────────┐
│      ⚡ Automation Lab    │
│     NWCT Arts Council     │
│  Sign in to access tools  │
│                           │
│  [G] Sign in with Google  │  ← Primary button, full width
│                           │
│        — or —             │
│                           │
│  [✉] Sign in with Email  │  ← Secondary button, outlined style
│                           │
│      ← Back to home       │
└──────────────────────────┘
```

### Expanded State (Step 2 — after clicking "Sign in with Email")
```
┌──────────────────────────┐
│      ⚡ Automation Lab    │
│     NWCT Arts Council     │
│                           │
│  ← Back to sign in        │  ← Returns to Step 1
│                           │
│  [ Email address       ]  │
│  [ Password            ]  │
│                           │
│  [Sign In]  [Sign Up]     │
│                           │
│  Error message area        │
│                           │
│  Confirmation message      │
│  (after sign up)           │
└──────────────────────────┘
```

## Implementation

### Task 1: Add view state
- Add `view` state: `'buttons'` (default) or `'email'`
- When `view === 'buttons'`: show Google + Email buttons
- When `view === 'email'`: show email/password form with back button

### Task 2: Restyle buttons
- Google button: keep current style (white bg, Google icon, border)
- Email button: similar weight but outlined style (teal border, envelope icon)
- Both full-width, same height, clearly clickable

### Task 3: Email form view
- "← Back to sign in options" link at top
- Same email/password fields as current
- Same Sign In / Sign Up buttons
- Same error handling
- Same sign-up success message

### Task 4: Preserve functionality
- All existing auth logic unchanged
- `handleGoogle()`, `handleSignIn()`, `handleSignUp()` stay the same
- `next` param redirect preserved
- Loading/disabled states preserved

## Files Modified

- `app/login/page.tsx` — single file change

## Risk Assessment

**Very low risk.** Pure UI change to one page. No auth logic changes. No API changes. No middleware changes.
