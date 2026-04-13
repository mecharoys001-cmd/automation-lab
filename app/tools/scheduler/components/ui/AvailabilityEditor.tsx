'use client';

import { useState } from 'react';
import { Tooltip } from './Tooltip';
import type { AvailabilityJson, DayOfWeek, TimeBlock } from '@/types/database';

/* ── Helpers ──────────────────────────────────────────────── */

/** Format minutes-from-midnight into a display label. On-the-hour → "8 AM", half-hour → "8:30" */
export function formatSlotLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 === 0 || h24 === 12 ? 12 : h24 > 12 ? h24 - 12 : h24;
  if (m === 0) return `${h12} ${h24 >= 12 ? 'PM' : 'AM'}`;
  return `${h12}:${String(m).padStart(2, '0')}`;
}

/** @deprecated Use formatSlotLabel instead */
export function formatHourLabel(h: number): string {
  return formatSlotLabel(h * 60);
}

/** Convert minutes-from-midnight to "HH:MM" string */
function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Check whether a 30-minute slot (starting at `slotStart` minutes from midnight) overlaps any block */
export function isSlotAvailable(slotStart: number, blocks: TimeBlock[]): boolean {
  const slotEnd = slotStart + 30;
  return blocks.some((b) => {
    const [sh, sm] = b.start.split(':').map(Number);
    const [eh, em] = b.end.split(':').map(Number);
    const bStart = sh * 60 + sm;
    const bEnd = eh * 60 + em;
    return bStart < slotEnd && bEnd > slotStart;
  });
}

/** @deprecated Use isSlotAvailable instead */
export function isHourAvailable(hour: number, blocks: TimeBlock[]): boolean {
  return isSlotAvailable(hour * 60, blocks);
}

/** Merge a set of 30-min slot start-minutes into contiguous TimeBlock[] */
export function buildBlocksFromSlots(slots: Set<number>): TimeBlock[] {
  if (slots.size === 0) return [];
  const sorted = [...slots].sort((a, b) => a - b);
  const blocks: TimeBlock[] = [];
  let start = sorted[0];
  let end = sorted[0] + 30;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end) {
      end = sorted[i] + 30;
    } else {
      blocks.push({ start: minutesToHHMM(start), end: minutesToHHMM(end) });
      start = sorted[i];
      end = sorted[i] + 30;
    }
  }
  blocks.push({ start: minutesToHHMM(start), end: minutesToHHMM(end) });
  return blocks;
}

const EDITOR_DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday', short: 'Mon' }, { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' }, { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' }, { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];
/** 30-minute slots from 8:00 AM to 19:30 (minutes from midnight) */
export const EDITOR_SLOTS = Array.from({ length: 24 }, (_, i) => 480 + i * 30);

/* ── Component ────────────────────────────────────────────── */

export function AvailabilityEditor({
  value,
  onChange,
  id,
}: {
  value: AvailabilityJson | null;
  onChange: (v: AvailabilityJson | null) => void;
  /** HTML id for the container (enables label htmlFor linking via aria) */
  id?: string;
}) {
  const avail = value ?? {};

  const isDayEnabled = (day: DayOfWeek) => {
    const blocks = avail[day];
    return blocks !== undefined && blocks.length > 0;
  };

  const isCellActive = (day: DayOfWeek, slotStart: number) => {
    const blocks = avail[day];
    if (!blocks) return false;
    return isSlotAvailable(slotStart, blocks);
  };

  const getActiveSlots = (day: DayOfWeek): Set<number> => {
    const active = new Set<number>();
    EDITOR_SLOTS.forEach((s) => {
      if (isCellActive(day, s)) active.add(s);
    });
    return active;
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

  const toggleCell = (day: DayOfWeek, slotStart: number) => {
    const slots = getActiveSlots(day);
    if (slots.has(slotStart)) {
      slots.delete(slotStart);
    } else {
      slots.add(slotStart);
    }
    const next = { ...avail };
    next[day] = buildBlocksFromSlots(slots);
    onChange(next);
  };

  const [dragging, setDragging] = useState<{ painting: boolean } | null>(null);

  const handleMouseDown = (day: DayOfWeek, slotStart: number) => {
    const painting = !isCellActive(day, slotStart);
    setDragging({ painting });
    toggleCell(day, slotStart);
  };

  const handleMouseEnter = (day: DayOfWeek, slotStart: number) => {
    if (!dragging) return;
    const active = isCellActive(day, slotStart);
    if (dragging.painting && !active) toggleCell(day, slotStart);
    if (!dragging.painting && active) toggleCell(day, slotStart);
  };

  const handleMouseUp = () => setDragging(null);

  const clearAll = () => onChange(null);

  const setAllFull = () => {
    const full: AvailabilityJson = {};
    EDITOR_DAYS.forEach((d) => { full[d.key] = [{ start: '08:00', end: '20:00' }]; });
    onChange(full);
  };

  return (
    <div id={id} role="group" className="space-y-2" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={setAllFull}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
          Select All
        </button>
        <span className="text-slate-600">·</span>
        <button type="button" onClick={clearAll}
          className="text-[11px] font-medium text-slate-700 hover:text-slate-600 transition-colors">
          Clear All
        </button>
      </div>

      <p className="text-[11px] text-slate-700">Click or drag cells to mark available 30-min slots. Green = available.</p>

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
                    isDayEnabled(d.key) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  {d.short}
                </button>
              </Tooltip>
            ))}

            {/* 30-minute slot rows */}
            {EDITOR_SLOTS.map((slotStart) => {
              const isHalfHour = slotStart % 60 !== 0;
              return (
                <div key={slotStart} className="contents">
                  <Tooltip text={`${minutesToHHMM(slotStart)} – ${minutesToHHMM(slotStart + 30)}`}>
                    <div className={`flex items-center justify-end pr-1.5 text-[10px] text-slate-700 bg-white h-5 border-t border-slate-200 ${isHalfHour ? 'opacity-60' : ''}`}>
                      {formatSlotLabel(slotStart)}
                    </div>
                  </Tooltip>
                  {EDITOR_DAYS.map((d) => {
                    const active = isCellActive(d.key, slotStart);
                    return (
                      <Tooltip key={`${d.key}-${slotStart}`} text={`${d.short} ${minutesToHHMM(slotStart)}–${minutesToHHMM(slotStart + 30)}`}>
                        <div
                          role="gridcell"
                          tabIndex={0}
                          aria-label={`${d.short} ${formatSlotLabel(slotStart)} — ${active ? 'available' : 'unavailable'}`}
                          aria-pressed={active}
                          onMouseDown={() => handleMouseDown(d.key, slotStart)}
                          onMouseEnter={() => handleMouseEnter(d.key, slotStart)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleCell(d.key, slotStart);
                            }
                          }}
                          className={`h-5 border-t border-l border-slate-200 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset outline-none ${
                            active ? 'bg-emerald-500/40 hover:bg-emerald-500/60' : 'bg-slate-50 hover:bg-emerald-100'
                          } ${isHalfHour ? 'border-t-slate-100' : ''}`}
                        />
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
