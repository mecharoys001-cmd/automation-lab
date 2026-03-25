'use client';

import Link from 'next/link';
import { Tag, ChevronRight } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar';

/* ── Types ─────────────────────────────────────────────── */

export interface TagRow {
  name: string;
  emoji: string;
  totalHours: number;
  sessions: number;
  avgDuration: number; // minutes
  barColor: string;    // hex or tailwind class
}

interface HoursByTagTableProps {
  tags: TagRow[];
}

/* ── Component ─────────────────────────────────────────── */

export function HoursByTagTable({ tags }: HoursByTagTableProps) {
  const maxHours = tags.length > 0 ? Math.max(...tags.map((t) => t.totalHours)) : 1;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      {/* Column Headers */}
      <div
        className="grid items-center px-5 h-11 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider"
        style={{ gridTemplateColumns: '1fr 120px 100px 120px' }}
      >
        <span>Tag</span>
        <span className="text-right">Total Hours</span>
        <span className="text-right">Sessions</span>
        <span className="text-right">Avg Duration</span>
      </div>

      {/* Rows */}
      {tags.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <Tag className="w-8 h-8 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-500">No tag data available</p>
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
        </div>
      ) : (
        <div>
          {tags.map((tag, idx) => {
            const pct = maxHours > 0 ? (tag.totalHours / maxHours) * 100 : 0;
            const isLast = idx === tags.length - 1;

            return (
              <div
                key={tag.name}
                className={`grid items-center px-5 ${!isLast ? 'border-b border-slate-200' : ''}`}
                style={{ gridTemplateColumns: '1fr 120px 100px 120px', height: 68 }}
              >
                {/* Tag cell: emoji + name + progress bar */}
                <div className="flex flex-col gap-1.5 pr-6">
                  <span className="text-sm font-medium text-slate-900">
                    {tag.emoji}&nbsp;&nbsp;{tag.name}
                  </span>
                  <ProgressBar
                    value={pct}
                    height={6}
                    color={tag.barColor}
                    trackColor="bg-slate-200"
                  />
                </div>

                {/* Total Hours */}
                <span className="text-sm font-semibold text-slate-900 text-right tabular-nums">
                  {tag.totalHours} hrs
                </span>

                {/* Sessions */}
                <span className="text-sm text-slate-500 text-right tabular-nums">
                  {tag.sessions}
                </span>

                {/* Avg Duration */}
                <span className="text-sm text-slate-500 text-right tabular-nums">
                  {tag.avgDuration} min
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
