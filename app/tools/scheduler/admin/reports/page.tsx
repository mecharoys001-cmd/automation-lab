'use client';

import { useState, useEffect } from 'react';
import { useProgram } from '../ProgramContext';
import Link from 'next/link';
import Tooltip from '../../components/Tooltip';

interface HoursByInstructor {
  instructor_id: string;
  name: string;
  total_minutes: number;
  total_hours: number;
}

interface HoursByTag {
  tag_id: string;
  tag_name: string;
  total_minutes: number;
  total_hours: number;
}

interface SessionsByStatus {
  status: string;
  count: number;
}

interface ReportSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  grade_groups: string[];
  is_makeup: boolean;
  needs_resolution: boolean;
  instructor_name: string;
  venue_name: string;
  tags: string[];
  notes: string | null;
}

interface ReportData {
  hours_by_instructor: HoursByInstructor[];
  hours_by_tag: HoursByTag[];
  sessions_by_status: SessionsByStatus[];
  unassigned_count: number;
  sessions: ReportSession[];
  total_sessions: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-yellow-400',
  published: 'text-green-400',
  canceled: 'text-red-400',
  completed: 'text-blue-400',
};

const STATUS_BG: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-400',
  published: 'bg-green-500/20 text-green-400',
  canceled: 'bg-red-500/20 text-red-400',
  completed: 'bg-blue-500/20 text-blue-400',
};

export default function ReportsPage() {
  const { programs, selectedProgramId } = useProgram();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const programId = selectedProgramId ?? '';

  // Default date range to current semester (selected program's start/end)
  useEffect(() => {
    if (programId && programs.length > 0) {
      const program = programs.find((p) => p.id === programId);
      if (program) {
        if (!startDate) setStartDate(program.start_date);
        if (!endDate) setEndDate(program.end_date);
      }
    }
  }, [programId, programs, startDate, endDate]);

  const fetchReport = async () => {
    if (!programId || !startDate || !endDate) {
      setError('Please select a program, start date, and end date.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        programId,
        startDate,
        endDate,
      });

      const res = await fetch(`/api/reports/summary?${params}`);
      const data = await res.json();

      if (data.success) {
        setReportData(data);
      } else {
        setError(data.error ?? 'Failed to fetch report.');
      }
    } catch {
      setError('Network error fetching report.');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    // Use the server-side CSV export endpoint
    const params = new URLSearchParams();
    if (programId) params.set('program_id', programId);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    window.open(`/api/reports/export-csv?${params}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Reports &amp; Metrics</h1>
        <p className="text-muted-foreground mt-1">
          Hours by instructor, sessions by status, tag breakdowns, and CSV export.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Program
            </label>
            <div className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {programs.find((p) => p.id === programId)?.name ?? 'Select in sidebar'}
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Start Date
            </label>
            <Tooltip text="Filter sessions from this date" position="bottom">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Tooltip>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              End Date
            </label>
            <Tooltip text="Filter sessions up to this date" position="bottom">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Tooltip>
          </div>
          <Tooltip text="Fetch report data for the selected date range">
            <button
              onClick={fetchReport}
              disabled={loading || !programId || !startDate || !endDate}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </Tooltip>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Report Content */}
      {reportData && (
        <>
          {/* Four Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hours by Instructor card */}
            <Tooltip text="Total scheduled hours per instructor" position="bottom">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Hours by Instructor</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">
                  {reportData.hours_by_instructor.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reportData.hours_by_instructor.reduce((sum, h) => sum + h.total_hours, 0).toFixed(1)} total hrs
                </p>
              </div>
            </Tooltip>

            {/* Hours by Tag card */}
            <Tooltip text="Hours grouped by session tag" position="bottom">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Hours by Tag</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">
                  {reportData.hours_by_tag.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {reportData.hours_by_tag.reduce((sum, h) => sum + h.total_hours, 0).toFixed(1)} tagged hrs
                </p>
              </div>
            </Tooltip>

            {/* Status Breakdown card */}
            <Tooltip text="Session counts by status" position="bottom">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Status Breakdown</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">
                  {reportData.total_sessions}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {reportData.sessions_by_status.map((s) => (
                    <span key={s.status} className={`text-xs ${STATUS_COLORS[s.status] ?? 'text-muted-foreground'}`}>
                      {s.count} {s.status}
                    </span>
                  ))}
                </div>
              </div>
            </Tooltip>

            {/* Unassigned Count card with quick-link */}
            <Tooltip text="Sessions without an assigned instructor" position="bottom">
              <Link
                href="/tools/scheduler/admin"
                className="rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 transition-colors group block"
              >
                <p className="text-xs text-muted-foreground">Unassigned Count</p>
                <p className={`text-2xl font-semibold mt-1 ${reportData.unassigned_count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {reportData.unassigned_count}
                </p>
                <p className="text-xs text-muted-foreground mt-1 group-hover:text-primary transition-colors">
                  View in calendar →
                </p>
              </Link>
            </Tooltip>
          </div>

          {/* Hours by Instructor Table */}
          {reportData.hours_by_instructor.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <Tooltip text="Total hours each instructor is scheduled">
                  <h3 className="text-sm font-semibold">Hours by Instructor</h3>
                </Tooltip>
                <Tooltip text="Export report as CSV">
                  <button
                    onClick={exportCSV}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Export CSV
                    </span>
                  </button>
                </Tooltip>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Instructor</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Minutes</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.hours_by_instructor.map((h) => (
                      <tr key={h.instructor_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{h.name}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{h.total_minutes}</td>
                        <td className="px-4 py-2 text-right font-medium">{h.total_hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hours by Tag Table */}
          {reportData.hours_by_tag.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <Tooltip text="Total hours broken down by tag">
                  <h3 className="text-sm font-semibold">Hours by Tag</h3>
                </Tooltip>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tag</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Minutes</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.hours_by_tag.map((h) => (
                      <tr key={h.tag_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{h.tag_name}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{h.total_minutes}</td>
                        <td className="px-4 py-2 text-right font-medium">{h.total_hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Session Detail Table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <Tooltip text="All individual sessions in the date range">
                <h3 className="text-sm font-semibold">
                  Session Detail ({reportData.sessions.length} rows)
                </h3>
              </Tooltip>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Instructor</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Venue</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Grades</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.sessions.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border last:border-0 ${
                        s.needs_resolution ? 'bg-red-500/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2 whitespace-nowrap">
                        {s.is_makeup && (
                          <Tooltip text="Makeup session" position="bottom">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5" />
                          </Tooltip>
                        )}
                        {s.date}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                      </td>
                      <td className="px-4 py-2">{s.instructor_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s.venue_name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                            STATUS_BG[s.status] ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {s.grade_groups.map((g) => (
                            <span key={g} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {s.tags.map((t) => (
                            <span key={t} className="inline-block rounded bg-primary/20 text-primary px-1.5 py-0.5 text-xs">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
