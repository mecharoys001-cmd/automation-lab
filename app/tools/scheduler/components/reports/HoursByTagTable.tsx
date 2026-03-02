'use client';

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
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Column Headers */}
      <div
        className="grid items-center px-5 h-11 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider"
        style={{ gridTemplateColumns: '1fr 120px 100px 120px' }}
      >
        <span>Tag</span>
        <span className="text-right">Total Hours</span>
        <span className="text-right">Sessions</span>
        <span className="text-right">Avg Duration</span>
      </div>

      {/* Rows */}
      {tags.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          No tag data available for this date range.
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
