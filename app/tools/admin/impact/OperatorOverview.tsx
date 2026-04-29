'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ToolUsageStats, ToolConfig } from '@/types/usage';
import type { ActivityFeedItem, ActivityFeedResponse } from '@/types/activity';
import { useImpactRealtime } from './useImpactRealtime';

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

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

function activityLabel(item: ActivityFeedItem): string {
  switch (item.event_type) {
    case 'login': return 'Operator Signed In';
    case 'logout': return 'Operator Signed Out';
    case 'tool_open': return 'Tool Opened';
    case 'tool_complete': return 'Automation Run';
    case 'tool_error': return 'Run Errored';
    case 'scheduler_action': return 'Scheduler Update';
    default: return item.event_type;
  }
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

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--al-ink-200, #E4E4E4)',
  borderRadius: '10px',
  overflow: 'hidden',
};

const panelHeader: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--al-ink-200, #E4E4E4)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const panelHeaderTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--al-ink-900, #1F1F1F)',
};

const kpiCard: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--al-ink-200, #E4E4E4)',
  borderRadius: '10px',
  padding: '18px 20px',
};

const kpiLabel: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--al-ink-500, #6B6B6B)',
  fontWeight: 700,
};

const kpiNum: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '36px',
  fontWeight: 700,
  color: 'var(--al-ink-900, #1F1F1F)',
  marginTop: '8px',
  lineHeight: 1,
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
};

const kpiSub: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 700,
  marginTop: '8px',
  letterSpacing: '0.06em',
};

function StatusPill({ kind, label }: { kind: 'run' | 'draft' | 'review'; label: string }) {
  const palette = {
    run: { bg: 'rgba(95,127,79,0.14)', color: '#4A6B3F' },
    draft: { bg: 'var(--al-ink-100, #F2F1EE)', color: 'var(--al-ink-700, #404040)' },
    review: { bg: 'rgba(197,139,43,0.16)', color: '#96661E' },
  }[kind];
  return (
    <span style={{
      fontFamily: "'Montserrat', sans-serif",
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: '999px',
      background: palette.bg,
      color: palette.color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function statusFor(s: ToolUsageStats): { kind: 'run' | 'draft' | 'review'; label: string } {
  if (s.total_uses === 0) return { kind: 'draft', label: 'Draft' };
  const last = s.last_used ? new Date(s.last_used).getTime() : 0;
  if (Date.now() - last > DAYS_30_MS) return { kind: 'review', label: 'Review' };
  return { kind: 'run', label: 'Running' };
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
    totalHours,
    totalRuns,
    activeCount,
    configuredCount,
    needsReviewCount,
    recentRuns30d,
    sortedAutomations,
    insight,
  } = useMemo(() => {
    const now = Date.now();
    const totalHours = stats.reduce((sum, s) => sum + (s.total_hours_saved || 0), 0);
    const totalRuns = stats.reduce((sum, s) => sum + (s.total_uses || 0), 0);
    const configuredCount = configs.length;
    const activeCount = stats.filter(s => {
      if (!s.last_used) return false;
      return now - new Date(s.last_used).getTime() <= DAYS_30_MS;
    }).length;
    const needsReviewCount = configs.filter(c => {
      const stat = stats.find(s => s.tool_id === c.tool_id);
      if (!stat || stat.total_uses === 0) return true;
      if (!stat.last_used) return true;
      return now - new Date(stat.last_used).getTime() > DAYS_30_MS;
    }).length;
    const recentRuns30d = stats
      .filter(s => s.last_used && now - new Date(s.last_used).getTime() <= DAYS_30_MS)
      .reduce((sum, s) => sum + (s.total_uses || 0), 0);
    const sortedAutomations = [...stats].sort((a, b) => {
      const at = a.last_used ? new Date(a.last_used).getTime() : 0;
      const bt = b.last_used ? new Date(b.last_used).getTime() : 0;
      if (bt !== at) return bt - at;
      return (b.total_hours_saved || 0) - (a.total_hours_saved || 0);
    }).slice(0, 6);

    // Deterministic readiness insight
    const externalUnused = configs.filter(c => {
      if (!c.is_external) return false;
      const stat = stats.find(s => s.tool_id === c.tool_id);
      return !stat || stat.total_uses === 0;
    }).length;
    const highValue = stats
      .filter(s => (s.total_hours_saved || 0) >= 10)
      .sort((a, b) => (b.total_hours_saved || 0) - (a.total_hours_saved || 0));
    let insight = '';
    if (configs.length === 0) {
      insight = 'No automations configured yet. Add an external tool or activate an in-platform tool to start measuring returned administrative time.';
    } else if (externalUnused >= 2) {
      insight = `${externalUnused} external tools are configured but have no recorded runs yet. Backfill historical activity or log a first run so their saved time shows up alongside in-platform automations.`;
    } else if (needsReviewCount >= 2) {
      insight = `${needsReviewCount} configured tools have no activity in the last 30 days. Review whether those workflows are still active or paused so the dashboard reflects real operator capacity.`;
    } else if (highValue.length > 0) {
      const top = highValue[0];
      insight = `${top.display_name} alone has returned ${Math.round((top.total_hours_saved || 0) * 10) / 10}h of administrative capacity. Look for adjacent workflows in the same category — they are typically the highest-leverage candidates for the next pilot.`;
    } else {
      insight = 'Pilot is in early measurement. Hours saved compound as more workflows move from prototype to deployment — log usage frequently to keep the impact picture accurate.';
    }

    return {
      totalHours,
      totalRuns,
      activeCount,
      configuredCount,
      needsReviewCount,
      recentRuns30d,
      sortedAutomations,
      insight,
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

  return (
    <div>
      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '28px',
      }}>
        <div style={kpiCard}>
          <div style={kpiLabel}>Hours Saved · Lifetime</div>
          <div style={{ ...kpiNum, color: 'var(--al-gold-700, #A3915F)' }}>
            {Math.round(totalHours * 10) / 10}
            <span style={{ fontSize: '20px', marginLeft: 4 }}>h</span>
          </div>
          <div style={{ ...kpiSub, color: '#5F7F4F' }}>
            ≈ ${Math.round(totalHours * 20).toLocaleString()} @ $20/hr
          </div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Active Automations</div>
          <div style={kpiNum}>
            {activeCount}<span style={{ color: 'var(--al-ink-300, #C9C9C9)' }}> / {configuredCount}</span>
          </div>
          <div style={{ ...kpiSub, color: 'var(--al-ink-500, #6B6B6B)' }}>
            Active in last 30 days
          </div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Runs · Lifetime</div>
          <div style={kpiNum}>{totalRuns.toLocaleString()}</div>
          <div style={{ ...kpiSub, color: '#5F7F4F' }}>
            {recentRuns30d.toLocaleString()} in last 30 days
          </div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLabel}>Needs Review</div>
          <div style={{ ...kpiNum, color: needsReviewCount > 0 ? '#C58B2B' : 'var(--al-ink-900, #1F1F1F)' }}>
            {needsReviewCount}
          </div>
          <div style={{ ...kpiSub, color: needsReviewCount > 0 ? '#C58B2B' : 'var(--al-ink-500, #6B6B6B)' }}>
            {needsReviewCount > 0 ? 'Idle or never-run tools' : 'All clear'}
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
        gap: '20px',
        alignItems: 'flex-start',
      }} className="al-overview-cols">
        {/* Left: Active Automations + Insight */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={card}>
            <div style={panelHeader}>
              <h2 style={panelHeaderTitle}>Active Automations</h2>
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'var(--al-gold-700, #A3915F)',
              }}>
                {sortedAutomations.length} of {configuredCount}
              </span>
            </div>
            {sortedAutomations.length === 0 ? (
              <div style={{ padding: '28px 22px', textAlign: 'center', color: 'var(--al-ink-500, #6B6B6B)', fontSize: '14px' }}>
                No automations configured yet.
              </div>
            ) : sortedAutomations.map((s) => {
              const status = statusFor(s);
              const sub = s.tracking_notes || s.description || (s.is_external ? 'External tool' : 'In-platform tool');
              return (
                <div key={s.tool_id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
                  gap: '14px',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--al-ink-100, #F2F1EE)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: '14px',
                      color: 'var(--al-ink-900, #1F1F1F)',
                      letterSpacing: '0.01em',
                    }}>
                      {s.display_name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--al-ink-500, #6B6B6B)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {sub}
                    </div>
                  </div>
                  <StatusPill kind={status.kind} label={status.label} />
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--al-ink-500, #6B6B6B)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}>
                    {relativeTime(s.last_used)}
                  </div>
                  <div style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: '13px',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--al-ink-900, #1F1F1F)',
                    textAlign: 'right',
                    minWidth: '64px',
                  }}>
                    {s.total_uses} {s.total_uses === 1 ? 'run' : 'runs'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Readiness Insight (dark panel — derived from real data) */}
          <div style={{
            background: 'var(--al-ink-800, #2B2B2B)',
            color: '#ffffff',
            padding: '20px 24px',
            borderRadius: '10px',
          }}>
            <div style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '10px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'var(--al-gold-500, #DBCBA6)',
              marginBottom: '8px',
            }}>
              Readiness Insight
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.55, color: 'rgba(255,255,255,0.92)' }}>
              {insight}
            </div>
          </div>
        </div>

        {/* Right: Recent Activity */}
        <div style={card}>
          <div style={panelHeader}>
            <h2 style={panelHeaderTitle}>Recent Activity</h2>
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'var(--al-gold-700, #A3915F)',
            }}>
              Last {activity.length}
            </span>
          </div>
          {activity.length === 0 ? (
            <div style={{ padding: '28px 22px', textAlign: 'center', color: 'var(--al-ink-500, #6B6B6B)', fontSize: '14px' }}>
              No recent activity recorded.
            </div>
          ) : activity.map((item) => (
            <div key={item.id} style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--al-ink-100, #F2F1EE)',
              fontSize: '13px',
              lineHeight: 1.45,
            }}>
              <div style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--al-gold-700, #A3915F)',
                marginBottom: '4px',
              }}>
                {activityLabel(item)}
              </div>
              <div style={{ color: 'var(--al-ink-900, #1F1F1F)' }}>
                {activityBody(item)}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--al-ink-500, #6B6B6B)',
                marginTop: '4px',
                letterSpacing: '0.02em',
              }}>
                {relativeTime(item.created_at)}
                {item.user_email ? ` · ${item.user_email}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
