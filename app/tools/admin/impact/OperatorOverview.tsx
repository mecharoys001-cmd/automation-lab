'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ToolUsageStats, ToolConfig } from '@/types/usage';
import type { ActivityFeedItem, ActivityFeedResponse } from '@/types/activity';
import { useImpactRealtime } from './useImpactRealtime';

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never run';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function activityBody(item: ActivityFeedItem): string {
  const tool = item.tool_name || item.tool_id || 'a tool';
  switch (item.event_type) {
    case 'login':
      return `${item.user_email || 'An operator'} signed in.`;
    case 'logout':
      return `${item.user_email || 'An operator'} signed out.`;
    case 'tool_open':
      return `${item.user_email || 'Someone'} opened ${tool}.`;
    case 'tool_complete': {
      const dur = item.metadata?.duration_seconds as number | undefined;
      const durStr = dur && dur > 0 ? ` (${dur < 60 ? `${Math.round(dur)}s` : `${Math.round(dur / 60)}m`})` : '';
      return `${tool} completed${durStr}.`;
    }
    case 'tool_error':
      return `${tool} errored — review logs.`;
    case 'scheduler_action': {
      const action = item.metadata?.action as string | undefined;
      const entityName = item.metadata?.entity_name as string | undefined;
      if (action && entityName) return `Scheduler · ${action.replace(/_/g, ' ')}: ${entityName}.`;
      if (action) return `Scheduler · ${action.replace(/_/g, ' ')}.`;
      return 'Scheduler activity recorded.';
    }
    default:
      return item.event_type;
  }
}

function avatarSeed(item: ActivityFeedItem): string {
  if (item.user_email) {
    const local = item.user_email.split('@')[0] || '';
    const parts = local.split(/[._\-+]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return local.slice(0, 2).toUpperCase();
  }
  if (item.tool_name) {
    const words = item.tool_name.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return item.tool_name.slice(0, 2).toUpperCase();
  }
  return 'AL';
}

function avatarColor(seed: string): string {
  // Stable hash → muted palette
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const palette = [
    { bg: '#EEE6CF', fg: '#7A6A40' },
    { bg: '#E5EAE0', fg: '#4A6B3F' },
    { bg: '#E4E2EC', fg: '#3F4A78' },
    { bg: '#F1E5DA', fg: '#7A4F2C' },
    { bg: '#E0EAEC', fg: '#1F5E72' },
    { bg: '#EFE0E1', fg: '#8A3F47' },
  ];
  return JSON.stringify(palette[Math.abs(h) % palette.length]);
}

function hoursPerMonth(s: ToolUsageStats): number {
  // Prefer declared run cadence — most honest.
  if (s.run_frequency) {
    const runsPerMonth =
      s.run_frequency === 'daily' ? 30 :
      s.run_frequency === 'weekly' ? 30 / 7 :
      s.run_frequency === 'monthly' ? 1 :
      s.run_frequency === 'custom' && s.run_interval_days && s.run_interval_days > 0 ? 30 / s.run_interval_days :
      0;
    return (runsPerMonth * s.minutes_per_use) / 60;
  }
  // Otherwise: amortise total hours saved across active months.
  if (s.first_run_date && s.total_uses > 0) {
    const days = Math.max(1, (Date.now() - new Date(s.first_run_date).getTime()) / DAY_MS);
    const monthsActive = Math.max(1, days / 30);
    return s.total_hours_saved / monthsActive;
  }
  return 0;
}

type SystemStatus = {
  kind: 'running' | 'review' | 'draft';
  label: string;
  color: string;
};

function systemStatusFor(s: ToolUsageStats): SystemStatus {
  if (s.total_uses === 0) {
    return { kind: 'draft', label: 'No runs yet', color: '#B5B5B5' };
  }
  const last = s.last_used ? new Date(s.last_used).getTime() : 0;
  const idle = Date.now() - last;
  if (idle > DAYS_30_MS) {
    return { kind: 'review', label: 'Idle · review', color: '#C58B2B' };
  }
  return { kind: 'running', label: 'Running', color: '#5F7F4F' };
}

export default function OperatorOverview() {
  const [stats, setStats] = useState<ToolUsageStats[]>([]);
  const [configs, setConfigs] = useState<ToolConfig[]>([]);
  const [activity, setActivity] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setError('');
    try {
      const [statsRes, configRes, feedRes] = await Promise.all([
        fetch('/api/usage/stats'),
        fetch('/api/usage/config'),
        fetch('/api/activity/feed?page=1&pageSize=8'),
      ]);
      if (!statsRes.ok || !configRes.ok) throw new Error('Failed to load impact data');
      const statsData = await statsRes.json();
      const configData = await configRes.json();
      setStats(statsData.stats || []);
      setConfigs(configData.configs || []);
      if (feedRes.ok) {
        const feedData: ActivityFeedResponse = await feedRes.json();
        setActivity(feedData.items || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useImpactRealtime({ onEvent: fetchAll, debounceMs: 2000 });

  const {
    totalHoursSaved,
    activeCount,
    configuredCount,
    trackedRuns,
    barRows,
    statusRows,
    barTotalHours,
    barHasFallback,
  } = useMemo(() => {
    const now = Date.now();

    // Eligible tools = configured & active & not hidden. This is the union
    // baseline so every real tool gets a row, regardless of whether anyone
    // set a run cadence.
    const eligibleConfigs = configs.filter(c => {
      if (c.is_active === false) return false;
      if (c.visibility === 'hidden') return false;
      return true;
    });
    const configuredCount = eligibleConfigs.length;

    const statByTool = new Map<string, ToolUsageStats>();
    for (const s of stats) statByTool.set(s.tool_id, s);

    const activeCount = eligibleConfigs.filter(c => {
      const s = statByTool.get(c.tool_id);
      if (!s?.last_used) return false;
      return now - new Date(s.last_used).getTime() <= DAYS_30_MS;
    }).length;

    // Tracked runs: every recorded use across every tool. We can't compute a
    // true 30-day window from the stats endpoint, so this is the honest label.
    const trackedRuns = stats.reduce((sum, s) => sum + (s.total_uses || 0), 0);

    // Total tracked hours saved across every tool — drives the headline KPI.
    const totalHoursSaved = stats.reduce((sum, s) => sum + (s.total_hours_saved || 0), 0);

    // Bar rows: one per eligible tool. Prefer cadence-based monthly estimate;
    // fall back to total tracked hours so in-platform tools without cadence
    // still appear with a real number instead of disappearing.
    const rowsRaw = eligibleConfigs.map(c => {
      const stat = statByTool.get(c.tool_id);
      const cadenceHrs = stat ? hoursPerMonth(stat) : 0;
      const trackedHrs = stat?.total_hours_saved ?? 0;
      const hours = cadenceHrs > 0 ? cadenceHrs : trackedHrs;
      return {
        tool_id: c.tool_id,
        label: c.display_name,
        hours,
        external: !!c.is_external,
        usedFallback: cadenceHrs <= 0 && trackedHrs > 0,
      };
    });
    rowsRaw.sort((a, b) => b.hours - a.hours);
    const barTotalHours = rowsRaw.reduce((sum, r) => sum + r.hours, 0);
    const barHasFallback = rowsRaw.some(r => r.usedFallback);
    const maxHrs = rowsRaw[0]?.hours || 1;
    const barRows = rowsRaw.map(r => ({
      ...r,
      pct: r.hours > 0 ? Math.max(6, Math.round((r.hours / maxHrs) * 100)) : 0,
    }));

    // System Status: per configured tool, derive a health row.
    const statusRows = eligibleConfigs.map(c => {
      const stat = statByTool.get(c.tool_id);
      const placeholder: ToolUsageStats = stat ?? {
        tool_id: c.tool_id,
        display_name: c.display_name,
        minutes_per_use: c.minutes_per_use,
        tracking_method: c.tracking_method,
        description: c.description,
        is_external: c.is_external,
        tracking_notes: c.tracking_notes,
        run_frequency: c.run_frequency,
        run_interval_days: c.run_interval_days,
        first_run_date: c.first_run_date,
        next_run_date: c.next_run_date,
        historical_runs_seeded: c.historical_runs_seeded ?? false,
        total_uses: 0,
        total_minutes_saved: 0,
        total_hours_saved: 0,
        last_used: null,
        unique_users: 0,
        repeat_users: 0,
        completion_rate: 0,
        avg_duration_seconds: 0,
      };
      return {
        tool_id: c.tool_id,
        label: c.display_name,
        sub: c.is_external ? 'External tool' : 'In-platform tool',
        last_used: placeholder.last_used,
        status: systemStatusFor(placeholder),
      };
    });
    statusRows.sort((a, b) => {
      const order = { running: 0, review: 1, draft: 2 } as const;
      const d = order[a.status.kind] - order[b.status.kind];
      if (d !== 0) return d;
      const at = a.last_used ? new Date(a.last_used).getTime() : 0;
      const bt = b.last_used ? new Date(b.last_used).getTime() : 0;
      return bt - at;
    });

    return {
      totalHoursSaved,
      activeCount,
      configuredCount,
      trackedRuns,
      barRows,
      statusRows,
      barTotalHours,
      barHasFallback,
    };
  }, [stats, configs]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--al-ink-500, #6B6B6B)', fontFamily: "'Montserrat', sans-serif" }}>
        Loading operator overview…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', fontFamily: "'Montserrat', sans-serif" }}>
        Error: {error}
      </div>
    );
  }

  const fmtHours = (h: number) => {
    if (h >= 100) return `${Math.round(h)}h`;
    if (h >= 10) return `${(Math.round(h * 10) / 10).toFixed(1)}h`;
    return `${(Math.round(h * 10) / 10).toFixed(1)}h`;
  };

  return (
    <div className="al-op">
      {/* Compact dashboard header */}
      <header className="al-op-header">
        <div className="al-op-brand">
          <div className="al-op-mark" aria-hidden="true">AL</div>
          <div className="al-op-brand-text">
            <div className="al-op-brand-title">Automation Lab</div>
            <div className="al-op-brand-sub">Northwest CT Arts Council</div>
          </div>
        </div>
        <div className="al-op-header-right">
          <span className="al-op-phase-pill">
            <span className="al-op-phase-dot" /> Phase 2 Active
          </span>
          <button type="button" className="al-op-kebab" aria-label="Overview options">⋯</button>
        </div>
      </header>
      <div className="al-op-divider" />

      {/* KPI row */}
      <div className="al-op-kpis">
        <div className="al-op-kpi">
          <div className="al-op-kpi-label">Hours Saved</div>
          <div className="al-op-kpi-value">
            {totalHoursSaved > 0 ? Math.round(totalHoursSaved * 10) / 10 : '—'}
            {totalHoursSaved > 0 && <span className="al-op-kpi-unit">h</span>}
          </div>
          <div className="al-op-kpi-foot">
            {totalHoursSaved > 0
              ? `≈ $${Math.round(totalHoursSaved * 20).toLocaleString()} returned @ $20/hr`
              : 'No tracked runs yet'}
          </div>
        </div>
        <div className="al-op-kpi">
          <div className="al-op-kpi-label">Active Workflows</div>
          <div className="al-op-kpi-value">
            {activeCount}
            <span className="al-op-kpi-of"> / {configuredCount}</span>
          </div>
          <div className="al-op-kpi-foot">Run in the last 30 days</div>
        </div>
        <div className="al-op-kpi">
          <div className="al-op-kpi-label">Tracked Runs</div>
          <div className="al-op-kpi-value">{trackedRuns.toLocaleString()}</div>
          <div className="al-op-kpi-foot">All recorded tool uses</div>
        </div>
        <div className="al-op-kpi">
          <div className="al-op-kpi-label">Tracked Tools</div>
          <div className="al-op-kpi-value">{configuredCount}</div>
          <div className="al-op-kpi-foot">In-platform &amp; external</div>
        </div>
      </div>

      {/* Middle: usage bars + system status */}
      <div className="al-op-mid">
        {/* Tool Usage By Category (Tracked Hrs) */}
        <section className="al-op-card">
          <header className="al-op-card-header">
            <h2 className="al-op-card-title">Tool Usage By Category (Tracked Hrs)</h2>
            <span
              className="al-op-card-meta"
              title={
                barHasFallback
                  ? 'Tools without a run cadence fall back to total tracked hours saved.'
                  : 'Cadence-based monthly estimate.'
              }
            >
              {barTotalHours > 0
                ? `${Math.round(barTotalHours * 10) / 10}h total`
                : 'No tracked hours'}
            </span>
          </header>
          <div className="al-op-card-body">
            {barRows.length === 0 ? (
              <div className="al-op-empty">
                No tools configured yet.
              </div>
            ) : barRows.map((row) => (
              <div key={row.tool_id} className="al-op-bar-row">
                <div className="al-op-bar-label" title={row.label}>{row.label}</div>
                <div className="al-op-bar-track">
                  <div
                    className={`al-op-bar-fill${row.external ? ' al-op-bar-fill--ext' : ''}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <div className="al-op-bar-value">{fmtHours(row.hours)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* System Status */}
        <section className="al-op-card">
          <header className="al-op-card-header">
            <h2 className="al-op-card-title">System Status</h2>
            <span className="al-op-card-meta">{configuredCount} tools</span>
          </header>
          <div className="al-op-card-body">
            {statusRows.length === 0 ? (
              <div className="al-op-empty">
                No tools configured yet.
              </div>
            ) : statusRows.map((row) => (
              <div key={row.tool_id} className="al-op-status-row">
                <div className="al-op-status-text">
                  <div className="al-op-status-name">{row.label}</div>
                  <div className="al-op-status-sub">
                    {row.sub}
                    {row.last_used ? ` · ${relativeTime(row.last_used)}` : ' · No runs'}
                  </div>
                </div>
                <div className="al-op-status-tag">
                  <span className="al-op-status-dot" style={{ background: row.status.color }} />
                  <span className="al-op-status-label">{row.status.label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Activity full-width */}
      <section className="al-op-card al-op-activity">
        <header className="al-op-card-header">
          <h2 className="al-op-card-title">Recent Activity</h2>
          <span className="al-op-card-meta">Last {activity.length}</span>
        </header>
        <div className="al-op-card-body">
          {activity.length === 0 ? (
            <div className="al-op-empty">No recent activity recorded.</div>
          ) : activity.map((item) => {
            const seed = avatarSeed(item);
            const palette = JSON.parse(avatarColor(seed)) as { bg: string; fg: string };
            return (
              <div key={item.id} className="al-op-activity-row">
                <div
                  className="al-op-avatar"
                  style={{ background: palette.bg, color: palette.fg }}
                  aria-hidden="true"
                >
                  {seed}
                </div>
                <div className="al-op-activity-text">
                  <div className="al-op-activity-body">{activityBody(item)}</div>
                  {item.user_email && (
                    <div className="al-op-activity-sub">{item.user_email}</div>
                  )}
                </div>
                <div className="al-op-activity-time">
                  {relativeTime(item.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
