'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProgram } from '../ProgramContext';
import {
  Calendar, Download, ChevronDown, ChevronRight, ArrowRight,
  Clock, Tag, FileText, Users,
} from 'lucide-react';
import Link from 'next/link';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';

/* ── Types ─────────────────────────────────────────────────── */

interface SessionDetail {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  grade_groups: string[];
  instructor_name: string;
  venue_name: string;
  tags: string[];
  notes: string | null;
}

interface ReportData {
  hours_by_instructor: {
    instructor_id: string;
    name: string;
    total_minutes: number;
    total_hours: number;
  }[];
  hours_by_tag: {
    tag_id: string;
    tag_name: string;
    total_minutes: number;
    total_hours: number;
  }[];
  sessions_by_status: { status: string; count: number }[];
  unassigned_count: number;
  sessions: SessionDetail[];
  total_sessions: number;
}

type ReportTab = 'instructor-hours' | 'hours-by-tag';

/* ── Row Types ────────────────────────────────────────────── */

interface InstructorRow {
  id: string;
  name: string;
  totalHours: number;
  avgPerWeek: number;
  status: 'Active' | 'Part-time' | 'Substitute';
  avatarColor: string;
  monthly: { month: string; hours: number }[];
}

interface TagRow {
  name: string;
  emoji: string;
  totalHours: number;
  sessions: number;
  avgDuration: number;
  barColor: string;
}

const TAG_EMOJI: Record<string, string> = {
  strings: '🎻', brass: '🎺', choral: '🎤', piano: '🎹',
  percussion: '🥁', guitar: '🎸', woodwinds: '🎵',
};

import { getBarColor } from '../../lib/subjectColors';

const AVATAR_COLORS = [
  'bg-blue-100', 'bg-emerald-100', 'bg-violet-100',
  'bg-amber-100', 'bg-pink-100', 'bg-teal-100',
  'bg-indigo-100', 'bg-rose-100', 'bg-cyan-100',
];

/* ── Status badge config ───────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string; tooltip: string }> = {
  Active:      { bg: 'bg-emerald-100', text: 'text-emerald-700', tooltip: 'Staff member is actively teaching on a regular schedule' },
  'Part-time': { bg: 'bg-amber-100',   text: 'text-amber-800',   tooltip: 'Staff member works a reduced or part-time schedule' },
  Substitute:  { bg: 'bg-blue-100',    text: 'text-blue-700',    tooltip: 'Staff member fills in as a substitute on an as-needed basis' },
};

/* ── Helpers ────────────────────────────────────────────────── */

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatShortMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function computeWeeksBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

/* ── Staff Hours Tab ──────────────────────────────────── */

function InstructorHoursTab({
  instructors,
}: {
  instructors: InstructorRow[];
}) {
  const router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden overflow-x-auto">
      {/* Table Header */}
      <table className="w-full border-collapse min-w-[668px]">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <th scope="col" className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[280px]">
              <Tooltip text="Full name of the staff member">
                <span className="cursor-help">Staff Name</span>
              </Tooltip>
            </th>
            <th scope="col" className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[120px]">
              <Tooltip text="Cumulative hours taught across the selected date range">
                <span className="cursor-help">Total Hours</span>
              </Tooltip>
            </th>
            <th scope="col" className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[100px]">
              <Tooltip text="Average number of hours taught per week">
                <span className="cursor-help">Avg/Week</span>
              </Tooltip>
            </th>
            <th scope="col" className="text-center px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[120px]">
              <Tooltip text="Current employment status of the staff member">
                <span className="cursor-help">Status</span>
              </Tooltip>
            </th>
            <th scope="col" className="w-[48px] px-2 py-3">
              <Tooltip text="Expand row to view monthly breakdown">
                <span className="sr-only">Expand</span>
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {instructors.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Users className="w-8 h-8 text-slate-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">No staff hours available</p>
                    <p className="text-sm text-slate-700 mt-1">Add staff members and assign them to events to start tracking hours.</p>
                  </div>
                  <Link
                    href="/tools/scheduler/admin/people"
                    className="inline-flex items-center gap-1.5 mt-1 text-sm font-semibold text-[#3B82F6] hover:text-blue-700 transition-colors"
                  >
                    Go to Staff &amp; Venues
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </td>
            </tr>
          ) : (
            instructors.map((instructor) => {
              const isExpanded = expandedRows.has(instructor.id);
              const hasMonthly = instructor.monthly.length > 0;
              const statusStyle = STATUS_STYLES[instructor.status] ?? STATUS_STYLES.Active;
              const initials = instructor.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const maxMonthlyHours = hasMonthly
                ? Math.max(...instructor.monthly.map((m) => m.hours))
                : 1;

              return (
                <tr key={instructor.id} className="group">
                  {/* Main Row */}
                  <td colSpan={5} className="p-0 border-b border-[#E2E8F0]">
                    <Tooltip text={`Click to ${isExpanded ? 'collapse' : 'expand'} monthly breakdown for ${instructor.name}`}>
                      <div
                        className={`grid items-center px-5 h-14 transition-colors cursor-pointer hover:bg-blue-50/60 ${
                          isExpanded ? 'bg-blue-50/40' : ''
                        }`}
                        style={{ gridTemplateColumns: '280px 120px 100px 120px 48px' }}
                        role="button"
                        tabIndex={0}
                        onClick={() => hasMonthly && toggleRow(instructor.id)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && hasMonthly) {
                            e.preventDefault();
                            toggleRow(instructor.id);
                          }
                        }}
                      >
                        {/* Name + Avatar */}
                        <div className="flex items-center gap-3">
                          <Tooltip text={`${instructor.name} — ${instructor.status}`}>
                            <div
                              className={`flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-slate-600 ${instructor.avatarColor}`}
                            >
                              {initials}
                            </div>
                          </Tooltip>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {instructor.name}
                          </span>
                        </div>

                        {/* Total Hours */}
                        <Tooltip text={`${instructor.totalHours} total hours taught`}>
                          <span className="text-sm font-semibold text-slate-900 text-right tabular-nums block">
                            {instructor.totalHours} hrs
                          </span>
                        </Tooltip>

                        {/* Avg/Week */}
                        <Tooltip text={`${instructor.avgPerWeek} hours per week on average`}>
                          <span className="text-sm text-slate-600 text-right tabular-nums block">
                            {instructor.avgPerWeek}/wk
                          </span>
                        </Tooltip>

                        {/* Status Badge */}
                        <div className="flex justify-center">
                          <Tooltip text={statusStyle.tooltip}>
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
                            >
                              {instructor.status}
                            </span>
                          </Tooltip>
                        </div>

                        {/* Chevron */}
                        <div className="flex items-center justify-center">
                          {hasMonthly && (
                            <Tooltip text={isExpanded ? 'Collapse monthly view' : 'Expand monthly view'}>
                              <span>
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-slate-700" />
                                  : <ChevronRight className="w-4 h-4 text-slate-700" />
                                }
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </Tooltip>

                    {/* Expanded: 12-Month Grid (6 cols × 2 rows) */}
                    {isExpanded && hasMonthly && (
                      <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-5 py-4">
                        <div className="grid grid-cols-6 gap-2">
                          {instructor.monthly.map((m) => {
                            const pct = maxMonthlyHours > 0
                              ? (m.hours / maxMonthlyHours) * 100
                              : 0;
                            return (
                              <Tooltip
                                key={m.month}
                                text={`${instructor.name} — ${m.month}: ${m.hours} hours`}
                              >
                                <div className="flex flex-col gap-1.5 bg-white rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                                    {m.month}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                                    {m.hours}h
                                  </span>
                                  <ProgressBar
                                    value={pct}
                                    height={4}
                                    color="#3B82F6"
                                    trackColor="bg-slate-100"
                                  />
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>

                        {/* View Detail Button */}
                        <div className="mt-3">
                          <Tooltip text={`View weekly breakdown for ${instructor.name}`}>
                            <button
                              type="button"
                              className="text-[13px] font-semibold text-[#3B82F6] hover:text-blue-700 transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/tools/scheduler/admin/reports/staff/${instructor.id}`
                                );
                              }}
                            >
                              View Detail &rarr;
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Hours by Tag Tab ──────────────────────────────────────── */

function HoursByTagTab({
  tags,
}: {
  tags: TagRow[];
}) {
  const maxHours = tags.length > 0 ? Math.max(...tags.map((t) => t.totalHours)) : 1;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse min-w-[560px]">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <th scope="col" className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <Tooltip text="Event type category with associated emoji">
                <span className="cursor-help">Tag</span>
              </Tooltip>
            </th>
            <th scope="col" className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[120px]">
              <Tooltip text="Total hours of instruction for this tag across the date range">
                <span className="cursor-help">Total Hours</span>
              </Tooltip>
            </th>
            <th scope="col" className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[100px]">
              <Tooltip text="Number of individual events tagged with this category">
                <span className="cursor-help">Events</span>
              </Tooltip>
            </th>
            <th scope="col" className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider w-[120px]">
              <Tooltip text="Average length of each event in minutes">
                <span className="cursor-help">Avg Duration</span>
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {tags.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Tag className="w-8 h-8 text-slate-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">No tag data available</p>
                    <p className="text-sm text-slate-700 mt-1">Create event tags and apply them to templates to see reporting breakdowns.</p>
                  </div>
                  <Link
                    href="/tools/scheduler/admin/tags"
                    className="inline-flex items-center gap-1.5 mt-1 text-sm font-semibold text-[#3B82F6] hover:text-blue-700 transition-colors"
                  >
                    Go to Tags
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </td>
            </tr>
          ) : (
            tags.map((tag, idx) => {
              const pct = maxHours > 0 ? (tag.totalHours / maxHours) * 100 : 0;
              const isLast = idx === tags.length - 1;

              return (
                <tr
                  key={tag.name}
                  className={`hover:bg-blue-50/40 transition-colors ${!isLast ? 'border-b border-[#E2E8F0]' : ''}`}
                >
                  {/* Tag cell: emoji + name + proportional bar */}
                  <td className="px-5 py-3.5">
                    <Tooltip text={`${tag.emoji} ${tag.name}: ${tag.totalHours} hours across ${tag.sessions} events`}>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-slate-900">
                          {tag.emoji}&nbsp;&nbsp;{tag.name}
                        </span>
                        <div className="max-w-[320px]">
                          <ProgressBar
                            value={pct}
                            height={6}
                            color={tag.barColor}
                            trackColor="bg-slate-100"
                          />
                        </div>
                      </div>
                    </Tooltip>
                  </td>

                  {/* Total Hours */}
                  <td className="px-5 py-3.5 text-right">
                    <Tooltip text={`${tag.totalHours} total hours for ${tag.name}`}>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {tag.totalHours} hrs
                      </span>
                    </Tooltip>
                  </td>

                  {/* Sessions */}
                  <td className="px-5 py-3.5 text-right">
                    <Tooltip text={`${tag.sessions} events tagged as ${tag.name}`}>
                      <span className="text-sm text-slate-600 tabular-nums">
                        {tag.sessions}
                      </span>
                    </Tooltip>
                  </td>

                  {/* Avg Duration */}
                  <td className="px-5 py-3.5 text-right">
                    <Tooltip text={`Average session duration: ${tag.avgDuration} minutes`}>
                      <span className="text-sm text-slate-600 tabular-nums">
                        {tag.avgDuration} min
                      </span>
                    </Tooltip>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function ReportsPage() {
  const { programs, selectedProgramId } = useProgram();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('instructor-hours');

  const programId = selectedProgramId ?? '';

  // Initialize date range from selected program
  useEffect(() => {
    if (programId && programs.length > 0) {
      const program = programs.find((p) => p.id === programId);
      if (program) {
        if (!startDate) setStartDate(program.start_date);
        if (!endDate) setEndDate(program.end_date);
      }
    }
  }, [programId, programs, startDate, endDate]);

  // Fetch report data (and re-fetch every 30s for real-time updates)
  useEffect(() => {
    if (!programId || !startDate || !endDate) return;

    const fetchReport = () => {
      const params = new URLSearchParams({ programId, startDate, endDate });
      fetch(`/api/reports/summary?${params}`)
        .then((r) => r.json())
        .then((data) => { if (data.success) setReportData(data); })
        .catch(() => {});
    };

    fetchReport();
    const interval = setInterval(fetchReport, 30_000);
    return () => clearInterval(interval);
  }, [programId, startDate, endDate]);

  // Build instructor rows from API data or fallback to samples
  const instructors = useMemo((): InstructorRow[] => {
    if (!reportData || reportData.hours_by_instructor.length === 0) {
      return [];
    }

    const weeks = computeWeeksBetween(startDate, endDate);

    // Compute monthly breakdown from session details
    const monthlyByInstructor = new Map<string, Map<string, number>>();
    if (reportData.sessions) {
      for (const s of reportData.sessions) {
        if (s.status === 'canceled' || s.instructor_name === 'Unassigned') continue;
        const monthKey = s.date.substring(0, 7);
        let instructorMap = monthlyByInstructor.get(s.instructor_name);
        if (!instructorMap) {
          instructorMap = new Map();
          monthlyByInstructor.set(s.instructor_name, instructorMap);
        }
        instructorMap.set(monthKey, (instructorMap.get(monthKey) ?? 0) + s.duration_minutes);
      }
    }

    return reportData.hours_by_instructor
      .sort((a, b) => b.total_hours - a.total_hours)
      .map((h, idx) => {
        const monthlyMap = monthlyByInstructor.get(h.name);
        const months = monthlyMap
          ? Array.from(monthlyMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, mins]) => ({
                month: formatShortMonth(key),
                hours: Math.round(mins / 60),
              }))
          : [];

        const avgPerWeek = Math.round((h.total_hours / weeks) * 10) / 10;

        let status: 'Active' | 'Part-time' | 'Substitute' = 'Active';
        if (avgPerWeek < 4) status = 'Substitute';
        else if (avgPerWeek < 8) status = 'Part-time';

        return {
          id: h.instructor_id,
          name: h.name,
          totalHours: Math.round(h.total_hours),
          avgPerWeek,
          status,
          avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          monthly: months,
        };
      });
  }, [reportData, startDate, endDate]);

  // Build tag rows from API data or fallback to samples
  const tags = useMemo((): TagRow[] => {
    if (!reportData || reportData.hours_by_tag.length === 0) {
      return [];
    }

    const tagStats = new Map<string, { count: number; totalMinutes: number }>();
    if (reportData.sessions) {
      for (const s of reportData.sessions) {
        if (s.status === 'canceled') continue;
        for (const tagName of s.tags) {
          const existing = tagStats.get(tagName) ?? { count: 0, totalMinutes: 0 };
          existing.count += 1;
          existing.totalMinutes += s.duration_minutes;
          tagStats.set(tagName, existing);
        }
      }
    }

    return reportData.hours_by_tag
      .sort((a, b) => b.total_hours - a.total_hours)
      .map((t, idx) => {
        const key = t.tag_name.toLowerCase();
        const stats = tagStats.get(t.tag_name);
        const sessionCount = stats?.count ?? 0;
        const avgDuration = sessionCount > 0
          ? Math.round(stats!.totalMinutes / sessionCount)
          : 0;

        return {
          name: t.tag_name,
          emoji: TAG_EMOJI[key] ?? '🎵',
          totalHours: Math.round(t.total_hours),
          sessions: sessionCount,
          avgDuration,
          barColor: getBarColor(key, idx),
        };
      });
  }, [reportData]);

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (programId) params.set('program_id', programId);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    window.open(`/api/reports/export-csv?${params}`, '_blank');
  };

  const dateRangeLabel = startDate && endDate
    ? `${formatMonthYear(startDate)} \u2014 ${formatMonthYear(endDate)}`
    : 'Select a date range';

  const TABS: { key: ReportTab; label: string; icon: typeof Clock; tooltip: string }[] = [
    { key: 'instructor-hours', label: 'Staff Hours', icon: Clock, tooltip: 'View hours and monthly breakdown per staff member' },
    { key: 'hours-by-tag', label: 'Hours by Tag', icon: Tag, tooltip: 'View time distribution across event types and tags' },
  ];

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F8FAFC' }}>
      {/* ─── Top Bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white px-4 sm:px-8 py-3 sm:min-h-[4rem] border-b border-[#E2E8F0]">
        <Tooltip text="Reports dashboard — view staff hours and tag breakdowns">
          <h1 className="text-2xl font-bold text-slate-900 cursor-default mr-auto">Reports</h1>
        </Tooltip>

        <Tooltip text="Select date range for report data — click to change period">
          <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg px-4 py-2 cursor-pointer hover:border-slate-300 transition-colors">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="text-[13px] font-medium text-slate-900">{dateRangeLabel}</span>
            <ChevronDown className="w-4 h-4 text-slate-700" />
          </div>
        </Tooltip>

        <Tooltip text="Download report data as a CSV spreadsheet">
          <Button
            variant="primary"
            icon={<Download className="w-4 h-4" />}
            onClick={exportCSV}
          >
            Export CSV
          </Button>
        </Tooltip>
      </div>

      {/* ─── Quick Links ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50 to-violet-50 px-4 sm:px-8 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Tooltip text="View event counts by template with filtering and sorting">
            <Link
              href="/tools/scheduler/admin/reports/sessions-by-template"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-[13px] font-medium text-blue-700"
            >
              <FileText className="w-4 h-4" />
              View Sessions by Template
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Tooltip>
        </div>
      </div>

      {/* ─── Tab Navigation ───────────────────────────────── */}
      <div className="bg-white px-4 sm:px-8 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-0">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Tooltip key={tab.key} text={tab.tooltip}>
                <button
                  type="button"
                  className={`relative flex items-center gap-2 px-5 py-3.5 text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'font-semibold text-[#3B82F6]'
                      : 'font-medium text-slate-600 hover:text-slate-700'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? 'text-[#3B82F6]' : 'text-slate-700'}`} />
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        {activeTab === 'instructor-hours' && (
          <InstructorHoursTab instructors={instructors} />
        )}
        {activeTab === 'hours-by-tag' && (
          <HoursByTagTab tags={tags} />
        )}
      </div>
    </div>
  );
}
