# Tool Usage Tracking & Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track how many times each tool is used, assign configurable "time saved" values, and provide an admin-only dashboard showing total time savings across all tools.

**Architecture:** Two new Supabase tables (`tool_config` for per-tool settings, `tool_usage` for usage events). A lightweight client-side tracking helper sends usage events to a new API route. An admin dashboard at `/tools/admin/impact` (protected by existing RBAC middleware) displays aggregated time savings and allows editing tool config. CSV-based tools deduplicate by content hash to avoid double-counting re-uploads.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + service client), existing RBAC/middleware, TypeScript.

---

## File Structure

```
# New files
lib/usage-tracking.ts                          — Client-side helper: hashCSV(), trackToolUsage()
app/api/usage/track/route.ts                   — POST endpoint: receives usage events, inserts to Supabase
app/api/usage/stats/route.ts                   — GET endpoint: returns aggregated stats (admin only)
app/api/usage/config/route.ts                  — GET/PUT endpoint: read/update tool_config (admin only)
app/tools/admin/impact/page.tsx                — Admin dashboard: time savings overview + config editor
app/tools/admin/impact/ImpactDashboard.tsx     — Client component: dashboard UI with charts/tables
types/usage.ts                                 — TypeScript interfaces for usage tracking

# Modified files
middleware.ts                                  — Add RBAC protection for /tools/admin/*
app/tools/csv-dedup/CsvDedupTool.tsx           — Add trackToolUsage() call on successful dedup (was components/CsvDedupTool.tsx — verify path)
app/tools/reports/page.tsx                     — Add trackToolUsage() call on successful CSV parse
lib/scheduler/engine.ts                        — Add trackToolUsage() call on schedule generation (or the API route that triggers it)
```

---

### Task 1: Supabase Schema — Create Tables

**Files:**
- Create: `supabase/migrations/20260325_tool_usage_tracking.sql`

This migration creates both tables. Run it against Supabase directly.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Tool configuration: one row per tracked tool
CREATE TABLE IF NOT EXISTS tool_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id TEXT UNIQUE NOT NULL,           -- e.g. 'csv-dedup', 'reports', 'scheduler'
  display_name TEXT NOT NULL,             -- e.g. 'CSV Deduplicator'
  minutes_per_use NUMERIC(10,2) NOT NULL DEFAULT 0,
  tracking_method TEXT NOT NULL DEFAULT 'per_use',  -- 'per_use', 'per_csv_upload', 'per_schedule_run'
  description TEXT,                       -- admin-facing note about what counts as "one use"
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage events: one row per tracked action
CREATE TABLE IF NOT EXISTS tool_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_config(tool_id),
  content_hash TEXT,                      -- SHA-256 of CSV content (for dedup)
  user_email TEXT,                        -- NULL for now, populated in Phase 2
  org_id UUID,                            -- NULL for now, populated in Phase 2
  metadata JSONB DEFAULT '{}',            -- flexible: { sessions_generated: 42, file_rows: 500, etc. }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_tool_usage_tool_id ON tool_usage(tool_id);
CREATE INDEX idx_tool_usage_created_at ON tool_usage(created_at);
CREATE INDEX idx_tool_usage_content_hash ON tool_usage(tool_id, content_hash);

-- Seed initial tool config
INSERT INTO tool_config (tool_id, display_name, minutes_per_use, tracking_method, description) VALUES
  ('csv-dedup', 'CSV Deduplicator', 60, 'per_csv_upload', 'Time to manually find and remove duplicates from a mailing list. Tracked per unique CSV upload (content-hashed).'),
  ('reports', 'Transaction Reports', 30, 'per_csv_upload', 'Time to manually compile Shopify transaction summaries. Tracked per unique CSV upload (content-hashed).'),
  ('scheduler', 'Symphonix Scheduler', 480, 'per_schedule_run', 'Time to manually create a program calendar/schedule. Tracked per schedule generation run. Metadata stores session count.')
ON CONFLICT (tool_id) DO NOTHING;
```

- [ ] **Step 2: Run migration against Supabase**

```bash
# Option A: Via Supabase dashboard SQL editor — paste the SQL above
# Option B: Via CLI if supabase CLI is configured:
cd /home/ethan/.openclaw/workspace/automation-lab
npx supabase db push
```

- [ ] **Step 3: Verify tables exist**

Run in Supabase SQL editor:
```sql
SELECT * FROM tool_config;
SELECT COUNT(*) FROM tool_usage;
```
Expected: 3 rows in tool_config, 0 in tool_usage.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260325_tool_usage_tracking.sql
git commit -m "feat: add tool_config and tool_usage tables for impact tracking"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `types/usage.ts`

- [ ] **Step 1: Create the types file**

```typescript
// types/usage.ts

export interface ToolConfig {
  id: string;
  tool_id: string;
  display_name: string;
  minutes_per_use: number;
  tracking_method: 'per_use' | 'per_csv_upload' | 'per_schedule_run';
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolUsageEvent {
  id: string;
  tool_id: string;
  content_hash: string | null;
  user_email: string | null;
  org_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ToolUsageStats {
  tool_id: string;
  display_name: string;
  minutes_per_use: number;
  tracking_method: string;
  description: string | null;
  total_uses: number;
  total_minutes_saved: number;
  total_hours_saved: number;
  last_used: string | null;
}

export interface TrackUsagePayload {
  tool_id: string;
  content_hash?: string;    // For CSV-based tools
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/usage.ts
git commit -m "feat: add TypeScript types for usage tracking"
```

---

### Task 3: Client-Side Tracking Helper

**Files:**
- Create: `lib/usage-tracking.ts`

- [ ] **Step 1: Create the tracking helper**

```typescript
// lib/usage-tracking.ts
'use client';

/**
 * Generate a SHA-256 hash of CSV content for deduplication.
 * Uses the first 10KB to keep hashing fast on large files.
 */
export async function hashCSVContent(csvText: string): Promise<string> {
  // Use first 10KB — enough to uniquely identify a file without hashing megabytes
  const sample = csvText.slice(0, 10240);
  const encoder = new TextEncoder();
  const data = encoder.encode(sample);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Track a tool usage event. Fire-and-forget — never blocks the UI.
 *
 * For CSV tools: pass contentHash to deduplicate re-uploads of the same file.
 * For Symphonix: pass metadata with session count, etc.
 */
export function trackToolUsage(
  toolId: string,
  options?: {
    contentHash?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const payload = {
    tool_id: toolId,
    content_hash: options?.contentHash,
    metadata: options?.metadata,
  };

  // Fire and forget — don't await, don't block UI
  fetch('/api/usage/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    // Silent fail — usage tracking should never break the tool
    console.warn('[usage-tracking] Failed to track:', err);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/usage-tracking.ts
git commit -m "feat: add client-side usage tracking helper with CSV hashing"
```

---

### Task 4: API Route — Track Usage Events

**Files:**
- Create: `app/api/usage/track/route.ts`

- [ ] **Step 1: Create the track endpoint**

```typescript
// app/api/usage/track/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';

const VALID_TOOL_IDS = ['csv-dedup', 'reports', 'scheduler'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool_id, content_hash, metadata } = body;

    // Validate tool_id
    if (!tool_id || !VALID_TOOL_IDS.includes(tool_id)) {
      return NextResponse.json(
        { error: 'Invalid or missing tool_id' },
        { status: 400 }
      );
    }

    const svc = createServiceClient();

    // For CSV-based tools: check if this exact content was already tracked
    if (content_hash) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (svc.from('tool_usage') as any)
        .select('id')
        .eq('tool_id', tool_id)
        .eq('content_hash', content_hash)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Already tracked this exact file — skip
        return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
      }
    }

    // Insert usage event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_usage') as any).insert({
      tool_id,
      content_hash: content_hash || null,
      metadata: metadata || {},
    });

    if (error) {
      console.error('[usage-track] Insert failed:', error);
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[usage-track] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/track/route.ts
git commit -m "feat: add POST /api/usage/track endpoint with CSV deduplication"
```

---

### Task 5: API Route — Stats (Admin Only)

**Files:**
- Create: `app/api/usage/stats/route.ts`

- [ ] **Step 1: Create the stats endpoint**

```typescript
// app/api/usage/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getOrgMembership, isAdmin } from '@/lib/rbac';
import type { ToolUsageStats } from '@/types/usage';

export async function GET(request: NextRequest) {
  try {
    // Auth check — admin only
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const membership = await getOrgMembership(user.email);
    if (!isAdmin(membership)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();

    // Get all tool configs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs, error: configError } = await (svc.from('tool_config') as any)
      .select('*')
      .eq('is_active', true)
      .order('tool_id');

    if (configError) throw configError;

    // Get usage counts and last-used per tool
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usageCounts, error: usageError } = await (svc.rpc as any)(
      'get_tool_usage_stats'  // We'll create this function, or do it client-side
    );

    // Fallback: manual aggregation if RPC doesn't exist
    const stats: ToolUsageStats[] = [];
    for (const config of configs || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (svc.from('tool_usage') as any)
        .select('*', { count: 'exact', head: true })
        .eq('tool_id', config.tool_id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lastUsed } = await (svc.from('tool_usage') as any)
        .select('created_at')
        .eq('tool_id', config.tool_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const totalUses = count || 0;
      const totalMinutes = totalUses * config.minutes_per_use;

      stats.push({
        tool_id: config.tool_id,
        display_name: config.display_name,
        minutes_per_use: config.minutes_per_use,
        tracking_method: config.tracking_method,
        description: config.description,
        total_uses: totalUses,
        total_minutes_saved: totalMinutes,
        total_hours_saved: Math.round((totalMinutes / 60) * 10) / 10,
        last_used: lastUsed?.created_at || null,
      });
    }

    // Optional date range filter
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    // (Phase 2: filter usage counts by date range)

    return NextResponse.json({ stats }, { status: 200 });
  } catch (err) {
    console.error('[usage-stats] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/stats/route.ts
git commit -m "feat: add GET /api/usage/stats endpoint (admin only)"
```

---

### Task 6: API Route — Config (Admin Only)

**Files:**
- Create: `app/api/usage/config/route.ts`

- [ ] **Step 1: Create the config endpoint**

```typescript
// app/api/usage/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getOrgMembership, isAdmin } from '@/lib/rbac';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const membership = await getOrgMembership(user.email);
  if (!isAdmin(membership)) return null;
  return user;
}

// GET — return all tool configs
export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tool_config') as any)
      .select('*')
      .order('tool_id');

    if (error) throw error;
    return NextResponse.json({ configs: data }, { status: 200 });
  } catch (err) {
    console.error('[usage-config] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT — update a tool config (minutes_per_use, description, is_active)
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tool_id, minutes_per_use, description, is_active } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (minutes_per_use !== undefined) updates.minutes_per_use = minutes_per_use;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    const svc = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('tool_config') as any)
      .update(updates)
      .eq('tool_id', tool_id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[usage-config] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/config/route.ts
git commit -m "feat: add GET/PUT /api/usage/config endpoint (admin only)"
```

---

### Task 7: Middleware — Protect Admin Impact Route

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add /tools/admin/* protection to middleware**

Add a new RBAC block after the existing analytics admin block (around line 58). The block should match `/tools/admin/*` and restrict to admin role:

```typescript
  // ── RBAC for impact/usage admin ──────────────────────────────────────
  if (user && path.startsWith('/tools/admin')) {
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin } = await (svc.from('admins') as any)
      .select('role_level')
      .eq('google_email', user.email)
      .maybeSingle()

    if (!admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools'
      return NextResponse.redirect(url)
    }
  }
```

Also ensure unauthenticated users hitting `/tools/admin` get redirected to `/login` (already handled by the existing `/tools` catch-all at line ~46).

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect /tools/admin/* routes with RBAC"
```

---

### Task 8: Admin Dashboard — Page & UI

**Files:**
- Create: `app/tools/admin/impact/page.tsx`
- Create: `app/tools/admin/impact/ImpactDashboard.tsx`

- [ ] **Step 1: Create the server page component**

```typescript
// app/tools/admin/impact/page.tsx
import type { Metadata } from 'next';
import ImpactDashboard from './ImpactDashboard';

export const metadata: Metadata = {
  title: 'Impact Dashboard | Automation Lab Admin',
  description: 'Track time savings across all automation tools.',
};

export default function ImpactPage() {
  return <ImpactDashboard />;
}
```

- [ ] **Step 2: Create the client dashboard component**

```typescript
// app/tools/admin/impact/ImpactDashboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ToolUsageStats, ToolConfig } from '@/types/usage';

export default function ImpactDashboard() {
  const [stats, setStats] = useState<ToolUsageStats[]>([]);
  const [configs, setConfigs] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, configRes] = await Promise.all([
        fetch('/api/usage/stats'),
        fetch('/api/usage/config'),
      ]);
      if (!statsRes.ok || !configRes.ok) throw new Error('Failed to load data');
      const statsData = await statsRes.json();
      const configData = await configRes.json();
      setStats(statsData.stats);
      setConfigs(configData.configs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalHours = stats.reduce((sum, s) => sum + s.total_hours_saved, 0);
  const totalUses = stats.reduce((sum, s) => sum + s.total_uses, 0);

  async function saveMinutes(toolId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/usage/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, minutes_per_use: Number(editMinutes) }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingTool(null);
      fetchData(); // Refresh
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: '#94a3b8', minHeight: '100vh', background: '#0f172a' }}>
      Loading impact data...
    </div>
  );

  if (error) return (
    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: '#f87171', minHeight: '100vh', background: '#0f172a' }}>
      Error: {error}
    </div>
  );

  return (
    <div style={{ paddingTop: '80px', minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: "'Montserrat', sans-serif" }}>
          Impact Dashboard
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '2.5rem' }}>
          Track time savings across all automation tools.
        </p>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '1.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', fontFamily: "'Montserrat', sans-serif" }}>
              {totalUses}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
              Total Tool Uses
            </div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '1.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1', fontFamily: "'Montserrat', sans-serif" }}>
              {Math.round(totalHours * 10) / 10}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
              Total Hours Saved
            </div>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '1.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', fontFamily: "'Montserrat', sans-serif" }}>
              ${Math.round(totalHours * 20)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
              Est. Cost Savings (@$20/hr)
            </div>
          </div>
        </div>

        {/* Per-tool breakdown */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', fontFamily: "'Montserrat', sans-serif" }}>
          By Tool
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stats.map((s) => (
            <div key={s.tool_id} style={{ background: '#1e293b', borderRadius: '12px', padding: '1.5rem', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{s.display_name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', fontFamily: "'Montserrat', sans-serif" }}>
                    {s.total_hours_saved}h
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>saved</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '13px', color: '#94a3b8' }}>
                <span><strong>{s.total_uses}</strong> uses</span>
                <span>
                  <strong>
                    {editingTool === s.tool_id ? (
                      <>
                        <input
                          type="number"
                          value={editMinutes}
                          onChange={(e) => setEditMinutes(e.target.value)}
                          style={{ width: '60px', background: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', padding: '2px 6px', marginRight: '4px' }}
                        />
                        <button onClick={() => saveMinutes(s.tool_id)} disabled={saving} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>
                          Save
                        </button>
                        <button onClick={() => setEditingTool(null)} style={{ background: 'none', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <span onClick={() => { setEditingTool(s.tool_id); setEditMinutes(String(s.minutes_per_use)); }} style={{ cursor: 'pointer', borderBottom: '1px dashed #475569' }} title="Click to edit">
                        {s.minutes_per_use}
                      </span>
                    )}
                  </strong> min/use
                </span>
                <span>Tracking: {s.tracking_method}</span>
                {s.last_used && <span>Last used: {new Date(s.last_used).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/tools/admin/impact/
git commit -m "feat: add admin impact dashboard with per-tool stats and config editor"
```

---

### Task 9: Instrument CSV Deduplicator

**Files:**
- Modify: Locate the dedup tool component (likely `components/CsvDedupTool.tsx` or `app/tools/csv-dedup/`)

- [ ] **Step 1: Find the exact file path**

```bash
find app/tools/csv-dedup -name "*.tsx" | head -10
# Also check: components/CsvDedupTool.tsx
```

- [ ] **Step 2: Add tracking import and call**

At the top of the file, add:
```typescript
import { trackToolUsage, hashCSVContent } from '@/lib/usage-tracking';
```

Find the success path where dedup results are displayed (after CSV is parsed and duplicates removed). Add:
```typescript
// After successful dedup — track usage
hashCSVContent(rawCsvText).then((hash) => {
  trackToolUsage('csv-dedup', {
    contentHash: hash,
    metadata: {
      total_rows: totalRows,
      duplicates_found: duplicateCount,
    },
  });
});
```

Place this right after the state is set with results, NOT inside a render. Should be in the file processing callback.

- [ ] **Step 3: Build and verify no errors**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/tools/csv-dedup/ components/CsvDedupTool.tsx
git commit -m "feat: instrument CSV deduplicator with usage tracking"
```

---

### Task 10: Instrument Transaction Reports

**Files:**
- Modify: `app/tools/reports/page.tsx`

- [ ] **Step 1: Add tracking import and call**

At the top, add:
```typescript
import { trackToolUsage, hashCSVContent } from '@/lib/usage-tracking';
```

Find the `processFile` callback where `parseCSVData(text)` is called and `setData(parsed)` succeeds. After `setData(parsed)`, add:

```typescript
// Track usage — hash CSV to avoid counting re-uploads
hashCSVContent(text).then((hash) => {
  trackToolUsage('reports', {
    contentHash: hash,
    metadata: {
      total_orders: parsed.totalOrders,
      file_name: file.name,
    },
  });
});
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/tools/reports/page.tsx
git commit -m "feat: instrument Transaction Reports with usage tracking"
```

---

### Task 11: Instrument Symphonix Scheduler

**Files:**
- Modify: The schedule generation API route or the client-side trigger

- [ ] **Step 1: Find the schedule generation endpoint**

```bash
grep -r "auto-generate\|autoGenerate\|generate.*schedule" app/api/ --include="*.ts" -l
# Also check: lib/scheduler/engine.ts
```

- [ ] **Step 2: Add server-side tracking**

For Symphonix, tracking should happen server-side since schedule generation goes through an API route. In the relevant API route, after successful generation:

```typescript
import { createServiceClient } from '@/lib/supabase-service';

// After successful schedule generation:
const svc = createServiceClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(svc.from('tool_usage') as any)
  .insert({
    tool_id: 'scheduler',
    metadata: {
      sessions_generated: generatedCount,
      program_id: programId,
      // any other relevant info
    },
  })
  .then(({ error }: { error: unknown }) => {
    if (error) console.error('[usage-track] Scheduler tracking failed:', error);
  });
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/scheduler/ lib/scheduler/
git commit -m "feat: instrument Symphonix Scheduler with usage tracking"
```

---

### Task 12: Final Build, Test & Deploy

- [ ] **Step 1: Full build**

```bash
cd /home/ethan/.openclaw/workspace/automation-lab
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual smoke test**

1. Visit `/tools/reports`, upload a Shopify CSV — check Supabase `tool_usage` table for new row
2. Upload the SAME CSV again — should NOT create a second row (dedup check)
3. Visit `/tools/csv-dedup`, process a CSV — check for tracking row
4. Visit `/tools/admin/impact` as admin — should see dashboard with data
5. Visit `/tools/admin/impact` as non-admin — should redirect to `/tools`
6. Click the minutes-per-use value on dashboard — should allow inline editing

- [ ] **Step 3: Commit all and deploy**

```bash
git add -A
git commit -m "feat: complete tool usage tracking system with admin dashboard"
git push
```

- [ ] **Step 4: Verify Supabase tables have correct data after testing**

```sql
SELECT * FROM tool_config;
SELECT * FROM tool_usage ORDER BY created_at DESC LIMIT 10;
```
