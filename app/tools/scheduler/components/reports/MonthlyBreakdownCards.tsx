'use client';

import { ProgressBar } from '../ui/ProgressBar';
import { Tooltip } from '../ui/Tooltip';

interface MonthlyData {
  month: string;
  hours: number;
  opacity: number;
}

interface MonthlyBreakdownCardsProps {
  months: MonthlyData[];
  onViewDetail?: () => void;
}

export function MonthlyBreakdownCards({ months, onViewDetail }: MonthlyBreakdownCardsProps) {
  const maxHours = months.length > 0 ? Math.max(...months.map((m) => m.hours)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-3">
        {months.map((m) => {
          const pct = maxHours > 0 ? (m.hours / maxHours) * 100 : 0;
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col gap-1 bg-white border border-slate-200 rounded-lg p-3"
            >
              <span className="text-[11px] font-medium text-slate-600">{m.month}</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">{m.hours} hrs</span>
              <ProgressBar
                value={pct}
                height={4}
                color="bg-blue-500"
                trackColor="bg-slate-100"
                fillOpacity={m.opacity}
              />
            </div>
          );
        })}
      </div>
      {onViewDetail && (
        <Tooltip text="View detailed weekly breakdown">
          <button
            type="button"
            className="text-[13px] font-semibold text-blue-500 hover:text-blue-600 transition-colors text-left cursor-pointer"
            onClick={onViewDetail}
          >
            View Weekly Detail &rarr;
          </button>
        </Tooltip>
      )}
    </div>
  );
}
