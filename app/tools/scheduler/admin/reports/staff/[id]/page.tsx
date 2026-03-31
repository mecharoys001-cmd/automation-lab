'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, Tag, Hash, Loader2, AlertCircle, ChevronRight,
} from 'lucide-react';
import { Tooltip } from '../../../../components/ui/Tooltip';
import { Button } from '../../../../components/ui/Button';
import { Pill } from '../../../../components/ui/Pill';

/* ── Types ─────────────────────────────────────────────────── */

interface SessionDetail {
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
}

interface WeeklyBreakdown {
  week: string;
  hours: number;
  session_count: number;
  sessions: SessionDetail[];
}

interface HoursByTag {
  tag_name: string;
  hours: number;
  session_count: number;
}

interface InstructorDetailData {
  instructor: { id: string; name: string };
  weekly_breakdown: WeeklyBreakdown[];
  hours_by_tag: HoursByTag[];
  total_hours: number;
  total_sessions: number;
}

type DetailTab = 'weekly' | 'tags';

/* ── Helpers ───────────────────────────────────────────────── */

import { getSubjectColor } from '../../../../lib/subjectColors';

import { getBarColor } from '../../../../lib/subjectColors';

function getTagColor(tagName: string): { bg: string; text: string } {
  const c = getSubjectColor(tagName);
  return { bg: c.badgeBg, text: c.badgeText };
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDefaultDates(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/* ── Tab Config ────────────────────────────────────────────── */

const TABS: { key: DetailTab; label: string; icon: typeof Clock; tooltip: string }[] = [
  { key: 'weekly', label: 'Weekly Breakdown', icon: Calendar, tooltip: 'Hours and events per week' },
  { key: 'tags', label: 'Hours by Tag', icon: Tag, tooltip: 'Time distribution across tags' },
];

/* ── Page ──────────────────────────────────────────────────── */

export default function InstructorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = params.id as string;

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<InstructorDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('weekly');

  const fetchData = useCallback(async () => {
    if (!instructorId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ instructorId });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/reports/staff-detail?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Failed to load staff data');
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError('Network error — could not reach the server');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [instructorId, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const goBack = () => router.push('/tools/scheduler/admin/reports');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ─── Top Bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-4 bg-white px-4 sm:px-8 py-4 border-b border-slate-200">
        <Button variant="ghost" size="sm" onClick={goBack} tooltip="Back to Reports">
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-slate-900">
            {loading && !data ? 'Loading…' : data?.instructor.name ?? 'Staff Detail'}
          </h1>
          {data && (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Tooltip text="Total hours across the selected date range">
                <span className="flex items-center gap-1 cursor-help">
                  <Clock className="w-3.5 h-3.5" />
                  {data.total_hours}h total
                </span>
              </Tooltip>
              <Tooltip text="Total events across the selected date range">
                <span className="flex items-center gap-1 cursor-help">
                  <Hash className="w-3.5 h-3.5" />
                  {data.total_sessions} event{data.total_sessions !== 1 ? 's' : ''}
                </span>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Date Range Picker */}
        <Tooltip text="Filter report by start date">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-[13px] font-medium text-slate-700 bg-transparent outline-none"
            />
          </div>
        </Tooltip>

        <span className="text-sm text-slate-700">–</span>

        <Tooltip text="Filter report by end date">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-[13px] font-medium text-slate-700 bg-transparent outline-none"
            />
          </div>
        </Tooltip>
      </div>

      {/* ─── Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-700 animate-spin" />
            <span className="ml-3 text-sm text-slate-600">Loading staff data…</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
              <AlertCircle className="w-6 h-6 text-red-700" />
            </div>
            <p className="text-sm font-medium text-slate-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>
              Try Again
            </Button>
          </div>
        )}

        {/* Data Loaded */}
        {!loading && !error && data && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Tooltip text="Total hours for this staff member in the selected range">
                <div className="flex items-center gap-3.5 bg-white rounded-xl border border-slate-200 p-5 transition-shadow hover:shadow-sm">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-100">
                    <Clock className="w-[22px] h-[22px] text-blue-600" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Total Hours</span>
                    <span className="text-[28px] font-bold leading-none text-slate-900 tabular-nums">{data.total_hours}h</span>
                  </div>
                </div>
              </Tooltip>

              <Tooltip text="Total events for this staff member in the selected range">
                <div className="flex items-center gap-3.5 bg-white rounded-xl border border-slate-200 p-5 transition-shadow hover:shadow-sm">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-emerald-100">
                    <Hash className="w-[22px] h-[22px] text-emerald-700" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Total Events</span>
                    <span className="text-[28px] font-bold leading-none text-slate-900 tabular-nums">{data.total_sessions}</span>
                  </div>
                </div>
              </Tooltip>

              <Tooltip text="Number of weeks with at least one event">
                <div className="flex items-center gap-3.5 bg-white rounded-xl border border-slate-200 p-5 transition-shadow hover:shadow-sm">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-amber-100">
                    <Calendar className="w-[22px] h-[22px] text-amber-800" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Active Weeks</span>
                    <span className="text-[28px] font-bold leading-none text-slate-900 tabular-nums">{data.weekly_breakdown.length}</span>
                  </div>
                </div>
              </Tooltip>

              <Tooltip text="Number of distinct tags across events">
                <div className="flex items-center gap-3.5 bg-white rounded-xl border border-slate-200 p-5 transition-shadow hover:shadow-sm">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#EDE9FE]">
                    <Tag className="w-[22px] h-[22px] text-violet-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Tags</span>
                    <span className="text-[28px] font-bold leading-none text-slate-900 tabular-nums">{data.hours_by_tag.length}</span>
                  </div>
                </div>
              </Tooltip>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit">
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <Tooltip key={tab.key} text={tab.tooltip}>
                    <button
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      <TabIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-700'}`} />
                      {tab.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>

            {/* Weekly Breakdown Tab */}
            {activeTab === 'weekly' && (
              <WeeklyBreakdownTable rows={data.weekly_breakdown} />
            )}

            {/* Hours by Tag Tab */}
            {activeTab === 'tags' && (
              <HoursByTagTable rows={data.hours_by_tag} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-Components ──────────────────────────────────────── */

function WeeklyBreakdownTable({ rows }: { rows: WeeklyBreakdown[] }) {
  const maxHours = rows.length > 0 ? Math.max(...rows.map((r) => r.hours)) : 1;
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const toggleWeek = (week: string) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week); else next.add(week);
      return next;
    });
  };

  const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-200">
        <Calendar className="w-[18px] h-[18px] text-slate-700" />
        <h2 className="text-base font-semibold text-slate-900">Weekly Breakdown</h2>
        <span className="text-xs font-medium text-slate-700 ml-auto">
          {rows.length} week{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[24px_minmax(160px,1fr)_80px_80px_1fr] items-center px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        <span />
        <span>Week Starting</span>
        <span className="text-right">Hours</span>
        <span className="text-right">Events</span>
        <span className="pl-4">Distribution</span>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-700">
          No weekly data available for this date range.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const pct = (row.hours / maxHours) * 100;
            const isExpanded = expandedWeeks.has(row.week);
            return (
              <div key={row.week} style={{ display: 'block' }}>
                <div
                  className="grid grid-cols-[24px_minmax(160px,1fr)_80px_80px_1fr] items-center px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  onClick={() => toggleWeek(row.week)}
                >
                  <ChevronRight className={`w-4 h-4 text-slate-700 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <span className="text-[13px] font-medium text-slate-900">
                    {formatWeekLabel(row.week)}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900 text-right tabular-nums">
                    {row.hours}h
                  </span>
                  <span className="text-[13px] text-slate-600 text-right tabular-nums">
                    {row.session_count}
                  </span>
                  <div className="pl-4 pr-2">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
                {/* Expanded session list */}
                {isExpanded && row.sessions && row.sessions.length > 0 && (
                  <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-2">
                    <div className="grid grid-cols-4 gap-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-700 pl-6">
                      <span>Event</span>
                      <span>Date</span>
                      <span>Time</span>
                      <span>Venue</span>
                    </div>
                    {row.sessions.map((s, idx) => {
                      const dayName = s.date ? DAY_NAMES_SHORT[new Date(s.date + 'T00:00:00').getDay()] : '';
                      return (
                        <div key={idx} className="grid grid-cols-4 gap-4 py-1.5 pl-6 text-[12px] text-slate-600 border-t border-slate-100/50 first:border-t-0">
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span>{dayName} {s.date}</span>
                          <span>{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                          <span className="text-slate-600">{s.venue}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HoursByTagTable({ rows }: { rows: HoursByTag[] }) {
  const maxHours = rows.length > 0 ? Math.max(...rows.map((r) => r.hours)) : 1;
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-200">
        <Tag className="w-[18px] h-[18px] text-slate-700" />
        <h2 className="text-base font-semibold text-slate-900">Hours by Tag</h2>
        <Tooltip text="Total hours across all tags (sessions may have multiple tags)">
          <span className="text-xs font-medium text-slate-700 ml-auto cursor-help">
            {Math.round(totalHours * 10) / 10}h total
          </span>
        </Tooltip>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[minmax(160px,auto)_100px_100px_1fr] items-center px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        <span>Tag</span>
        <span className="text-right">Hours</span>
        <span className="text-right">Sessions</span>
        <span className="pl-4">Distribution</span>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-700">
          No tag data available for this date range.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row, idx) => {
            const colors = getTagColor(row.tag_name);
            const barColor = getBarColor(row.tag_name, idx);
            const pct = maxHours > 0 ? (row.hours / maxHours) * 100 : 0;
            const percentage = totalHours > 0 ? Math.round((row.hours / totalHours) * 1000) / 10 : 0;

            return (
              <Tooltip
                key={row.tag_name}
                text={`${row.tag_name}: ${row.hours}h across ${row.session_count} event${row.session_count !== 1 ? 's' : ''} (${percentage}% of total)`}
                style={{ display: 'block' }}
              >
                <div className="grid grid-cols-[minmax(160px,auto)_100px_100px_1fr] items-center px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <Pill variant="tag" bgColor={colors.bg} textColor={colors.text}>
                      {row.tag_name}
                    </Pill>
                  </div>
                  <span className="text-[13px] font-semibold text-slate-900 text-right tabular-nums">
                    {row.hours}h
                  </span>
                  <span className="text-[13px] text-slate-600 text-right tabular-nums">
                    {row.session_count}
                  </span>
                  <div className="pl-4 pr-2">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
