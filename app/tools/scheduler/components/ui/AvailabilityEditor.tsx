'use client';

import { useState } from 'react';
import { Tooltip } from './Tooltip';
import type { AvailabilityJson, DayOfWeek, TimeBlock } from '@/types/database';

/* ── Helpers ──────────────────────────────────────────────── */

export function formatHourLabel(h: number): string {
  const h12 = h === 0 || h === 12 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function isHourAvailable(hour: number, blocks: TimeBlock[]): boolean {
  const slotStart = hour * 60;
  const slotEnd = (hour + 1) * 60;
  return blocks.some((b) => {
    const [sh, sm] = b.start.split(':').map(Number);
    const [eh, em] = b.end.split(':').map(Number);
    const bStart = sh * 60 + sm;
    const bEnd = eh * 60 + em;
    return bStart < slotEnd && bEnd > slotStart;
  });
}

const EDITOR_DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday', short: 'Mon' }, { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' }, { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' }, { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];
const EDITOR_HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM

/* ── Component ────────────────────────────────────────────── */

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: AvailabilityJson | null;
  onChange: (v: AvailabilityJson | null) => void;
}) {
  const avail = value ?? {};

  const isDayEnabled = (day: DayOfWeek) => {
    const blocks = avail[day];
    return blocks !== undefined && blocks.length > 0;
  };

  const isCellActive = (day: DayOfWeek, hour: number) => {
    const blocks = avail[day];
    if (!blocks) return false;
    return isHourAvailable(hour, blocks);
  };

  const buildBlocks = (day: DayOfWeek, hours: Set<number>): TimeBlock[] => {
    if (hours.size === 0) return [];
    const sorted = [...hours].sort((a, b) => a - b);
    const blocks: TimeBlock[] = [];
    let start = sorted[0];
    let end = sorted[0] + 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end) {
        end = sorted[i] + 1;
      } else {
        blocks.push({ start: `${String(start).padStart(2, '0')}:00`, end: `${String(end).padStart(2, '0')}:00` });
        start = sorted[i];
        end = sorted[i] + 1;
      }
    }
    blocks.push({ start: `${String(start).padStart(2, '0')}:00`, end: `${String(end).padStart(2, '0')}:00` });
    return blocks;
  };

  const getActiveHours = (day: DayOfWeek): Set<number> => {
    const hours = new Set<number>();
    EDITOR_HOURS.forEach((h) => {
      if (isCellActive(day, h)) hours.add(h);
    });
    return hours;
  };

  const toggleDay = (day: DayOfWeek) => {
    const next = { ...avail };
    if (isDayEnabled(day)) {
      next[day] = [];
    } else {
      next[day] = [{ start: '08:00', end: '20:00' }];
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  };

  const toggleCell = (day: DayOfWeek, hour: number) => {
    const hours = getActiveHours(day);
    if (hours.has(hour)) {
      hours.delete(hour);
    } else {
      hours.add(hour);
    }
    const next = { ...avail };
    next[day] = buildBlocks(day, hours);
    onChange(next);
  };

  const [dragging, setDragging] = useState<{ painting: boolean } | null>(null);

  const handleMouseDown = (day: DayOfWeek, hour: number) => {
    const painting = !isCellActive(day, hour);
    setDragging({ painting });
    toggleCell(day, hour);
  };

  const handleMouseEnter = (day: DayOfWeek, hour: number) => {
    if (!dragging) return;
    const active = isCellActive(day, hour);
    if (dragging.painting && !active) toggleCell(day, hour);
    if (!dragging.painting && active) toggleCell(day, hour);
  };

  const handleMouseUp = () => setDragging(null);

  const clearAll = () => onChange(null);

  const setAllFull = () => {
    const full: AvailabilityJson = {};
    EDITOR_DAYS.forEach((d) => { full[d.key] = [{ start: '08:00', end: '20:00' }]; });
    onChange(full);
  };

  return (
    <div className="space-y-2" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={setAllFull}
          className="text-[11px] font-medium text-blue-500 hover:text-blue-600 transition-colors">
          Select All
        </button>
        <span className="text-slate-300">·</span>
        <button type="button" onClick={clearAll}
          className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
          Clear All
        </button>
      </div>

      <p className="text-[11px] text-slate-400">Click or drag cells to mark available times. Green = available.</p>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[400px] select-none">
          <div
            role="grid"
            aria-label="Weekly availability grid"
            className="grid gap-px rounded-lg border border-slate-200 overflow-hidden"
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
          >
            {/* Header row: day checkboxes */}
            <div className="bg-slate-50 p-1" />
            {EDITOR_DAYS.map((d) => (
              <Tooltip key={d.key} text={`Toggle ${d.short} on/off`}>
                <button
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`py-1.5 text-center text-xs font-medium transition-colors ${
                    isDayEnabled(d.key) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {d.short}
                </button>
              </Tooltip>
            ))}

            {/* Hour rows */}
            {EDITOR_HOURS.map((hour) => (
              <div key={hour} className="contents">
                <div className="flex items-center justify-end pr-1.5 text-[10px] text-slate-400 bg-white h-6 border-t border-slate-200">
                  {formatHourLabel(hour)}
                </div>
                {EDITOR_DAYS.map((d) => {
                  const active = isCellActive(d.key, hour);
                  return (
                    <div
                      key={`${d.key}-${hour}`}
                      role="gridcell"
                      tabIndex={0}
                      aria-label={`${d.short} ${formatHourLabel(hour)} — ${active ? 'available' : 'unavailable'}`}
                      aria-pressed={active}
                      onMouseDown={() => handleMouseDown(d.key, hour)}
                      onMouseEnter={() => handleMouseEnter(d.key, hour)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleCell(d.key, hour);
                        }
                      }}
                      className={`h-6 border-t border-l border-slate-200 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset outline-none ${
                        active ? 'bg-emerald-500/40 hover:bg-emerald-500/60' : 'bg-slate-50 hover:bg-emerald-100'
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
