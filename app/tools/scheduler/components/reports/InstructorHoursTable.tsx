'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { MonthlyBreakdownCards } from './MonthlyBreakdownCards';

/* ── Types ─────────────────────────────────────────────── */

export interface InstructorRow {
  id: string;
  name: string;
  totalHours: number;
  avgPerWeek: number;
  status: 'Active' | 'Part-time' | 'Substitute';
  avatarColor: string;
  monthly: { month: string; hours: number; opacity: number }[];
}

interface InstructorHoursTableProps {
  instructors: InstructorRow[];
}

/* ── Status badge config ───────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Active:     { bg: 'bg-emerald-100', text: 'text-emerald-500' },
  'Part-time': { bg: 'bg-amber-100',  text: 'text-amber-500' },
  Substitute: { bg: 'bg-blue-100',    text: 'text-blue-500' },
};

/* ── Component ─────────────────────────────────────────── */

export function InstructorHoursTable({ instructors }: InstructorHoursTableProps) {
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
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Column Headers */}
      <div
        className="grid items-center px-5 h-11 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        style={{ gridTemplateColumns: '1fr 120px 100px 100px 40px' }}
      >
        <span>Instructor</span>
        <span className="text-right">Total Hours</span>
        <span className="text-right">Avg/Week</span>
        <span className="text-center">Status</span>
        <span />
      </div>

      {/* Rows */}
      {instructors.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          No instructor data available for this date range.
        </div>
      ) : (
        <div>
          {instructors.map((instructor, idx) => {
            const isExpanded = expandedRows.has(instructor.id);
            const hasMonthly = instructor.monthly.length > 0;
            const statusStyle = STATUS_STYLES[instructor.status] ?? STATUS_STYLES.Active;
            const isLast = idx === instructors.length - 1;
            const initials = instructor.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const tooltipText = hasMonthly
              ? isExpanded
                ? 'Click to collapse monthly breakdown'
                : 'Click to expand monthly breakdown'
              : 'No monthly data available';

            return (
              <div key={instructor.id}>
                {/* Main Row */}
                <Tooltip text={tooltipText}>
                  <div
                    className={`grid items-center px-5 h-14 transition-colors cursor-pointer hover:bg-blue-50 ${
                      isExpanded ? 'bg-blue-50' : ''
                    } ${!isLast || isExpanded ? 'border-b border-slate-200' : ''}`}
                    style={{ gridTemplateColumns: '1fr 120px 100px 100px 40px' }}
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
                  {/* Instructor name + avatar */}
                  <div className="flex items-center gap-3">
                    <Avatar
                      initials={initials}
                      size="lg"
                      bgColor={instructor.avatarColor}
                      className="!text-slate-600"
                    />
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {instructor.name}
                    </span>
                  </div>

                  {/* Total Hours */}
                  <span className="text-sm font-semibold text-slate-900 text-right tabular-nums">
                    {instructor.totalHours} hrs
                  </span>

                  {/* Avg/Week */}
                  <span className="text-sm text-slate-500 text-right tabular-nums">
                    {instructor.avgPerWeek}/wk
                  </span>

                  {/* Status Badge */}
                  <div className="flex justify-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      {instructor.status}
                    </span>
                  </div>

                  {/* Expand chevron */}
                  <div className="flex items-center justify-center">
                    {hasMonthly && (
                      isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  </div>
                </Tooltip>

                {/* Expanded Detail */}
                {isExpanded && hasMonthly && (
                  <div
                    className={`bg-slate-50 px-5 py-4 ${!isLast ? 'border-b border-slate-200' : ''}`}
                    style={{ paddingLeft: 68 }}
                  >
                    <MonthlyBreakdownCards
                      months={instructor.monthly}
                      onViewDetail={() => {
                        router.push(
                          `/tools/scheduler/admin/reports/instructors/${instructor.id}`
                        );
                      }}
                    />
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
