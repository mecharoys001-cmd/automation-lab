# Enhanced Analytics & Activity Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive activity tracking to the Automation Lab — login events, per-user tool usage, completion rates, time-on-tool, repeat usage metrics, error tracking — and surface it all in an admin activity feed on the Impact Dashboard.

**Architecture:** Extend the existing `tool_usage` table with `user_email` population. Add a new `activity_log` table for login/session events. Enhance the client-side tracking helper to capture timing, completion, and errors. Build a tabbed Impact Dashboard with a real-time activity feed alongside the existing stats view. All tracking endpoints require authentication; user identity is always derived from the server session (never trusted from the client). Only aggregate public stats are exposed without auth.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + service client), existing RBAC middleware, TypeScript.

---

## File Structure

```
# New files
supabase/migrations/20260326_activity_log_and_tracking.sql  — Migration: activity_log table + tool_usage user_email index
types/activity.ts                                            — TypeScript interfaces for activity events
app/api/activity/log/route.ts                                — POST endpoint: log login/session events
app/api/activity/feed/route.ts                               — GET endpoint: admin-only activity feed (paginated)
app/tools/admin/impact/ActivityFeed.tsx                       — Client component: real-time activity feed UI
app/tools/admin/impact/TabNav.tsx                             — Tab navigation: Stats | Activity Feed

# Modified files
middleware.ts                                                — Remove public exception for /tools/reports; all tools require auth
app/api/auth/login/route.ts                                  — Log login event on successful email/password auth (server-side insert)
app/auth/callback/route.ts                                   — Log login event on successful OAuth callback (server-side insert)
app/api/usage/track/route.ts                                 — Require auth, populate user_email from session, add timing/completion/error
app/api/usage/stats/route.ts                                 — Add repeat usage + completion rate stats
lib/usage-tracking.ts                                        — Add startTimer(), completeUsage(), trackError()
components/CsvDedupTool.tsx                                  — Instrument with start/complete/error tracking
app/tools/reports/page.tsx                                   — Instrument with start/complete/error tracking
app/tools/admin/impact/page.tsx                              — Add tab navigation
app/tools/admin/impact/ImpactDashboard.tsx                   — Add completion rate + repeat user columns
types/usage.ts                                               — Extend TrackUsagePayload with timing/status fields
```

---

### Task 0: Security Hardening — Require Auth for All Tools + Protect APIs

**Files:**
- Modify: `middleware.ts`
- Modify: `app/api/activity/log/route.ts` (created in Task 3 — include auth from the start)
- Modify: `app/api/usage/track/route.ts`
- Modify: `app/api/usage/summary/route.ts`

The existing middleware allows unauthenticated access to `/tools/reports` and `/tools/scheduler/intake`. Now that we're collecting user emails, durations, IPs, and tool usage data, all tools should require login so we know WHO is using them. The public-facing homepage savings bar will still work because `/api/usage/summary` returns only anonymous aggregate numbers.

**Security model:**
- **All `/tools/*` routes** → require authenticated user (remove public exceptions for `/tools/reports`)
- **`/tools/scheduler/intake`** → stays public (it's a form for external users, not a tool)
- **`/api/usage/track`** → require authenticated user (captures user_email from session)
- **`/api/usage/summary`** → stays public (only returns aggregate totals, no PII)
- **`/api/usage/stats`** → admin only (already protected)
- **`/api/usage/config`** → admin only (already protected)
- **`/api/activity/log`** → server-side only; called from auth routes, not from client. Add origin validation or make it internal-only by checking a server secret.
- **`/api/activity/feed`** → admin only (already in Task 4)
- **`/tools/admin/*`** → admin only (already protected)
- **All activity_log and tool_usage data** → accessed only via service client (RLS enabled, no public policies)

- [ ] **Step 1: Remove the public exception for `/tools/reports`**

In `middleware.ts`, remove or comment out:
```typescript
// DELETE THIS BLOCK:
// ── Allow unauthenticated access to reports visualizer ─────────────────
if (path.startsWith('/tools/reports')) {
  return supabaseResponse
}
```

This means `/tools/reports` will now redirect to `/login` for unauthenticated users, same as all other tools.

- [ ] **Step 2: Make `/api/activity/log` internal-only**

The activity log endpoint is called server-side from auth routes, not from the browser. Add a check for an internal header or simply make the insert happen inline in the auth routes (no separate API call needed). The safer approach: remove the public endpoint entirely and have auth routes insert directly via the service client. Task 3 will be updated to reflect this — the `/api/activity/log` route will require auth and only accept `tool_open` events from the client. Login events will be inserted directly by the auth routes.

- [ ] **Step 3: Add rate limiting headers to tracking endpoints**

Add a basic check to `/api/usage/track` to prevent abuse:
```typescript
// At the top of the POST handler:
const rateLimitKey = user?.email || request.headers.get('x-forwarded-for') || 'unknown';
// Store in metadata for downstream analysis; actual rate limiting can be added via Vercel Edge Config or middleware later
```

- [ ] **Step 4: Ensure `/api/usage/track` always captures `user_email` from the session**

Never trust client-provided `user_email`. Always override with the authenticated session:
```typescript
// In the insert:
user_email: user.email,  // From Supabase auth session, NOT from request body
user_id: user.id,        // Same
```

- [ ] **Step 5: Verify no PII leaks in public endpoints**

Confirm `/api/usage/summary` returns ONLY:
```json
{ "total_uses": 42, "total_hours_saved": 12.5 }
```
No user emails, no IP addresses, no individual events.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts
git commit -m "security: require auth for all tools, protect tracking APIs"
```

---

### Task 1: Database Schema — activity_log table + tool_usage enhancements

**Files:**
- Create: `supabase/migrations/20260326_activity_log_and_tracking.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Activity log: captures login events and session-level actions
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,               -- 'login', 'logout', 'tool_open', 'tool_complete', 'tool_error'
  user_email TEXT,                         -- From auth, NULL for anonymous
  user_id UUID,                            -- Supabase auth user id
  tool_id TEXT,                            -- NULL for non-tool events
  metadata JSONB DEFAULT '{}',            -- Flexible: { auth_method: 'google', browser: '...', duration_seconds: 45 }
  ip_address TEXT,                         -- For geographic analysis later
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX idx_activity_log_user_email ON activity_log(user_email);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_activity_log_tool_id ON activity_log(tool_id);

-- Enable RLS (service client bypasses)
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Enhance tool_usage: add user tracking + completion + timing
-- ============================================================
ALTER TABLE tool_usage ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE tool_usage ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';  -- 'started', 'completed', 'error', 'abandoned'
ALTER TABLE tool_usage ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(10,1);  -- Time from open to completion
ALTER TABLE tool_usage ADD COLUMN IF NOT EXISTS error_message TEXT;               -- Capture what went wrong

CREATE INDEX IF NOT EXISTS idx_tool_usage_user_email ON tool_usage(user_email);
CREATE INDEX IF NOT EXISTS idx_tool_usage_status ON tool_usage(status);
CREATE INDEX IF NOT EXISTS idx_tool_usage_user_id ON tool_usage(user_id);
```

- [ ] **Step 2: Provide migration to user to run in Supabase SQL Editor**

The user must run this SQL in their Supabase dashboard SQL Editor (direct DB connection is not available from this machine).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260326_activity_log_and_tracking.sql
git commit -m "feat: add activity_log table and tool_usage tracking columns"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `types/activity.ts`
- Modify: `types/usage.ts`

- [ ] **Step 1: Create activity types**

```typescript
// types/activity.ts

export type ActivityEventType =
  | 'login'
  | 'logout'
  | 'tool_open'
  | 'tool_complete'
  | 'tool_error';

export interface ActivityLogEvent {
  id: string;
  event_type: ActivityEventType;
  user_email: string | null;
  user_id: string | null;
  tool_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityFeedItem {
  id: string;
  event_type: ActivityEventType;
  user_email: string | null;
  tool_id: string | null;
  tool_name: string | null;      // Joined from tool_config
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 2: Extend usage types**

Add to `types/usage.ts`:

```typescript
export type UsageStatus = 'started' | 'completed' | 'error' | 'abandoned';

export interface TrackUsagePayload {
  tool_id: string;
  content_hash?: string;
  metadata?: Record<string, unknown>;
  status?: UsageStatus;           // NEW: track completion state
  duration_seconds?: number;      // NEW: time on tool
  error_message?: string;         // NEW: error details
  usage_session_id?: string;      // NEW: correlate start/complete events
}
```

Also add to `ToolUsageStats`:

```typescript
export interface ToolUsageStats {
  // ... existing fields ...
  unique_users: number;           // NEW: distinct user_email count
  repeat_users: number;           // NEW: users with 2+ uses
  completion_rate: number;        // NEW: completed / (completed + error + abandoned)
  avg_duration_seconds: number;   // NEW: average time on tool
}
```

- [ ] **Step 3: Commit**

```bash
git add types/activity.ts types/usage.ts
git commit -m "feat: add activity and enhanced usage types"
```

---

### Task 3: Activity Log API — Auth-Protected Log Events

**Files:**
- Create: `app/api/activity/log/route.ts`

This endpoint accepts only `tool_open` events from authenticated browser clients. Login events are inserted directly by auth routes (server-side, no API call) to prevent spoofing.

- [ ] **Step 1: Create the auth-protected log endpoint**

```typescript
// app/api/activity/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';

// Only tool_open events accepted from client; login events are server-side only
const CLIENT_ALLOWED_EVENTS = ['tool_open'];

export async function POST(request: NextRequest) {
  try {
    // REQUIRE authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, tool_id, metadata } = body;

    if (!event_type || !CLIENT_ALLOWED_EVENTS.includes(event_type)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    const svc = createServiceClient();

    // NEVER trust client-provided user info — always use session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('activity_log') as any).insert({
      event_type,
      user_email: user.email,        // From auth session, NOT request body
      user_id: user.id,              // From auth session, NOT request body
      tool_id: tool_id || null,
      metadata: metadata || {},
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
    });

    if (error) {
      console.error('[activity-log] Insert failed:', error);
      return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[activity-log] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/activity/log/route.ts
git commit -m "feat: add auth-protected POST /api/activity/log endpoint"
```

---

### Task 4: Activity Feed API — Admin-Only Paginated Feed

**Files:**
- Create: `app/api/activity/feed/route.ts`

- [ ] **Step 1: Create the feed endpoint**

```typescript
// app/api/activity/feed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getOrgMembership, isAdmin } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    // Admin-only
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const membership = await getOrgMembership(user.email);
    if (!isAdmin(membership)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const pageSize = parseInt(request.nextUrl.searchParams.get('pageSize') || '50');
    const eventFilter = request.nextUrl.searchParams.get('event_type');
    const offset = (page - 1) * pageSize;

    const svc = createServiceClient();

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (svc.from('activity_log') as any)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (eventFilter) {
      query = query.eq('event_type', eventFilter);
    }

    const { data: items, count, error } = await query;

    if (error) throw error;

    // Enrich with tool names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs } = await (svc.from('tool_config') as any)
      .select('tool_id, display_name');

    const toolNameMap: Record<string, string> = {};
    for (const c of configs || []) {
      toolNameMap[c.tool_id] = c.display_name;
    }

    const enrichedItems = (items || []).map((item: Record<string, unknown>) => ({
      ...item,
      tool_name: item.tool_id ? toolNameMap[item.tool_id as string] || item.tool_id : null,
    }));

    // Also pull recent tool_usage events for the feed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentUsage } = await (svc.from('tool_usage') as any)
      .select('id, tool_id, user_email, status, duration_seconds, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(pageSize);

    const usageAsActivity = (recentUsage || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      event_type: u.status === 'error' ? 'tool_error' : 'tool_complete',
      user_email: u.user_email,
      tool_id: u.tool_id,
      tool_name: u.tool_id ? toolNameMap[u.tool_id as string] || u.tool_id : null,
      metadata: {
        ...(u.metadata as Record<string, unknown> || {}),
        duration_seconds: u.duration_seconds,
        status: u.status,
      },
      created_at: u.created_at,
    }));

    // Merge and sort both streams by created_at
    const allItems = [...enrichedItems, ...usageAsActivity]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, pageSize);

    return NextResponse.json({
      items: allItems,
      total: (count || 0) + (recentUsage?.length || 0),
      page,
      pageSize,
    });
  } catch (err) {
    console.error('[activity-feed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/activity/feed/route.ts
git commit -m "feat: add GET /api/activity/feed admin endpoint with pagination"
```

---

### Task 5: Instrument Auth — Track Logins

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/auth/callback/route.ts`

- [ ] **Step 1: Add login tracking to email/password auth**

In `app/api/auth/login/route.ts`, after the successful `signInWithPassword` call (before the success response), add a fire-and-forget activity log:

```typescript
// After: const { error } = await supabase.auth.signInWithPassword(...)
// Before: return NextResponse.json({ success: true })

// Fire-and-forget login tracking
const { createServiceClient: createSvc } = await import('@/lib/supabase-service');
const svc = createSvc();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(svc.from('activity_log') as any)
  .insert({
    event_type: 'login',
    user_email: email,
    metadata: { auth_method: 'email_password' },
    user_agent: request.headers.get('user-agent') || null,
    ip_address: request.headers.get('x-forwarded-for') || null,
  })
  .then(({ error: logErr }: { error: unknown }) => {
    if (logErr) console.error('[activity-log] Login tracking failed:', logErr);
  });
```

- [ ] **Step 2: Add login tracking to OAuth callback**

In `app/auth/callback/route.ts`, after `exchangeCodeForSession` succeeds and before the redirect, add:

```typescript
// After: const { error } = await supabase.auth.exchangeCodeForSession(code)
// Inside the !error block, before the redirect:

const { data: { user: authUser } } = await supabase.auth.getUser();
const { createServiceClient: createSvc } = await import('@/lib/supabase-service');
const svc = createSvc();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(svc.from('activity_log') as any)
  .insert({
    event_type: 'login',
    user_email: authUser?.email || null,
    user_id: authUser?.id || null,
    metadata: { auth_method: 'google_oauth' },
    user_agent: request.headers.get('user-agent') || null,
    ip_address: request.headers.get('x-forwarded-for') || null,
  })
  .then(({ error: logErr }: { error: unknown }) => {
    if (logErr) console.error('[activity-log] OAuth login tracking failed:', logErr);
  });
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/login/route.ts app/auth/callback/route.ts
git commit -m "feat: track login events in activity_log"
```

---

### Task 6: Enhanced Client-Side Tracking Helper

**Files:**
- Modify: `lib/usage-tracking.ts`

- [ ] **Step 1: Add timer, completion, and error tracking functions**

Replace `lib/usage-tracking.ts` with:

```typescript
// lib/usage-tracking.ts
'use client';

/**
 * Generate a SHA-256 hash of CSV content for deduplication.
 */
export async function hashCSVContent(csvText: string): Promise<string> {
  const sample = csvText.slice(0, 10240);
  const encoder = new TextEncoder();
  const data = encoder.encode(sample);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Session ID for correlating start/complete events
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Start tracking a tool usage session. Returns a session object with
 * complete() and error() methods for lifecycle tracking.
 */
export function startToolSession(toolId: string) {
  const sessionId = generateSessionId();
  const startTime = Date.now();

  // Log the "tool opened" event
  fetch('/api/activity/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'tool_open',
      tool_id: toolId,
      metadata: { usage_session_id: sessionId },
    }),
  }).catch(() => {});

  return {
    sessionId,

    /**
     * Mark the tool usage as completed successfully.
     */
    complete(options?: {
      contentHash?: string;
      metadata?: Record<string, unknown>;
    }): void {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          content_hash: options?.contentHash,
          status: 'completed',
          duration_seconds: durationSeconds,
          usage_session_id: sessionId,
          metadata: {
            ...options?.metadata,
            duration_seconds: durationSeconds,
          },
        }),
      }).catch((err) => {
        console.warn('[usage-tracking] Failed to track completion:', err);
      });
    },

    /**
     * Mark the tool usage as failed with an error.
     */
    error(errorMessage: string, metadata?: Record<string, unknown>): void {
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          status: 'error',
          duration_seconds: durationSeconds,
          error_message: errorMessage,
          usage_session_id: sessionId,
          metadata: {
            ...metadata,
            duration_seconds: durationSeconds,
            error: errorMessage,
          },
        }),
      }).catch((err) => {
        console.warn('[usage-tracking] Failed to track error:', err);
      });
    },
  };
}

/**
 * Simple fire-and-forget tracking (backward compatible).
 * Use startToolSession() for full lifecycle tracking.
 */
export function trackToolUsage(
  toolId: string,
  options?: {
    contentHash?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  fetch('/api/usage/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool_id: toolId,
      content_hash: options?.contentHash,
      status: 'completed',
      metadata: options?.metadata,
    }),
  }).catch((err) => {
    console.warn('[usage-tracking] Failed to track:', err);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/usage-tracking.ts
git commit -m "feat: enhanced tracking helper with session lifecycle (start/complete/error)"
```

---

### Task 7: Update Track API — Accept Enhanced Fields

**Files:**
- Modify: `app/api/usage/track/route.ts`

- [ ] **Step 1: Update the track endpoint to accept and store new fields**

Update the endpoint to:
1. Accept `status`, `duration_seconds`, `error_message`, `usage_session_id` from the request body
2. Populate `user_email` and `user_id` from the authenticated user (if present)
3. Allow unauthenticated tracking (the tools page is public) — make auth optional
4. Insert the new columns into `tool_usage`

Key changes to the insert:

```typescript
// Extract new fields from body
const { tool_id, content_hash, metadata, status, duration_seconds, error_message, usage_session_id } = body;

// Get user info if authenticated (optional — don't require auth)
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// Insert with enhanced fields
const { error } = await (svc.from('tool_usage') as any).insert({
  tool_id,
  content_hash: content_hash || null,
  user_email: user?.email || null,
  user_id: user?.id || null,
  status: status || 'completed',
  duration_seconds: duration_seconds || null,
  error_message: error_message || null,
  metadata: {
    ...metadata,
    usage_session_id: usage_session_id || null,
  },
});
```

Also remove the auth requirement (make it optional) since tools are publicly accessible.

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/track/route.ts
git commit -m "feat: track endpoint accepts user info, status, duration, errors"
```

---

### Task 8: Update Stats API — Add Repeat Users & Completion Rates

**Files:**
- Modify: `app/api/usage/stats/route.ts`

- [ ] **Step 1: Add new stat calculations per tool**

For each tool, after getting the usage count, also query:

```typescript
// Unique users (distinct user_email, excluding null)
const { data: uniqueData } = await (svc.from('tool_usage') as any)
  .select('user_email')
  .eq('tool_id', config.tool_id)
  .not('user_email', 'is', null);

const uniqueEmails = new Set((uniqueData || []).map((r: { user_email: string }) => r.user_email));
const uniqueUsers = uniqueEmails.size;

// Repeat users (user_email appearing 2+ times)
const emailCounts: Record<string, number> = {};
for (const r of uniqueData || []) {
  emailCounts[r.user_email] = (emailCounts[r.user_email] || 0) + 1;
}
const repeatUsers = Object.values(emailCounts).filter(c => c >= 2).length;

// Completion rate
const { count: completedCount } = await (svc.from('tool_usage') as any)
  .select('*', { count: 'exact', head: true })
  .eq('tool_id', config.tool_id)
  .eq('status', 'completed');

const { count: errorCount } = await (svc.from('tool_usage') as any)
  .select('*', { count: 'exact', head: true })
  .eq('tool_id', config.tool_id)
  .eq('status', 'error');

const totalAttempts = (completedCount || 0) + (errorCount || 0);
const completionRate = totalAttempts > 0 ? Math.round(((completedCount || 0) / totalAttempts) * 100) : 100;

// Average duration
const { data: durationData } = await (svc.from('tool_usage') as any)
  .select('duration_seconds')
  .eq('tool_id', config.tool_id)
  .not('duration_seconds', 'is', null);

const durations = (durationData || []).map((d: { duration_seconds: number }) => d.duration_seconds);
const avgDuration = durations.length > 0
  ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
  : 0;
```

Include these in the response:

```typescript
stats.push({
  // ... existing fields ...
  unique_users: uniqueUsers,
  repeat_users: repeatUsers,
  completion_rate: completionRate,
  avg_duration_seconds: avgDuration,
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/stats/route.ts
git commit -m "feat: stats endpoint returns unique users, repeat users, completion rates"
```

---

### Task 9: Instrument Tools — CSV Deduplicator

**Files:**
- Modify: `components/CsvDedupTool.tsx`

- [ ] **Step 1: Add session lifecycle tracking**

At the top of the file, import the new helper:
```typescript
import { startToolSession, hashCSVContent } from '@/lib/usage-tracking';
```

Find where the component initializes or where a file is first selected/uploaded. Create a session ref:
```typescript
const toolSession = useRef<ReturnType<typeof startToolSession> | null>(null);
```

When the user selects/uploads a file (beginning of the dedup process):
```typescript
toolSession.current = startToolSession('csv-dedup');
```

On successful dedup completion (where `trackToolUsage` was previously called), replace with:
```typescript
hashCSVContent(rawCsvText).then((hash) => {
  toolSession.current?.complete({
    contentHash: hash,
    metadata: { total_rows: totalRows, duplicates_found: duplicateCount },
  });
});
```

On any parse error or failure:
```typescript
toolSession.current?.error(errorMessage);
```

- [ ] **Step 2: Commit**

```bash
git add components/CsvDedupTool.tsx
git commit -m "feat: CSV dedup tracks session lifecycle (start/complete/error)"
```

---

### Task 10: Instrument Tools — Transaction Reports

**Files:**
- Modify: `app/tools/reports/page.tsx`

- [ ] **Step 1: Add session lifecycle tracking**

Same pattern as CSV Dedup:
- Import `startToolSession` and `hashCSVContent`
- Create a `toolSession` ref
- Start session when file is selected
- Complete with hash on successful parse
- Error on parse failure

Replace the existing `hashCSVContent → trackToolUsage` call with:
```typescript
// In processFile, when file is selected:
toolSession.current = startToolSession('reports');

// On successful parse:
hashCSVContent(text).then((hash) => {
  toolSession.current?.complete({
    contentHash: hash,
    metadata: { total_orders: parsed.totalOrders, file_name: file.name },
  });
});

// On error:
toolSession.current?.error(err instanceof Error ? err.message : 'Parse failed');
```

- [ ] **Step 2: Commit**

```bash
git add app/tools/reports/page.tsx
git commit -m "feat: Transaction Reports tracks session lifecycle"
```

---

### Task 11: Activity Feed UI Component

**Files:**
- Create: `app/tools/admin/impact/ActivityFeed.tsx`

- [ ] **Step 1: Create the activity feed component**

Build a client component that:
- Fetches from `/api/activity/feed?page=1&pageSize=50`
- Displays events in a chronological list with:
  - Colored icon per event type (login=blue, tool_complete=green, tool_error=red, tool_open=gray)
  - User email (or "Anonymous")
  - Event description (e.g., "Logged in via Google", "Used CSV Deduplicator", "Error in Transaction Reports")
  - Relative timestamp ("2 minutes ago", "1 hour ago")
  - Duration badge for tool completions ("took 45s")
- Filter buttons: All | Logins | Tool Usage | Errors
- Load More button for pagination
- Auto-refreshes every 30 seconds
- Light theme matching the rest of the dashboard

Style: white cards on light background, teal accents, compact rows (~48px per event).

- [ ] **Step 2: Commit**

```bash
git add app/tools/admin/impact/ActivityFeed.tsx
git commit -m "feat: admin activity feed component with filters and pagination"
```

---

### Task 12: Tab Navigation for Impact Dashboard

**Files:**
- Create: `app/tools/admin/impact/TabNav.tsx`
- Modify: `app/tools/admin/impact/page.tsx`
- Modify: `app/tools/admin/impact/ImpactDashboard.tsx`

- [ ] **Step 1: Create tab navigation component**

Simple tab bar with two tabs: "Impact Stats" and "Activity Feed". Uses React state to switch between views.

```typescript
// TabNav.tsx
'use client';
interface TabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}
export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const tabs = [
    { id: 'stats', label: 'Impact Stats' },
    { id: 'feed', label: 'Activity Feed' },
  ];
  // Render horizontal tabs with teal active indicator
}
```

- [ ] **Step 2: Update page.tsx to render tabs + conditional content**

Make `page.tsx` a client component wrapper that manages tab state and renders either `ImpactDashboard` or `ActivityFeed`.

- [ ] **Step 3: Add unique users, repeat users, completion rate to ImpactDashboard**

In `ImpactDashboard.tsx`, add columns/rows to each tool's card showing:
- Unique users count
- Repeat users count
- Completion rate percentage
- Average duration

- [ ] **Step 4: Commit**

```bash
git add app/tools/admin/impact/
git commit -m "feat: tabbed impact dashboard with activity feed"
```

---

### Task 13: Protect /tools/admin in Middleware

**Files:**
- Verify: `middleware.ts`

- [ ] **Step 1: Verify the `/tools/admin` RBAC block exists**

Check that the middleware already protects `/tools/admin/*` (this was added in the earlier sprint). If not, add it.

- [ ] **Step 2: Commit (if changes needed)**

---

### Task 14: Final Build, Test & Deploy

- [ ] **Step 1: Full build**

```bash
cd /home/ethan/.openclaw/workspace/automation-lab
npm run build
```

- [ ] **Step 2: Manual smoke test**

1. Log in with email/password — check `activity_log` table for login event
2. Log in with Google OAuth — check for login event with `auth_method: google_oauth`
3. Visit `/tools/reports`, upload a CSV — check `tool_usage` for row with `user_email`, `status`, `duration_seconds`
4. Upload a bad/empty CSV — check for error tracking
5. Visit `/tools/admin/impact` — verify:
   - Stats tab shows unique users, repeat users, completion rates
   - Activity Feed tab shows login and tool usage events
   - Filter buttons work
   - Pagination works
6. Visit as non-admin — verify redirect to `/tools`

- [ ] **Step 3: Commit and deploy**

```bash
git add -A
git commit -m "feat: complete enhanced analytics with activity feed, login tracking, and tool lifecycle"
git push
```

- [ ] **Step 4: Run the SQL migration in Supabase dashboard**

Paste the migration from Task 1 into Supabase SQL Editor and run it.

- [ ] **Step 5: Verify Supabase tables**

```sql
SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 5;
SELECT user_email, status, duration_seconds FROM tool_usage ORDER BY created_at DESC LIMIT 5;
```
