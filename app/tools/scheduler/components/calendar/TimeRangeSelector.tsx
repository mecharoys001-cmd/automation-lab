'use client';

import { useState, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeRangeSelectorProps {
  startHour: number;
  endHour: number;
  onStartHourChange: (hour: number) => void;
  onEndHourChange: (hour: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Available hours: 6 AM through 6 PM */
const HOUR_OPTIONS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeRangeSelector({
  startHour,
  endHour,
  onStartHourChange,
  onEndHourChange,
}: TimeRangeSelectorProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleStartChange = (val: number) => {
    if (val >= endHour) {
      showToast('Start time must be before end time');
      return;
    }
    onStartHourChange(val);
  };

  const handleEndChange = (val: number) => {
    if (val <= startHour) {
      showToast('End time must be after start time');
      return;
    }
    onEndHourChange(val);
  };

  return (
    <div className="relative flex items-center gap-2">
      <Tooltip text="Visible time range">
        <Clock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
      </Tooltip>

      <Tooltip text="Set calendar start time">
        <select
          value={startHour}
          onChange={(e) => handleStartChange(Number(e.target.value))}
          className="text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg pl-2 pr-6 py-1 min-w-[72px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 cursor-pointer"
        >
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {formatHourLabel(h)}
            </option>
          ))}
        </select>
      </Tooltip>

      <span className="text-[11px] text-slate-700 font-medium">–</span>

      <Tooltip text="Set calendar end time">
        <select
          value={endHour}
          onChange={(e) => handleEndChange(Number(e.target.value))}
          className="text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg pl-2 pr-6 py-1 min-w-[72px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 cursor-pointer"
        >
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {formatHourLabel(h)}
            </option>
          ))}
        </select>
      </Tooltip>

      {/* Error toast — persistent live region with dynamic content */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="absolute top-full right-0 mt-2 z-50"
      >
        {toastMessage && (
          <div className="whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700 shadow-md">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
