'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, Filter, RefreshCw, Users, MousePointerClick, FileText, Eye } from 'lucide-react';

interface AnalyticsEvent {
  id: string;
  user_id: string;
  user_email: string;
  session_id: string;
  event_type: string;
  page_path: string;
  element_id: string | null;
  element_text: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Summary {
  totalEvents: number;
  pageViews: number;
  buttonClicks: number;
  formSubmits: number;
  uniqueUsers: number;
  uniqueSessions: number;
  topPages: { path: string; count: number }[];
  topButtons: { label: string; count: number }[];
  topUsers: { user: string; count: number }[];
  eventsPerDay: { date: string; count: number }[];
  periodDays: number;
}

export default function AnalyticsAdminPage() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'events'>('overview');

  // Filters
  const [userEmail, setUserEmail] = useState('');
  const [eventType, setEventType] = useState('');
  const [pagePath, setPagePath] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (userEmail) params.set('user_email', userEmail);
    if (eventType) params.set('event_type', eventType);
    if (pagePath) params.set('page_path', pagePath);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));

    const res = await fetch(`/api/analytics/events?${params}`);
    const json = await res.json();
    if (res.ok) {
      setEvents(json.data);
      setTotal(json.total);
    }
  }, [userEmail, eventType, pagePath, startDate, endDate, page]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch('/api/analytics/summary?days=30');
    const json = await res.json();
    if (res.ok) setSummary(json);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEvents(), fetchSummary()]);
    setLoading(false);
  }, [fetchEvents, fetchSummary]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (eventType) params.set('event_type', eventType);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    window.open(`/api/analytics/export?${params}`, '_blank');
  };

  const resetFilters = () => {
    setUserEmail('');
    setEventType('');
    setPagePath('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Analytics</h1>
              <p className="text-sm text-gray-500">30-day event tracking dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> JSON
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-gray-200 w-fit">
          <button
            onClick={() => setTab('overview')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'overview' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab('events')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'events' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Event Log
          </button>
        </div>

        {tab === 'overview' && summary && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total Events" value={summary.totalEvents} color="indigo" />
              <StatCard icon={<Eye className="w-5 h-5" />} label="Page Views" value={summary.pageViews} color="blue" />
              <StatCard icon={<MousePointerClick className="w-5 h-5" />} label="Clicks" value={summary.buttonClicks} color="green" />
              <StatCard icon={<FileText className="w-5 h-5" />} label="Form Submits" value={summary.formSubmits} color="purple" />
              <StatCard icon={<Users className="w-5 h-5" />} label="Unique Users" value={summary.uniqueUsers} color="orange" />
              <StatCard icon={<Users className="w-5 h-5" />} label="Sessions" value={summary.uniqueSessions} color="pink" />
            </div>

            {/* Activity Chart */}
            {summary.eventsPerDay.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity</h2>
                <div className="flex items-end gap-1 h-40">
                  {summary.eventsPerDay.map(({ date, count }) => {
                    const maxCount = Math.max(...summary.eventsPerDay.map(d => d.count));
                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                          {date}: {count}
                        </div>
                        <div
                          className="w-full bg-indigo-400 hover:bg-indigo-500 rounded-t transition-colors min-h-[2px]"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Lists */}
            <div className="grid md:grid-cols-3 gap-6">
              <TopList title="Top Pages" items={summary.topPages.map(p => ({ label: p.path, count: p.count }))} />
              <TopList title="Top Buttons" items={summary.topButtons.map(b => ({ label: b.label, count: b.count }))} />
              <TopList title="Most Active Users" items={summary.topUsers.map(u => ({ label: u.user, count: u.count }))} />
            </div>
          </>
        )}

        {tab === 'events' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="User email"
                  value={userEmail}
                  onChange={e => { setUserEmail(e.target.value); setPage(0); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                  value={eventType}
                  onChange={e => { setEventType(e.target.value); setPage(0); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All event types</option>
                  <option value="page_view">Page View</option>
                  <option value="button_click">Button Click</option>
                  <option value="form_submit">Form Submit</option>
                </select>
                <input
                  type="text"
                  placeholder="Page path"
                  value={pagePath}
                  onChange={e => { setPagePath(e.target.value); setPage(0); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setPage(0); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setPage(0); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                onClick={resetFilters}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
              >
                Reset filters
              </button>
            </div>

            {/* Event Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Page</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Element</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          {loading ? 'Loading...' : 'No events found'}
                        </td>
                      </tr>
                    )}
                    {events.map(event => (
                      <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(event.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">
                          {event.user_email}
                        </td>
                        <td className="px-4 py-3">
                          <EventTypeBadge type={event.event_type} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate font-mono text-xs">
                          {event.page_path}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">
                          {event.element_text || event.element_id || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                          {event.session_id.slice(0, 8)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <span className="text-sm text-gray-600">
                    Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  purple: 'bg-purple-50 text-purple-700',
  orange: 'bg-orange-50 text-orange-700',
  pink: 'bg-pink-50 text-pink-700',
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorMap[color] || colorMap.indigo}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    page_view: 'bg-blue-100 text-blue-700',
    button_click: 'bg-green-100 text-green-700',
    form_submit: 'bg-purple-100 text-purple-700',
  };
  const labels: Record<string, string> = {
    page_view: 'View',
    button_click: 'Click',
    form_submit: 'Submit',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
      {labels[type] || type}
    </span>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  const maxCount = items.length > 0 ? items[0].count : 1;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {items.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
      <div className="space-y-3">
        {items.map(({ label, count }, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 truncate mr-2" title={label}>{label}</span>
              <span className="text-gray-500 flex-shrink-0">{count}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-indigo-400 h-1.5 rounded-full"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
