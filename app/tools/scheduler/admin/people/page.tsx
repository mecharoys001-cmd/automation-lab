'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, MapPin, Search, Plus, ChevronDown, X, Mail, Phone,
  Accessibility, Clock, Package, Home, StickyNote, Edit2,
  Check, AlertTriangle, Loader2, Trash2, Save, RefreshCw,
} from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Pill } from '../../components/ui/Pill';
import { Avatar } from '../../components/ui/Avatar';
import { ClickToCopy } from '../../components/ui/ClickToCopy';
import { TagSelector } from '../../components/ui/TagSelector';
import type { Instructor, Venue, AvailabilityJson, DayOfWeek, TimeBlock } from '@/types/database';
import { SKILL_STYLES } from '../../lib/subjectColors';
import { useProgram } from '../ProgramContext';

/* ── Constants ──────────────────────────────────────────────── */

const AVAIL_DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'sunday',    label: 'Su' },
  { key: 'monday',    label: 'Mo' },
  { key: 'tuesday',   label: 'Tu' },
  { key: 'wednesday', label: 'We' },
  { key: 'thursday',  label: 'Th' },
  { key: 'friday',    label: 'Fr' },
  { key: 'saturday',  label: 'Sa' },
];

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-pink-500', 'bg-cyan-500',
];

const EQUIPMENT_OPTIONS = [
  { key: 'piano', label: 'Piano' },
  { key: 'sound_system', label: 'Sound System' },
  { key: 'music_stands', label: 'Music Stands' },
  { key: 'whiteboard', label: 'Whiteboard' },
];


/* Availability grid helpers (for modal) */
const ALL_DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday', short: 'Mon' }, { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' }, { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' }, { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];
const GRID_HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

/* ── Helpers ────────────────────────────────────────────────── */

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatHourLabel(h: number): string {
  const h12 = h === 0 || h === 12 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${h >= 12 ? 'PM' : 'AM'}`;
}

function isHourAvailable(hour: number, blocks: TimeBlock[]): boolean {
  const slotStart = hour * 60;
  const slotEnd = (hour + 1) * 60;
  return blocks.some((b) => {
    const [sh, sm] = b.start.split(':').map(Number);
    const [eh, em] = b.end.split(':').map(Number);
    return sh * 60 + sm < slotEnd && eh * 60 + em > slotStart;
  });
}

/**
 * Calculate availability for a time period (morning or afternoon)
 * Returns: 'full' (all hours covered), 'partial' (some hours covered), or 'none'
 */
function getTimePeriodAvailability(
  blocks: TimeBlock[],
  periodStart: number, // hour (e.g., 8)
  periodEnd: number,   // hour (e.g., 12)
): 'full' | 'partial' | 'none' {
  if (!blocks || blocks.length === 0) return 'none';
  
  const totalHours = periodEnd - periodStart;
  let coveredHours = 0;
  
  for (let hour = periodStart; hour < periodEnd; hour++) {
    if (isHourAvailable(hour, blocks)) {
      coveredHours++;
    }
  }
  
  if (coveredHours === 0) return 'none';
  if (coveredHours === totalHours) return 'full';
  return 'partial';
}

/* ── Skeleton ───────────────────────────────────────────────── */

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-52 rounded-lg bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

/* ── Toast Notification ────────────────────────────────────── */

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {isSuccess ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

/* ── Availability Grid (Modal) ──────────────────────────────── */

function AvailabilityGrid({ availability }: { availability: AvailabilityJson | null }) {
  if (!availability || Object.keys(availability).length === 0) {
    return <p className="text-sm text-slate-400">No availability set</p>;
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        <div
          className="grid gap-px rounded-lg border border-slate-200 overflow-hidden"
          style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
        >
          <div className="bg-slate-50 p-1" />
          {ALL_DAYS.map((d) => (
            <div key={d.key} className="bg-slate-50 py-1.5 text-center text-xs font-medium text-slate-400">
              {d.short}
            </div>
          ))}
          {GRID_HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex items-center justify-end pr-1.5 text-[10px] text-slate-400 bg-white h-6 border-t border-slate-200">
                {formatHourLabel(hour)}
              </div>
              {ALL_DAYS.map((d) => {
                const blocks = availability[d.key] ?? [];
                const avail = isHourAvailable(hour, blocks);
                return (
                  <div
                    key={`${d.key}-${hour}`}
                    className={`h-6 border-t border-l border-slate-200 ${avail ? 'bg-emerald-500/40' : 'bg-white'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Availability Editor (Interactive) ─────────────────────── */

const EDITOR_DAYS = ALL_DAYS; // Mon–Sun
const EDITOR_HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM

function AvailabilityEditor({
  value,
  onChange,
}: {
  value: AvailabilityJson | null;
  onChange: (v: AvailabilityJson | null) => void;
}) {
  const avail = value ?? {};

  // Check if a day has any availability blocks
  const isDayEnabled = (day: DayOfWeek) => {
    const blocks = avail[day];
    return blocks !== undefined && blocks.length > 0;
  };

  // Check if a specific hour cell is active
  const isCellActive = (day: DayOfWeek, hour: number) => {
    const blocks = avail[day];
    if (!blocks) return false;
    return isHourAvailable(hour, blocks);
  };

  // Rebuild blocks from individual hour toggles for a given day
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

  // Get currently active hours for a day
  const getActiveHours = (day: DayOfWeek): Set<number> => {
    const hours = new Set<number>();
    EDITOR_HOURS.forEach((h) => {
      if (isCellActive(day, h)) hours.add(h);
    });
    return hours;
  };

  // Toggle an entire day on/off
  const toggleDay = (day: DayOfWeek) => {
    const next = { ...avail };
    if (isDayEnabled(day)) {
      // Turn off: set to empty array (explicitly unavailable)
      next[day] = [];
    } else {
      // Turn on: set full day 8am–8pm
      next[day] = [{ start: '08:00', end: '20:00' }];
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  };

  // Toggle a single hour cell
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

  // Dragging state for painting multiple cells
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

  // Clear all availability
  const clearAll = () => onChange(null);

  // Set all days to full availability
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

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[400px] select-none">
          <div
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
                      onMouseDown={() => handleMouseDown(d.key, hour)}
                      onMouseEnter={() => handleMouseEnter(d.key, hour)}
                      className={`h-6 border-t border-l border-slate-200 cursor-pointer transition-colors ${
                        active ? 'bg-emerald-500/40 hover:bg-emerald-500/60' : 'bg-white hover:bg-emerald-100'
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">Click or drag to set available hours. Green = available.</p>
    </div>
  );
}

/* ── Venue Detail / Edit Modal ─────────────────────────────── */

function VenueDetailModal({
  venue, saving, onClose, onSave,
}: {
  venue: Venue;
  saving: boolean;
  onClose: () => void;
  onSave: (updates: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);

  /* ── Space types from tags API ─── */
  const [spaceTypes, setSpaceTypes] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((d) => {
        const types = (d.tags ?? [])
          .filter((t: { category: string }) => t.category === 'Space Types')
          .map((t: { name: string }) => t.name);
        setSpaceTypes(types);
      })
      .catch(() => {});
  }, []);

  /* ── Edit-mode state ─── */
  const [capacity, setCapacity] = useState<string>(
    venue.max_capacity != null ? String(venue.max_capacity) : ''
  );
  const [roomType, setRoomType] = useState(venue.space_type || '');
  const [equipment, setEquipment] = useState<string[]>(() => {
    const amenities = venue.amenities ?? [];
    return amenities.filter((a) => EQUIPMENT_OPTIONS.some((e) => e.key === a));
  });
  const [accessible, setAccessible] = useState(
    venue.is_wheelchair_accessible ?? (venue.amenities ?? []).includes('wheelchair_accessible')
  );
  const [bufferMinutes, setBufferMinutes] = useState<string>(
    venue.buffer_minutes != null ? String(venue.buffer_minutes) : ''
  );
  const [notes, setNotes] = useState(venue.notes ?? '');

  const toggleEquipment = (key: string) => {
    setEquipment((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    const amenities = [...equipment];
    if (accessible) amenities.push('wheelchair_accessible');
    onSave({
      max_capacity: capacity ? Number(capacity) : null,
      space_type: roomType,
      amenities: amenities.length > 0 ? amenities : null,
      is_wheelchair_accessible: accessible,
      buffer_minutes: bufferMinutes ? Number(bufferMinutes) : null,
      notes: notes.trim() || null,
    });
  };

  const handleCancelEdit = () => {
    // Reset state back to venue values
    setCapacity(venue.max_capacity != null ? String(venue.max_capacity) : '');
    setRoomType(venue.space_type || '');
    const amenities = venue.amenities ?? [];
    setEquipment(amenities.filter((a) => EQUIPMENT_OPTIONS.some((e) => e.key === a)));
    setAccessible(venue.is_wheelchair_accessible ?? amenities.includes('wheelchair_accessible'));
    setBufferMinutes(venue.buffer_minutes != null ? String(venue.buffer_minutes) : '');
    setNotes(venue.notes ?? '');
    setEditing(false);
  };

  /* ── Derived display values ─── */
  const equipmentLabels = (venue.amenities ?? [])
    .filter((a) => a !== 'wheelchair_accessible')
    .map((a) => EQUIPMENT_OPTIONS.find((e) => e.key === a)?.label ?? a);
  const isAccessible = venue.is_wheelchair_accessible ?? (venue.amenities ?? []).includes('wheelchair_accessible');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[70] w-[700px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white shadow-xl">

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center h-14 px-6 gap-2.5">
          <h2 className="text-[22px] font-bold text-slate-900">{venue.name}</h2>
          <Badge
            variant="status"
            color={venue.is_virtual ? 'violet' : 'blue'}
            tooltip={venue.is_virtual ? 'Virtual venue' : 'In-person venue'}
          >
            {venue.is_virtual ? 'Virtual' : 'In-Person'}
          </Badge>
          <div className="flex-1" />
          <Tooltip text="Close venue details">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Body (Read-only OR Edit) ────────────────── */}
        {!editing ? (
          /* ── READ-ONLY VIEW ─── */
          <div className="divide-y divide-slate-200">

            {/* Capacity & Space Type */}
            <div className="flex items-center px-6 py-3 gap-6">
              <Tooltip text="Maximum capacity">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-[13px] text-slate-700">
                    Capacity: <span className="font-medium">{venue.max_capacity ?? 'Not set'}</span>
                  </span>
                </div>
              </Tooltip>
              <Tooltip text="Room type">
                <div className="flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-slate-400" />
                  <span className="text-[13px] text-slate-700">
                    Space Type: <span className="font-medium">{venue.space_type || 'Not set'}</span>
                  </span>
                </div>
              </Tooltip>
            </div>

            {/* Equipment */}
            <div className="px-6 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Equipment</span>
              </div>
              {equipmentLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {equipmentLabels.map((label) => (
                    <Tooltip key={label} text={label}>
                      <span className="inline-flex items-center bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-medium">
                        {label}
                      </span>
                    </Tooltip>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-400">No equipment listed</span>
              )}
            </div>

            {/* Accessibility */}
            <div className="flex items-center px-6 py-3 gap-1.5">
              <Accessibility className="w-4 h-4 text-slate-400" />
              <span className="text-[13px] text-slate-700">
                Wheelchair accessible:{' '}
                <span className={`font-medium ${isAccessible ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isAccessible ? 'Yes' : 'No'}
                </span>
              </span>
            </div>

            {/* Setup / Teardown Buffer */}
            <div className="flex items-center px-6 py-3 gap-1.5">
              <Tooltip text="Setup and teardown time required before/after events">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-[13px] text-slate-700">
                    Setup/Teardown buffer:{' '}
                    <span className="font-medium">
                      {venue.buffer_minutes != null ? `${venue.buffer_minutes} min` : 'None'}
                    </span>
                  </span>
                </div>
              </Tooltip>
            </div>

            {/* Availability */}
            <div className="px-6 py-3 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Availability</h3>
              <AvailabilityGrid availability={venue.availability_json} />
            </div>

            {/* Notes */}
            <div className="px-6 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <StickyNote className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notes</span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {venue.notes || <span className="text-slate-400">No notes added</span>}
              </p>
            </div>
          </div>
        ) : (
          /* ── EDIT VIEW ─── */
          <div className="px-6 py-4 space-y-5">
            {/* Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Capacity</label>
              <Tooltip text="Maximum number of people this venue can hold">
                <input
                  type="number"
                  min="0"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                />
              </Tooltip>
            </div>

            {/* Availability Times */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Availability Times</label>
              <AvailabilityGrid availability={venue.availability_json} />
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Equipment</label>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <Tooltip key={eq.key} text={`Toggle ${eq.label.toLowerCase()} availability`}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={equipment.includes(eq.key)}
                        onChange={() => toggleEquipment(eq.key)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 cursor-pointer accent-blue-500"
                      />
                      <span className="text-sm text-slate-700">{eq.label}</span>
                    </label>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Space Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Space Type</label>
              <Tooltip text="Select the space type for this venue">
                <div className="relative">
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer transition-colors"
                  >
                    <option value="">Select space type…</option>
                    {spaceTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    {/* Show current value if not in fetched list */}
                    {roomType && !spaceTypes.includes(roomType) && (
                      <option key={roomType} value={roomType}>{roomType}</option>
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </Tooltip>
            </div>

            {/* Accessibility */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Accessibility</label>
              <Tooltip text="Mark if this venue is wheelchair accessible">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={accessible}
                    onChange={(e) => setAccessible(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 cursor-pointer accent-blue-500"
                  />
                  <span className="text-sm text-slate-700">Wheelchair accessible</span>
                </label>
              </Tooltip>
            </div>

            {/* Setup / Teardown Buffer */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Setup / Teardown Buffer</label>
              <Tooltip text="Minutes needed before and after events for setup and cleanup">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(e.target.value)}
                    placeholder="0"
                    className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                  />
                  <span className="text-sm text-slate-500">minutes</span>
                </div>
              </Tooltip>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
              <Tooltip text="Additional notes or special instructions for this venue">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this venue…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none transition-colors"
                />
              </Tooltip>
            </div>
          </div>
        )}

        <div className="h-px bg-slate-200" />

        {/* ── Footer ─────────────────────────────────── */}
        <div className="flex items-center justify-between h-14 px-6">
          <Tooltip text="Jump to calendar filtered to this venue">
            <Link
              href={`/tools/scheduler/admin?venue=${venue.id}`}
              onClick={onClose}
              className="text-[13px] font-medium text-blue-500 hover:text-blue-600"
            >
              View Schedule &rarr;
            </Link>
          </Tooltip>
          <div className="flex items-center gap-3">
            {editing ? (
              <>
                <Tooltip text="Discard changes">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </Tooltip>
                <Tooltip text="Save venue details">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving\u2026' : 'Save Changes'}
                  </button>
                </Tooltip>
              </>
            ) : (
              <Tooltip text="Edit venue details">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Instructor Detail Modal ────────────────────────────────── */

interface SessionRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  venue?: { name: string } | null;
  program?: { name: string } | null;
}

function InstructorDetailModal({
  instructor, sessionCount, sessions, loadingSessions,
  togglingStatus, onClose, onToggleStatus, onToggleOnCall, togglingOnCall, onEdit,
}: {
  instructor: Instructor;
  sessionCount: number | null;
  sessions: SessionRecord[];
  loadingSessions: boolean;
  togglingStatus: boolean;
  togglingOnCall: boolean;
  onClose: () => void;
  onToggleStatus: () => void;
  onToggleOnCall: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[70] w-[700px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center h-14 px-6 gap-2.5">
          <h2 className="text-[22px] font-bold text-slate-900">
            {instructor.first_name} {instructor.last_name}
          </h2>
          <Tooltip text={instructor.is_active ? 'Active instructor' : 'Inactive instructor'}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${instructor.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </Tooltip>
          {instructor.on_call && (
            <Badge variant="status" color="green" tooltip="Available for last-minute substitutions">
              On-Call
            </Badge>
          )}
          <div className="flex-1" />
          <Tooltip text="Close details">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Contact (click-to-copy) */}
        <div className="flex items-center px-6 py-3 gap-6">
          {instructor.email && (
            <ClickToCopy
              text={instructor.email}
              label="email"
              icon={Mail}
              textClassName="text-[13px] text-blue-500"
              buttonClassName="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            />
          )}
          {instructor.phone && (
            <ClickToCopy
              text={instructor.phone}
              label="phone"
              icon={Phone}
              textClassName="text-[13px] text-slate-500"
              buttonClassName="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            />
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Subjects (clickable → calendar filter) */}
        <div className="flex items-center flex-wrap gap-2 px-6 py-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subjects</span>
          {(instructor.skills ?? []).map((skill) => {
            const s = SKILL_STYLES[skill];
            return (
              <Pill key={skill} variant="skill"
                bgColor={s?.bg ?? 'bg-slate-100'} textColor={s?.text ?? 'text-slate-600'}
                tooltip={`Click to view calendar filtered by ${skill}`}
                onClick={() => {
                  onClose();
                  router.push(`/tools/scheduler/admin?tag=${encodeURIComponent(skill)}`);
                }}>
                {s?.emoji ?? '🎵'} {skill}
              </Pill>
            );
          })}
          {(!instructor.skills || instructor.skills.length === 0) && (
            <span className="text-sm text-slate-400">No subjects listed</span>
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Availability */}
        <div className="px-6 py-3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Availability</h3>
          <AvailabilityGrid availability={instructor.availability_json} />
        </div>

        <div className="h-px bg-slate-200" />

        {/* Sessions */}
        <div className="px-6 py-3 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-900">
            {loadingSessions ? 'Loading sessions\u2026' : `${sessionCount ?? 0} Active Sessions`}
          </h3>
          {!loadingSessions && sessions.slice(0, 3).map((s) => (
            <div key={s.id} className="flex items-center bg-slate-100 rounded-lg h-9 px-3 gap-2">
              <span className="text-xs font-medium text-slate-900 truncate">{s.venue?.name ?? 'Session'}</span>
              <span className="text-[11px] text-slate-400 ml-auto whitespace-nowrap">
                {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}{' '}
                {s.start_time?.slice(0, 5)}
              </span>
              <Badge variant="status"
                color={s.status === 'scheduled' || s.status === 'published' ? 'green' : s.status === 'draft' ? 'amber' : s.status === 'canceled' || s.status === 'cancelled' ? 'red' : 'slate'}>
                {s.status === 'scheduled' ? 'Active' : s.status === 'published' ? 'Active' : s.status === 'draft' ? 'Draft' : s.status === 'canceled' ? 'Cancelled' : s.status}
              </Badge>
            </div>
          ))}
          {!loadingSessions && sessions.length === 0 && (
            <p className="text-sm text-slate-400">No sessions assigned yet.</p>
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Footer */}
        <div className="flex items-center justify-between h-14 px-6">
          <Tooltip text="Jump to calendar filtered to this instructor">
            <Link
              href={`/tools/scheduler/admin?instructor=${instructor.id}`}
              onClick={onClose}
              className="text-[13px] font-medium text-blue-500 hover:text-blue-600"
            >
              View on Calendar &rarr;
            </Link>
          </Tooltip>
          <div className="flex items-center gap-3">
            <Tooltip text={instructor.on_call ? 'Remove from on-call list' : 'Mark as available for substitutions'}>
              <button
                onClick={onToggleOnCall}
                disabled={togglingOnCall}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-50 ${
                  instructor.on_call
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {togglingOnCall ? 'Updating\u2026' : instructor.on_call ? 'On-Call \u2713' : 'Set On-Call'}
              </button>
            </Tooltip>
            <Tooltip text={instructor.is_active ? 'Make this instructor inactive' : 'Activate this instructor'}>
              <button
                onClick={onToggleStatus}
                disabled={togglingStatus}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-50 ${
                  instructor.is_active
                    ? 'border-red-300 text-red-500 hover:bg-red-50'
                    : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                {togglingStatus ? 'Updating\u2026' : instructor.is_active ? 'Make Inactive' : 'Activate'}
              </button>
            </Tooltip>
            <Button variant="secondary" tooltip="Edit instructor profile" onClick={onEdit}>Edit</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Instructor Edit / Create Modal ────────────────────────── */

interface InstructorFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  is_active: boolean;
  skills: string[];
  availability_json: AvailabilityJson | null;
}

const EMPTY_INSTRUCTOR_FORM: InstructorFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  notes: '',
  is_active: true,
  skills: [],
  availability_json: null,
};

function InstructorEditModal({
  instructor,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  instructor: Instructor | null;
  saving: boolean;
  deleting: boolean;
  onSave: (data: InstructorFormData) => void;
  onDelete: (() => void) | null;
  onClose: () => void;
}) {
  const { programs, selectedProgramId } = useProgram();
  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;
  const isNew = !instructor;
  const [form, setForm] = useState<InstructorFormData>(() =>
    instructor
      ? {
          first_name: instructor.first_name,
          last_name: instructor.last_name,
          email: instructor.email ?? '',
          phone: instructor.phone ?? '',
          notes: instructor.notes ?? '',
          is_active: instructor.is_active,
          skills: instructor.skills ?? [],
          availability_json: instructor.availability_json ?? null,
        }
      : { ...EMPTY_INSTRUCTOR_FORM },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  function setField<K extends keyof InstructorFormData>(key: K, value: InstructorFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[70] w-[560px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center h-14 px-6 gap-2.5">
          <h2 className="text-[22px] font-bold text-slate-900">
            {isNew ? 'Add Instructor' : 'Edit Instructor'}
          </h2>
          <div className="flex-1" />
          <Tooltip text="Close without saving">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {/* First Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">First Name</label>
            <Tooltip text="Instructor's first name" className="w-full">
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setField('first_name', e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Last Name</label>
            <Tooltip text="Instructor's last name" className="w-full">
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setField('last_name', e.target.value)}
                placeholder="e.g. Johnson"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <Tooltip text="Contact email for this instructor" className="w-full">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="sarah@example.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
            <Tooltip text="Contact phone number" className="w-full">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Subjects</label>
            <Tooltip text="Select the subjects this instructor can teach">
              <TagSelector
                value={form.skills}
                onChange={(skills) => setForm(prev => ({ ...prev, skills }))}
                category="Skills"
                placeholder="Select instructor subjects..."
              />
            </Tooltip>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
            <Tooltip text="Internal notes about this instructor (not visible to students)" className="w-full">
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Add notes about this instructor…"
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none transition-colors"
              />
            </Tooltip>
          </div>

          {/* Availability */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Availability</label>
            {selectedProgram && (
              <Tooltip text="This availability extends outside your program dates">
                <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Program runs {selectedProgram.start_date} to {selectedProgram.end_date}
                  </span>
                </div>
              </Tooltip>
            )}
            <AvailabilityEditor
              value={form.availability_json}
              onChange={(v) => setField('availability_json', v)}
            />
          </div>

          {/* Active Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
            <Tooltip text={form.is_active ? 'Instructor is active and can be scheduled' : 'Instructor is inactive and will not appear in scheduling'}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 cursor-pointer accent-blue-500"
                />
                <span className="text-sm text-slate-700">
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </label>
            </Tooltip>
          </div>
        </form>

        <div className="h-px bg-slate-200" />

        {/* Footer */}
        <div className="flex items-center justify-between h-14 px-6">
          <div>
            {onDelete && !isNew && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Are you sure?</span>
                  <Tooltip text="Confirm deletion — this cannot be undone">
                    <button
                      onClick={onDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Deleting…
                        </span>
                      ) : 'Yes, Delete'}
                    </button>
                  </Tooltip>
                  <Tooltip text="Cancel deletion">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </Tooltip>
                </div>
              ) : (
                <Tooltip text="Delete this instructor permanently">
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </Tooltip>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <Tooltip text="Discard changes">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </Tooltip>
            <Tooltip text="Save instructor details">
              <button
                onClick={() => onSave(form)}
                disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {isNew ? 'Add Instructor' : 'Save Changes'}
                  </>
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Venue Create Modal ────────────────────────────────────── */

interface VenueFormData {
  name: string;
  space_type: string;
  max_capacity: string;
  is_virtual: boolean;
  is_wheelchair_accessible: boolean;
  notes: string;
}

const EMPTY_VENUE_FORM: VenueFormData = {
  name: '',
  space_type: '',
  max_capacity: '',
  is_virtual: false,
  is_wheelchair_accessible: false,
  notes: '',
};

function VenueCreateModal({
  saving,
  onSave,
  onClose,
}: {
  saving: boolean;
  onSave: (data: VenueFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<VenueFormData>({ ...EMPTY_VENUE_FORM });
  const [spaceTypes, setSpaceTypes] = useState<string[]>([]);
  const [loadingSpaceTypes, setLoadingSpaceTypes] = useState(true);
  const [showAddSpaceType, setShowAddSpaceType] = useState(false);
  const [newSpaceTypeName, setNewSpaceTypeName] = useState('');
  const [addingSpaceType, setAddingSpaceType] = useState(false);

  // Fetch space types from tags
  const fetchSpaceTypes = useCallback(() => {
    setLoadingSpaceTypes(true);
    fetch('/api/tags')
      .then((res) => res.json())
      .then((data) => {
        const types = (data.tags ?? [])
          .filter((t: { category: string }) => t.category === 'Space Types')
          .map((t: { name: string }) => t.name);
        setSpaceTypes(types);
      })
      .catch(() => setSpaceTypes([]))
      .finally(() => setLoadingSpaceTypes(false));
  }, []);

  useEffect(() => {
    fetchSpaceTypes();
  }, [fetchSpaceTypes]);

  async function handleAddSpaceType() {
    const trimmed = newSpaceTypeName.trim();
    if (!trimmed) return;
    setAddingSpaceType(true);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, category: 'Space Types' }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to create space type');
      }
      await fetchSpaceTypes();
      setField('space_type', trimmed);
      setNewSpaceTypeName('');
      setShowAddSpaceType(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create space type');
    } finally {
      setAddingSpaceType(false);
    }
  }

  function setField<K extends keyof VenueFormData>(key: K, value: VenueFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-set is_virtual based on space_type
      if (key === 'space_type') {
        next.is_virtual = value === 'Virtual';
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[70] w-[560px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center h-14 px-6 gap-2.5">
          <h2 className="text-[22px] font-bold text-slate-900">Add Venue</h2>
          <div className="flex-1" />
          <Tooltip text="Close without saving">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="px-6 py-4 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Name *</label>
            <Tooltip text="Venue or room name" className="w-full">
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Main Stage"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Space Type (from tags) */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-xs font-semibold text-slate-500">Space Type</label>
              <Tooltip text="Add a new space type">
                <button
                  type="button"
                  onClick={() => setShowAddSpaceType((v) => !v)}
                  className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </Tooltip>
              <Tooltip text="Refresh space types list">
                <button
                  type="button"
                  onClick={fetchSpaceTypes}
                  disabled={loadingSpaceTypes}
                  className="inline-flex items-center justify-center w-4 h-4 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSpaceTypes ? 'animate-spin' : ''}`} />
                </button>
              </Tooltip>
            </div>
            {showAddSpaceType && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={newSpaceTypeName}
                  onChange={(e) => setNewSpaceTypeName(e.target.value)}
                  placeholder="New space type name"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSpaceType(); } }}
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                  autoFocus
                />
                <Tooltip text="Create space type tag">
                  <button
                    type="button"
                    onClick={handleAddSpaceType}
                    disabled={addingSpaceType || !newSpaceTypeName.trim()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {addingSpaceType ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                  </button>
                </Tooltip>
              </div>
            )}
            <div className="relative">
              <select
                value={form.space_type}
                onChange={(e) => setField('space_type', e.target.value)}
                disabled={loadingSpaceTypes}
                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                <option value="">{loadingSpaceTypes ? 'Loading...' : spaceTypes.length === 0 ? 'None yet — use + to add' : 'Select type...'}</option>
                {spaceTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Max Capacity */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Max Capacity</label>
            <Tooltip text="Maximum number of people this venue can hold (leave blank for unlimited)" className="w-full">
              <input
                type="number"
                min={1}
                value={form.max_capacity}
                onChange={(e) => setField('max_capacity', e.target.value)}
                placeholder="e.g. 30"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Wheelchair Accessible */}
          <div>
            <Tooltip text="Indicate if this venue is wheelchair accessible">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_wheelchair_accessible}
                  onChange={(e) => setField('is_wheelchair_accessible', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 cursor-pointer accent-blue-500"
                />
                <span className="text-sm text-slate-700">Wheelchair Accessible</span>
              </label>
            </Tooltip>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
            <Tooltip text="Internal notes about this venue" className="w-full">
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Add notes about this venue…"
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none transition-colors"
              />
            </Tooltip>
          </div>
        </form>

        <div className="h-px bg-slate-200" />

        {/* Footer */}
        <div className="flex items-center justify-end h-14 px-6 gap-3">
          <Tooltip text="Discard changes">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </Tooltip>
          <Tooltip text="Create venue">
            <button
              onClick={() => onSave(form)}
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Add Venue
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function PeoplePage() {
  const router = useRouter();
  const { programs, selectedProgramId } = useProgram();
  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [detailSessionCount, setDetailSessionCount] = useState<number | null>(null);
  const [detailSessions, setDetailSessions] = useState<SessionRecord[]>([]);
  const [loadingDetailSessions, setLoadingDetailSessions] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [togglingOnCall, setTogglingOnCall] = useState(false);

  // Edit / Create instructor modal state
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingInstructor, setSavingInstructor] = useState(false);
  const [deletingInstructor, setDeletingInstructor] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  // Venues state
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [savingVenue, setSavingVenue] = useState(false);
  const [showCreateVenueModal, setShowCreateVenueModal] = useState(false);
  const [creatingVenue, setCreatingVenue] = useState(false);

  /* ── Fetching ──────────────────────────────────────────── */

  const fetchInstructors = useCallback(async () => {
    setLoadingAll(true);
    try {
      const res = await fetch('/api/instructors');
      if (!res.ok) throw new Error(`${res.status}`);
      const { instructors } = (await res.json()) as { instructors: Instructor[] };
      setAllInstructors(instructors);
    } catch {
      setAllInstructors([]);
    } finally {
      setLoadingAll(false);
    }
  }, []);

  const fetchVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const res = await fetch('/api/venues');
      if (!res.ok) throw new Error(`${res.status}`);
      const { venues: data } = (await res.json()) as { venues: Venue[] };
      setVenues(data);
    } catch {
      setVenues([]);
    } finally {
      setLoadingVenues(false);
    }
  }, []);

  useEffect(() => {
    fetchInstructors();
    fetchVenues();
  }, [fetchInstructors, fetchVenues]);

  const openDetail = useCallback(async (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setDetailSessionCount(null);
    setDetailSessions([]);
    setLoadingDetailSessions(true);
    try {
      const res = await fetch(`/api/instructor-sessions?instructor_id=${instructor.id}`);
      if (res.ok) {
        const { sessions } = (await res.json()) as { sessions: SessionRecord[] };
        setDetailSessionCount(sessions.length);
        setDetailSessions(sessions);
      }
    } catch {
      setDetailSessionCount(null);
      setDetailSessions([]);
    } finally {
      setLoadingDetailSessions(false);
    }
  }, []);

  const toggleStatus = useCallback(async () => {
    if (!selectedInstructor) return;
    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/instructors/${selectedInstructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !selectedInstructor.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const { instructor: updated } = (await res.json()) as { instructor: Instructor };
      setSelectedInstructor(updated);
      setAllInstructors((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setToast({ message: `Instructor ${updated.is_active ? 'activated' : 'made inactive'}`, type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to update status', type: 'error', id: Date.now() });
    } finally {
      setTogglingStatus(false);
    }
  }, [selectedInstructor]);

  const toggleOnCall = useCallback(async () => {
    if (!selectedInstructor) return;
    setTogglingOnCall(true);
    try {
      const res = await fetch(`/api/instructors/${selectedInstructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_call: !selectedInstructor.on_call }),
      });
      if (!res.ok) throw new Error('Failed to update on-call status');
      const { instructor: updated } = (await res.json()) as { instructor: Instructor };
      setSelectedInstructor(updated);
      setAllInstructors((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setToast({ message: updated.on_call ? 'Instructor set as on-call' : 'Instructor removed from on-call', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to update on-call status', type: 'error', id: Date.now() });
    } finally {
      setTogglingOnCall(false);
    }
  }, [selectedInstructor]);

  const handleSaveVenue = useCallback(async (updates: Record<string, unknown>) => {
    if (!selectedVenue) return;
    setSavingVenue(true);
    try {
      const res = await fetch(`/api/venues/${selectedVenue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to save venue');
      const { venue: updated } = (await res.json()) as { venue: Venue };
      setVenues((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setSelectedVenue(null);
      setToast({ message: 'Venue saved successfully', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to save venue', type: 'error', id: Date.now() });
    } finally {
      setSavingVenue(false);
    }
  }, [selectedVenue]);

  const handleSaveInstructor = useCallback(async (data: InstructorFormData) => {
    setSavingInstructor(true);
    const isNew = !editingInstructor;
    try {
      const body: Record<string, unknown> = {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim() || null,
        phone: data.phone.trim() || null,
        notes: data.notes.trim() || null,
        is_active: data.is_active,
        skills: data.skills.length > 0 ? data.skills : null,
        availability_json: data.availability_json,
      };
      const url = isNew ? '/api/instructors' : `/api/instructors/${editingInstructor!.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${isNew ? 'create' : 'update'} instructor`);
      }
      const { instructor: saved } = (await res.json()) as { instructor: Instructor };
      if (isNew) {
        setAllInstructors((prev) => [saved, ...prev]);
      } else {
        setAllInstructors((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
        // Also update selectedInstructor if detail modal is showing
        if (selectedInstructor?.id === saved.id) setSelectedInstructor(saved);
      }
      setEditingInstructor(null);
      setShowCreateModal(false);
      setToast({ message: isNew ? 'Instructor added successfully' : 'Instructor updated successfully', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to save instructor', type: 'error', id: Date.now() });
    } finally {
      setSavingInstructor(false);
    }
  }, [editingInstructor, selectedInstructor]);

  const handleDeleteInstructor = useCallback(async () => {
    if (!editingInstructor) return;
    setDeletingInstructor(true);
    try {
      const res = await fetch(`/api/instructors/${editingInstructor.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete instructor');
      setAllInstructors((prev) => prev.filter((i) => i.id !== editingInstructor.id));
      if (selectedInstructor?.id === editingInstructor.id) setSelectedInstructor(null);
      setEditingInstructor(null);
      setToast({ message: 'Instructor deleted successfully', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to delete instructor', type: 'error', id: Date.now() });
    } finally {
      setDeletingInstructor(false);
    }
  }, [editingInstructor, selectedInstructor]);

  const handleCreateVenue = useCallback(async (data: VenueFormData) => {
    setCreatingVenue(true);
    try {
      const body: Record<string, unknown> = {
        name: data.name.trim(),
        space_type: data.space_type,
        max_capacity: data.max_capacity ? Number(data.max_capacity) : null,
        is_virtual: data.is_virtual,
        notes: data.notes.trim() || null,
      };
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create venue');
      }
      const { venue: created } = (await res.json()) as { venue: Venue };
      setVenues((prev) => [created, ...prev]);
      setShowCreateVenueModal(false);
      setToast({ message: 'Venue added successfully', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to create venue', type: 'error', id: Date.now() });
    } finally {
      setCreatingVenue(false);
    }
  }, []);

  /* ── Derived state ─────────────────────────────────────── */

  const filtered = allInstructors.filter((inst) => {
    if (filterStatus === 'active' && !inst.is_active) return false;
    if (filterStatus === 'inactive' && inst.is_active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = `${inst.first_name} ${inst.last_name}`.toLowerCase();
      const email = (inst.email ?? '').toLowerCase();
      const skills = (inst.skills ?? []).join(' ').toLowerCase();
      return name.includes(q) || email.includes(q) || skills.includes(q);
    }
    return true;
  });

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ── Top Bar ──────────────────────────────────────── */}
      <div className="flex items-center bg-white px-8 py-4 border-b border-slate-200 gap-4 flex-shrink-0">
        <h1 className="text-[22px] font-bold text-slate-900 whitespace-nowrap">
          People &amp; Places
        </h1>
      </div>

      {/* ── Content Area ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* ── Share Intake Form Section ────────────────────── */}
        <section className="bg-gradient-to-r from-blue-50 to-violet-50 rounded-lg border border-blue-200 p-5">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white border border-blue-200 flex-shrink-0">
              <Mail className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Share Instructor Availability Form
              </h3>
              <p className="text-[13px] text-slate-600 mb-4">
                Send this link to instructors via email to collect their availability and contact information. The form saves directly to the system.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <ClickToCopy
                  text="https://tools.artsnwct.org/tools/scheduler/intake"
                  label="intake form link"
                />
                <a
                  href="/tools/scheduler/intake"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Preview Form
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Instructors Section ─────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">Instructors</h2>
            <Badge
              variant="count"
              color="blue"
              tooltip={`${filtered.length} instructor${filtered.length !== 1 ? 's' : ''}`}
            >
              ({filtered.length})
            </Badge>
            <div className="flex-1" />

            {/* Search Bar */}
            <Tooltip text="Search by name, email, or subject">
              <div className="flex items-center w-[240px] border border-slate-200 rounded-lg px-3 py-1.5 gap-2">
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search instructors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-[13px] text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
                />
              </div>
            </Tooltip>

            {/* Status Filter */}
            <Tooltip text="Filter by instructor status">
              <div className="relative flex items-center border border-slate-200 rounded-lg">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                  className="appearance-none bg-transparent px-3 py-1.5 pr-8 text-[13px] font-medium text-slate-500 outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown className="absolute right-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </Tooltip>

            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              tooltip="Add a new instructor to the roster"
              onClick={() => setShowCreateModal(true)}
            >
              Add Instructor
            </Button>
          </div>

          {loadingAll ? (
            <CardGridSkeleton />
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400">
              {allInstructors.length === 0
                ? 'No instructors found.'
                : 'No instructors match your filters.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((inst) => {
                const fullName = `${inst.first_name} ${inst.last_name}`;
                return (
                  <div
                    key={inst.id}
                    className="bg-white rounded-lg shadow-[0_1px_3px_#0000000A] border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          initials={getInitials(inst.first_name, inst.last_name)}
                          size="md"
                          bgColor={avatarColor(fullName)}
                          tooltip={fullName}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[16px] font-bold text-slate-900 truncate">
                              {fullName}
                            </span>
                            <Tooltip text={inst.is_active ? 'Currently active' : 'Currently inactive'}>
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  inst.is_active ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {inst.on_call && (
                          <Badge
                            variant="status"
                            color="green"
                            tooltip="Available for last-minute substitutions"
                          >
                            On-Call
                          </Badge>
                        )}
                        <Badge
                          variant="status"
                          color={inst.is_active ? 'green' : 'red'}
                          dot
                          tooltip={inst.is_active ? 'Active instructor' : 'Instructor is on leave'}
                        >
                          {inst.is_active ? 'Active' : 'On Leave'}
                        </Badge>
                      </div>
                    </div>

                    {/* Contact Info (click-to-copy) */}
                    <div className="flex flex-col gap-1.5">
                      {inst.email && (
                        <ClickToCopy
                          text={inst.email}
                          label="email"
                          icon={Mail}
                          textClassName="text-xs text-blue-500 truncate"
                          buttonClassName="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      )}
                      {inst.phone && (
                        <ClickToCopy
                          text={inst.phone}
                          label="phone"
                          icon={Phone}
                          textClassName="text-xs text-slate-600 truncate"
                          buttonClassName="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      )}
                    </div>

                    {/* Subject Pills (click → filter calendar by tag) */}
                    <div className="flex flex-wrap gap-1.5">
                      {(inst.skills ?? []).map((skill) => {
                        const s = SKILL_STYLES[skill];
                        return (
                          <Pill
                            key={skill}
                            variant="skill"
                            bgColor={s?.bg ?? 'bg-slate-100'}
                            textColor={s?.text ?? 'text-slate-600'}
                            tooltip={`Click to view calendar filtered by ${skill}`}
                            onClick={() => router.push(`/tools/scheduler/admin?tag=${encodeURIComponent(skill)}`)}
                          >
                            {s?.emoji ?? '🎵'} {skill}
                          </Pill>
                        );
                      })}
                      {(!inst.skills || inst.skills.length === 0) && (
                        <span className="text-[11px] text-slate-400">No subjects listed</span>
                      )}
                    </div>

                    {/* Weekly Availability */}
                    <div>
                      <div className="text-xs font-medium text-slate-600 mb-2">Weekly Availability</div>
                      <div className="flex justify-between">
                        {AVAIL_DAYS.map((day) => {
                        const blocks = inst.availability_json?.[day.key] ?? [];
                        const morningAvail = getTimePeriodAvailability(blocks, 8, 12); // 8am-12pm
                        const afternoonAvail = getTimePeriodAvailability(blocks, 12, 17); // 12pm-5pm
                        
                        const getAvailColor = (level: 'full' | 'partial' | 'none') => {
                          if (level === 'full') return 'bg-emerald-500';
                          if (level === 'partial') return 'bg-amber-400';
                          return 'bg-red-500';
                        };
                        
                        const tooltipText = `${day.label}: Morning ${morningAvail === 'full' ? '✓' : morningAvail === 'partial' ? '~' : '✗'}, Afternoon ${afternoonAvail === 'full' ? '✓' : afternoonAvail === 'partial' ? '~' : '✗'}`;
                        
                        return (
                          <Tooltip key={day.key} text={tooltipText}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-medium text-slate-400">
                                {day.label}
                              </span>
                              <div className="flex flex-col gap-0.5">
                                {/* Morning square */}
                                <span className={`w-2.5 h-2.5 ${getAvailColor(morningAvail)}`} />
                                {/* Afternoon square */}
                                <span className={`w-2.5 h-2.5 ${getAvailColor(afternoonAvail)}`} />
                              </div>
                            </div>
                          </Tooltip>
                        );
                      })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Tooltip text="View details, sessions, and availability">
                        <button
                          onClick={() => openDetail(inst)}
                          className="flex-1 rounded-md border border-slate-200 py-1.5 text-[13px] font-medium text-blue-500 hover:bg-slate-50 transition-colors text-center"
                        >
                          View Details
                        </button>
                      </Tooltip>
                      <Tooltip text="Edit instructor details">
                        <button
                          onClick={() => setEditingInstructor(inst)}
                          className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </Tooltip>
                    </div>

                    {/* View on Calendar Link */}
                    <Tooltip text="Jump to calendar filtered to this instructor">
                      <Link
                        href={`/tools/scheduler/admin?instructor=${inst.id}`}
                        className="text-xs font-medium text-blue-500 hover:text-blue-600"
                      >
                        View on Calendar &rarr;
                      </Link>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Venues Section ──────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">Venues</h2>
            <Badge
              variant="count"
              color="blue"
              tooltip={`${venues.length} venue${venues.length !== 1 ? 's' : ''}`}
            >
              ({venues.length})
            </Badge>
            <div className="flex-1" />
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              tooltip="Add a new venue"
              onClick={() => setShowCreateVenueModal(true)}
            >
              Add Venue
            </Button>
          </div>

          {loadingVenues ? (
            <CardGridSkeleton count={3} />
          ) : venues.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400">
              No venues found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  className="bg-white rounded-lg shadow-[0_1px_3px_#0000000A] border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
                >
                  {/* Header: Name + Type Badge */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-slate-900 truncate">
                        {venue.name}
                      </p>
                      <p className="text-sm text-slate-400">{venue.space_type}</p>
                    </div>
                    <Badge
                      variant="status"
                      color={venue.is_virtual ? 'violet' : 'blue'}
                      tooltip={venue.is_virtual ? 'Virtual venue' : 'In-person venue'}
                    >
                      {venue.is_virtual ? 'Virtual' : 'In-Person'}
                    </Badge>
                  </div>

                  {/* Capacity */}
                  <Tooltip text={`Maximum capacity: ${venue.max_capacity ?? 'Unlimited'}`}>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[13px] text-slate-500">
                        Capacity: {venue.max_capacity ?? 'Unlimited'}
                      </span>
                    </div>
                  </Tooltip>

                  {/* View Details Button */}
                  <Tooltip text="View and edit venue details">
                    <button
                      onClick={() => setSelectedVenue(venue)}
                      className="w-full rounded-md border border-slate-200 py-1.5 text-[13px] font-medium text-blue-500 hover:bg-slate-50 transition-colors text-center"
                    >
                      View Details
                    </button>
                  </Tooltip>

                  {/* View Schedule Link */}
                  <Tooltip text="View venue schedule on the calendar">
                    <Link
                      href={`/tools/scheduler/admin?venue=${venue.id}`}
                      className="text-xs font-medium text-blue-500 hover:text-blue-600"
                    >
                      View Schedule &rarr;
                    </Link>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Instructor Detail Modal ──────────────────────── */}
      {selectedInstructor && (
        <InstructorDetailModal
          instructor={selectedInstructor}
          sessionCount={detailSessionCount}
          sessions={detailSessions}
          loadingSessions={loadingDetailSessions}
          togglingStatus={togglingStatus}
          togglingOnCall={togglingOnCall}
          onClose={() => setSelectedInstructor(null)}
          onToggleStatus={toggleStatus}
          onToggleOnCall={toggleOnCall}
          onEdit={() => setEditingInstructor(selectedInstructor)}
        />
      )}

      {/* ── Instructor Edit / Create Modal ────────────────── */}
      {(editingInstructor || showCreateModal) && (
        <InstructorEditModal
          instructor={editingInstructor}
          saving={savingInstructor}
          deleting={deletingInstructor}
          onSave={handleSaveInstructor}
          onDelete={editingInstructor ? handleDeleteInstructor : null}
          onClose={() => { setEditingInstructor(null); setShowCreateModal(false); }}
        />
      )}

      {/* ── Venue Create Modal ─────────────────────────────── */}
      {showCreateVenueModal && (
        <VenueCreateModal
          saving={creatingVenue}
          onSave={handleCreateVenue}
          onClose={() => setShowCreateVenueModal(false)}
        />
      )}

      {/* ── Venue Detail Modal ────────────────────────────── */}
      {selectedVenue && (
        <VenueDetailModal
          venue={selectedVenue}
          saving={savingVenue}
          onClose={() => setSelectedVenue(null)}
          onSave={handleSaveVenue}
        />
      )}

      {/* ── Toast notifications ───────────────────────────── */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
