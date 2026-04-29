'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActivityFeedItem, ActivityFeedResponse } from '@/types/activity';
import { useImpactRealtime, type ConnectionStatus } from './useImpactRealtime';

type FilterType = 'all' | 'login' | 'tool' | 'scheduler' | 'error';

const EVENT_COLORS: Record<string, string> = {
  login: '#2563eb',
  logout: '#2563eb',
  tool_complete: '#10b981',
  tool_error: '#ef4444',
  tool_open: '#9ca3af',
  scheduler_action: '#7c3aed',
};

const SCHEDULER_ACTION_LABELS: Record<string, { verb: string; noun: string }> = {
  create_staff: { verb: 'Added', noun: 'staff member' },
  update_staff: { verb: 'Updated', noun: 'staff member' },
  delete_staff: { verb: 'Deleted', noun: 'staff member' },
  create_venue: { verb: 'Added', noun: 'venue' },
  update_venue: { verb: 'Updated', noun: 'venue' },
  delete_venue: { verb: 'Deleted', noun: 'venue' },
  create_template: { verb: 'Added', noun: 'event template' },
  update_template: { verb: 'Updated', noun: 'event template' },
  delete_template: { verb: 'Deleted', noun: 'event template' },
  create_session: { verb: 'Added', noun: 'session' },
  update_session: { verb: 'Updated', noun: 'session' },
  delete_session: { verb: 'Deleted', noun: 'session' },
  create_calendar_entry: { verb: 'Added', noun: 'program calendar entry' },
  update_calendar_entry: { verb: 'Updated', noun: 'program calendar entry' },
  delete_calendar_entry: { verb: 'Deleted', noun: 'program calendar entry' },
  generate_sessions: { verb: 'Generated', noun: 'sessions' },
  bulk_update_sessions: { verb: 'Bulk-edited', noun: 'sessions' },
  bulk_assign_sessions: { verb: 'Bulk-assigned', noun: 'sessions' },
  delete_draft_sessions: { verb: 'Cleared', noun: 'draft sessions' },
  cancel_future_sessions: { verb: 'Canceled', noun: 'future sessions' },
  delete_future_sessions: { verb: 'Deleted', noun: 'future sessions' },
  publish_placements: { verb: 'Published', noun: 'placements' },
  publish_schedule: { verb: 'Published', noun: 'schedule' },
  flag_sessions: { verb: 'Flagged', noun: 'sessions for resolution' },
  resolve_exception: { verb: 'Resolved', noun: 'exception' },
  update_settings: { verb: 'Updated', noun: 'scheduler settings' },
  save_version: { verb: 'Saved', noun: 'schedule version' },
  revert_version: { verb: 'Reverted to', noun: 'schedule version' },
};

const COUNT_FIRST_ACTIONS = new Set([
  'generate_sessions',
  'bulk_update_sessions',
  'bulk_assign_sessions',
  'delete_draft_sessions',
  'cancel_future_sessions',
  'delete_future_sessions',
  'flag_sessions',
  'publish_placements',
  'publish_schedule',
]);

function describeSchedulerAction(metadata: Record<string, unknown>): string {
  const action = metadata?.action as string | undefined;
  const entityName = metadata?.entity_name as string | undefined;
  const count = (metadata?.count as number | undefined) ?? 1;
  const label = action ? SCHEDULER_ACTION_LABELS[action] : undefined;

  if (!label) {
    return action ? `Scheduler: ${action}` : 'Scheduler activity';
  }

  if (action && COUNT_FIRST_ACTIONS.has(action)) {
    const plural = label.noun.endsWith('s') ? label.noun : `${label.noun}s`;
    return `${label.verb} ${count} ${count === 1 && !label.noun.endsWith('s') ? label.noun : plural}`;
  }

  if (count > 1) {
    const plural = label.noun.endsWith('s') ? label.noun : `${label.noun}s`;
    const namePart = entityName ? ` "${entityName}"` : '';
    return `${label.verb} ${count} ${plural}${namePart}`;
  }

  const namePart = entityName ? ` "${entityName}"` : '';
  return `${label.verb} ${label.noun}${namePart}`;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function eventDescription(item: ActivityFeedItem): string {
  switch (item.event_type) {
    case 'login':
      return 'Logged in';
    case 'logout':
      return 'Logged out';
    case 'tool_open':
      return `Opened ${item.tool_name || item.tool_id || 'a tool'}`;
    case 'tool_complete':
      return `Completed ${item.tool_name || item.tool_id || 'a tool'}`;
    case 'tool_error':
      return `Error in ${item.tool_name || item.tool_id || 'a tool'}`;
    case 'scheduler_action':
      return describeSchedulerAction(item.metadata || {});
    default:
      return item.event_type;
  }
}

function filterToParam(filter: FilterType): string | undefined {
  switch (filter) {
    case 'login': return 'login';
    case 'tool': return 'tool_complete';
    case 'scheduler': return 'scheduler_action';
    case 'error': return 'tool_error';
    default: return undefined;
  }
}

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string }> = {
  connecting: { color: '#f59e0b', label: 'Connecting' },
  live: { color: '#10b981', label: 'Live' },
  reconnecting: { color: '#f59e0b', label: 'Reconnecting' },
  offline: { color: '#94a3b8', label: 'Offline' },
};

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const { color, label } = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', fontWeight: 600, color, opacity: status === 'live' ? 0.7 : 1,
    }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%', background: color,
        animation: status === 'live' ? 'none' : 'pulse 1.5s infinite',
      }} />
      {label}
    </span>
  );
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchFeed = useCallback(async (pageNum: number, append: boolean) => {
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: '50' });
      const eventType = filterToParam(filter);
      if (eventType) params.set('event_type', eventType);

      const res = await fetch(`/api/activity/feed?${params}`);
      if (!res.ok) throw new Error('Failed to load activity feed');
      const data: ActivityFeedResponse = await res.json();

      setItems(prev => append ? [...prev, ...data.items] : data.items);
      setTotal(data.total);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    fetchFeed(1, false);
  }, [fetchFeed]);

  // Realtime: refetch page 1 on new inserts
  const connectionStatus = useImpactRealtime({
    onEvent: () => fetchFeed(1, false),
    debounceMs: 1500,
  });

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Logins', value: 'login' },
    { label: 'Tool Usage', value: 'tool' },
    { label: 'Scheduler', value: 'scheduler' },
    { label: 'Errors', value: 'error' },
  ];

  if (loading && items.length === 0) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontFamily: "'Montserrat', sans-serif" }}>
      Loading activity...
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', fontFamily: "'Montserrat', sans-serif" }}>
      Error: {error}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e', margin: 0 }}>
          Activity Feed
        </h2>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: filter === f.value ? '#0F7490' : '#e2e8f0',
              background: filter === f.value ? '#0F7490' : '#ffffff',
              color: filter === f.value ? '#ffffff' : '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            No activity found.
          </div>
        ) : (
          items.map((item) => {
            const dotColor = EVENT_COLORS[item.event_type] || '#9ca3af';
            const duration = item.metadata?.duration_seconds as number | undefined;

            return (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Colored dot */}
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a2e' }}>
                      {item.user_email || 'Anonymous'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#475569' }}>
                      {eventDescription(item)}
                    </span>
                    {duration != null && duration > 0 && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#0F7490',
                        background: '#f0f9ff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        {duration < 60 ? `${Math.round(duration)}s` : `${Math.round(duration / 60)}m`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Relative time */}
                <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {relativeTime(item.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {items.length < total && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => fetchFeed(page + 1, true)}
            style={{
              padding: '8px 24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
