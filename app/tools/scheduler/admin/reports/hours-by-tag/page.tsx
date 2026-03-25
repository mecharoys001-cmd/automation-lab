'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Download } from 'lucide-react';
import { useProgram } from '../../ProgramContext';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import { ReportsTabBar } from '../../../components/reports/ReportsTabBar';
import { HoursByTagTable } from '../../../components/reports/HoursByTagTable';
import type { TagRow } from '../../../components/reports/HoursByTagTable';

/* ── Types ─────────────────────────────────────────────── */

interface SessionDetail {
  id: string;
  date: string;
  duration_minutes: number;
  status: string;
  tags: string[];
}

interface ReportData {
  hours_by_tag: {
    tag_id: string;
    tag_name: string;
    total_minutes: number;
    total_hours: number;
  }[];
  sessions: SessionDetail[];
}

/* ── Fallback data matching design spec ────────────────── */

const FALLBACK_TAGS: TagRow[] = [
  { name: 'Strings',    emoji: '\u{1F3BB}', totalHours: 180, sessions: 24, avgDuration: 45, barColor: '#3B82F6' },
  { name: 'Brass',      emoji: '\u{1F3BA}', totalHours: 120, sessions: 18, avgDuration: 40, barColor: '#10B981' },
  { name: 'Choral',     emoji: '\u{1F3A4}', totalHours: 95,  sessions: 15, avgDuration: 38, barColor: '#F59E0B' },
  { name: 'Piano',      emoji: '\u{1F3B9}', totalHours: 88,  sessions: 14, avgDuration: 38, barColor: '#8B5CF6' },
  { name: 'Percussion', emoji: '\u{1F941}', totalHours: 72,  sessions: 12, avgDuration: 36, barColor: '#EF4444' },
  { name: 'Guitar',     emoji: '\u{1F3B8}', totalHours: 65,  sessions: 10, avgDuration: 39, barColor: '#06B6D4' },
];

const TAG_EMOJI: Record<string, string> = {
  strings:    '\u{1F3BB}',
  brass:      '\u{1F3BA}',
  choral:     '\u{1F3A4}',
  piano:      '\u{1F3B9}',
  percussion: '\u{1F941}',
  guitar:     '\u{1F3B8}',
  woodwinds:  '\u{1F3B5}',
};

import { getBarColor } from '../../../lib/subjectColors';

/* ── Helpers ───────────────────────────────────────────── */

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* ── Page ──────────────────────────────────────────────── */

export default function HoursByTagPage() {
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

  // Build tag rows from API data — always dynamic, never fallback
  const tags = useMemo((): TagRow[] => {
    if (!reportData) return [];

    // Compute sessions count and total duration per tag from session details
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
          emoji: TAG_EMOJI[key] ?? '\u{1F3B5}',
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
    : 'Nov 2025 \u2014 Jun 2026';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white px-4 sm:px-8 py-3 sm:py-0 sm:h-16 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mr-auto">Reports</h1>

        <Tooltip text="Select date range for report data">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2 cursor-default">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-[13px] font-medium text-slate-900">{dateRangeLabel}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
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
        <HoursByTagTable tags={tags} />
      </div>
    </div>
  );
}
