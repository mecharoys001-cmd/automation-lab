'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActivityFeedItem, ActivityFeedResponse } from '@/types/activity';

type FilterType = 'all' | 'login' | 'tool' | 'error';

const EVENT_COLORS: Record<string, string> = {
  login: '#3b82f6',
  logout: '#3b82f6',
  tool_complete: '#10b981',
  tool_error: '#ef4444',
  tool_open: '#9ca3af',
};

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
    default:
      return item.event_type;
  }
}

function filterToParam(filter: FilterType): string | undefined {
  switch (filter) {
    case 'login': return 'login';
    case 'tool': return 'tool_complete';
    case 'error': return 'tool_error';
    default: return undefined;
  }
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

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchFeed(1, false), 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Logins', value: 'login' },
    { label: 'Tool Usage', value: 'tool' },
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
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
        Activity Feed
      </h2>

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
              borderColor: filter === f.value ? '#1282a2' : '#e2e8f0',
              background: filter === f.value ? '#1282a2' : '#ffffff',
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
                        color: '#1282a2',
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
