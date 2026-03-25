'use client';

import { Tooltip } from './Tooltip';

export type CalendarView = 'day' | 'week' | 'month' | 'year';

interface ViewToggleProps {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
  options?: CalendarView[];
  className?: string;
}

const viewLabels: Record<CalendarView, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

const viewTooltips: Record<CalendarView, string> = {
  day: 'View single day schedule',
  week: 'View weekly schedule',
  month: 'View monthly calendar',
  year: 'View full year overview',
};

export function ViewToggle({
  value,
  onChange,
  options = ['day', 'week', 'month', 'year'],
  className = '',
}: ViewToggleProps) {
  return (
    <div className={`inline-flex items-center bg-slate-100 rounded-lg p-0.5 ${className}`}>
      {options.map((view) => {
        const isActive = view === value;
        return (
          <Tooltip key={view} text={viewTooltips[view]}>
            <button
              onClick={() => onChange(view)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                  : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              {viewLabels[view]}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
