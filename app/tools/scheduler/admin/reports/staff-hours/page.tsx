'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Download } from 'lucide-react';
import { useProgram } from '../../ProgramContext';
import { requestCache } from '@/lib/requestCache';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import { ReportsTabBar } from '../../../components/reports/ReportsTabBar';
import { InstructorHoursTable } from '../../../components/reports/InstructorHoursTable';
import type { InstructorRow } from '../../../components/reports/InstructorHoursTable';

/* ── Types ─────────────────────────────────────────────── */

interface SessionDetail {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  instructor_name: string;
}

interface ReportData {
  hours_by_instructor: {
    instructor_id: string;
    name: string;
    total_minutes: number;
    total_hours: number;
  }[];
  sessions: SessionDetail[];
}

/* ── Fallback data matching design spec ────────────────── */

const FALLBACK_INSTRUCTORS: InstructorRow[] = [
  {
    id: 'sarah-johnson',
    name: 'Sarah Johnson',
    totalHours: 487,
    avgPerWeek: 12.1,
    status: 'Active',
    avatarColor: 'bg-blue-100',
    monthly: [
      { month: 'Nov', hours: 48, opacity: 1.0 },
      { month: 'Dec', hours: 36, opacity: 0.7 },
      { month: 'Jan', hours: 52, opacity: 1.0 },
      { month: 'Feb', hours: 48, opacity: 1.0 },
      { month: 'Mar', hours: 44, opacity: 0.85 },
      { month: 'Apr', hours: 40, opacity: 0.77 },
    ],
  },
  {
    id: 'mark-davis',
    name: 'Mark Davis',
    totalHours: 342,
    avgPerWeek: 8.5,
    status: 'Active',
    avatarColor: 'bg-emerald-100',
    monthly: [],
  },
  {
    id: 'lisa-chen',
    name: 'Lisa Chen',
    totalHours: 256,
    avgPerWeek: 6.4,
    status: 'Part-time',
    avatarColor: 'bg-violet-100',
    monthly: [],
  },
  {
    id: 'james-wilson',
    name: 'James Wilson',
    totalHours: 198,
    avgPerWeek: 4.9,
    status: 'Part-time',
    avatarColor: 'bg-amber-100',
    monthly: [],
  },
  {
    id: 'emily-rodriguez',
    name: 'Emily Rodriguez',
    totalHours: 156,
    avgPerWeek: 3.9,
    status: 'Substitute',
    avatarColor: 'bg-pink-100',
    monthly: [],
  },
  {
    id: 'david-kim',
    name: 'David Kim',
    totalHours: 124,
    avgPerWeek: 3.1,
    status: 'Active',
    avatarColor: 'bg-teal-100',
    monthly: [],
  },
];

const AVATAR_COLORS = [
  'bg-blue-100', 'bg-emerald-100', 'bg-violet-100',
  'bg-amber-100', 'bg-pink-100', 'bg-teal-100',
  'bg-indigo-100', 'bg-rose-100', 'bg-cyan-100',
];

/* ── Helpers ───────────────────────────────────────────── */

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

/* ── Page ──────────────────────────────────────────────── */

export default function InstructorHoursPage() {
  const { programs, selectedProgramId } = useProgram();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);

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

  // Fetch report data
  useEffect(() => {
    if (!programId || !startDate || !endDate) return;
    const params = new URLSearchParams({ programId, startDate, endDate });
    fetch(`/api/reports/summary?${params}`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setReportData(data); })
      .catch(() => {});
  }, [programId, startDate, endDate]);

  // Fetch ALL instructors for this program (so 0-hour staff appear too)
  const [allStaff, setAllStaff] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  useEffect(() => {
    if (!programId) return;
    requestCache.fetch<{ instructors?: Array<{ id: string; first_name: string; last_name: string }> }>(
      `/api/instructors?program_id=${programId}&is_active=true`
    )
      .then(data => setAllStaff(data.instructors ?? []))
      .catch(() => {});
  }, [programId]);

  // Build instructor rows from API data — always dynamic, never fallback
  const instructors = useMemo((): InstructorRow[] => {
    if (!reportData) return [];

    const weeks = computeWeeksBetween(startDate, endDate);

    // Compute monthly breakdown from sessions
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

    const rows = reportData.hours_by_instructor
      .sort((a, b) => b.total_hours - a.total_hours)
      .map((h, idx) => {
        const monthlyMap = monthlyByInstructor.get(h.name);
        const months = monthlyMap
          ? Array.from(monthlyMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, mins], i, arr) => ({
                month: formatShortMonth(key),
                hours: Math.round(mins / 60),
                opacity: i === 0 ? 1.0 : 0.7 + (i / arr.length) * 0.3,
              }))
          : [];

        const avgPerWeek = Math.round((h.total_hours / weeks) * 10) / 10;

        // Determine status heuristic
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

    // Add staff with 0 hours (not in the report data)
    const reportedIds = new Set(reportData.hours_by_instructor.map(h => h.instructor_id));
    const zeroHourStaff: InstructorRow[] = allStaff
      .filter(s => !reportedIds.has(s.id))
      .map((s, idx) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        totalHours: 0,
        avgPerWeek: 0,
        status: 'Active' as const,
        avatarColor: AVATAR_COLORS[(rows.length + idx) % AVATAR_COLORS.length],
        monthly: [],
      }));

    return [...rows, ...zeroHourStaff];
  }, [reportData, startDate, endDate, allStaff]);

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (programId) params.set('program_id', programId);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    window.open(`/api/reports/export-csv?${params}`, '_blank');
  };

  const dateRangeLabel = startDate && endDate
    ? `${formatMonthYear(startDate)} \u2014 ${formatMonthYear(endDate)}`
    : 'Nov 2025 \u2014 Jun 2026';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white px-4 sm:px-8 py-3 sm:py-0 sm:h-16 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mr-auto">Reports</h1>

        <Tooltip text="Select date range for report data">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2 cursor-default">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="text-[13px] font-medium text-slate-900">{dateRangeLabel}</span>
            <ChevronDown className="w-4 h-4 text-slate-600" />
          </div>
        </Tooltip>

        <Button
          variant="primary"
          icon={<Download className="w-4 h-4" />}
          tooltip="Export report data as CSV file"
          onClick={exportCSV}
        >
          Export CSV
        </Button>
      </div>

      {/* Tab Bar */}
      <ReportsTabBar />

      {/* Table Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <InstructorHoursTable instructors={instructors} />
      </div>
    </div>
  );
}
