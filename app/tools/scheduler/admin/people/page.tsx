'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, MapPin, Search, Plus, ChevronDown, X, Mail, Phone,
  Accessibility, Clock, Home, StickyNote, Edit2, Copy,
  Check, AlertTriangle, Loader2, Trash2, Save, RefreshCw, Upload,
} from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Pill } from '../../components/ui/Pill';
import { Avatar } from '../../components/ui/Avatar';
import { ClickToCopy } from '../../components/ui/ClickToCopy';
import { TagSelector } from '../../components/ui/TagSelector';
import { AvailabilityEditor, isHourAvailable, formatHourLabel } from '../../components/ui/AvailabilityEditor';
import { CsvImportDialog, type CsvColumnDef, type ValidationError } from '../../components/ui/CsvImportDialog';
import { InstructorEditModal } from '../../components/modals/InstructorEditModal';
import { Modal, ModalButton } from '../../components/ui/Modal';
import type { InstructorFormData } from '../../components/modals/InstructorEditModal';
import type { CsvRow } from '@/lib/csvDedup';
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

/* Availability grid helpers (for modal) */
const ALL_DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday', short: 'Mon' }, { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' }, { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' }, { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];
const GRID_HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

/* ── Venue CSV Import config ───────────────────────────────── */

const VENUE_CSV_COLUMNS: CsvColumnDef[] = [
  { csvHeader: 'name', label: 'Name', required: true },
  { csvHeader: 'space_type', label: 'Space Type' },
  { csvHeader: 'max_capacity', label: 'Max Capacity' },
  { csvHeader: 'address', label: 'Address' },
  { csvHeader: 'is_virtual', label: 'Is Virtual' },
  { csvHeader: 'amenities', label: 'Amenities' },
  { csvHeader: 'description', label: 'Description' },
  { csvHeader: 'monday', label: 'Monday' },
  { csvHeader: 'tuesday', label: 'Tuesday' },
  { csvHeader: 'wednesday', label: 'Wednesday' },
  { csvHeader: 'thursday', label: 'Thursday' },
  { csvHeader: 'friday', label: 'Friday' },
  { csvHeader: 'saturday', label: 'Saturday' },
  { csvHeader: 'sunday', label: 'Sunday' },
  { csvHeader: 'notes', label: 'Notes' },
  { csvHeader: 'min_booking_duration_minutes', label: 'Min Booking (min)' },
  { csvHeader: 'max_booking_duration_minutes', label: 'Max Booking (min)' },
  { csvHeader: 'buffer_minutes', label: 'Buffer (min)' },
  { csvHeader: 'advance_booking_days', label: 'Advance Booking Days' },
  { csvHeader: 'cancellation_window_hours', label: 'Cancel Window (hrs)' },
  { csvHeader: 'cost_per_hour', label: 'Cost Per Hour' },
  { csvHeader: 'max_concurrent_bookings', label: 'Max Concurrent' },
  { csvHeader: 'blackout_dates', label: 'Blackout Dates' },
  { csvHeader: 'is_wheelchair_accessible', label: 'Wheelchair Accessible' },
  { csvHeader: 'subjects', label: 'Event Type' },
];

const VENUE_CSV_EXAMPLE = `name,space_type,max_capacity,address,is_virtual,amenities,description,monday,tuesday,wednesday,thursday,friday,saturday,sunday,notes,min_booking_duration_minutes,max_booking_duration_minutes,buffer_minutes,advance_booking_days,cancellation_window_hours,cost_per_hour,max_concurrent_bookings,blackout_dates,is_wheelchair_accessible,subjects
Classroom 101,classroom,30,123 Main St,false,Whiteboard;Projector;Piano,Main teaching room,08:00-18:00,08:00-18:00,08:00-18:00,08:00-18:00,08:00-18:00,,,Ground floor room,30,120,15,14,24,25.00,1,2026-12-25;2026-01-01,true,Piano;Guitar
Virtual Room A,virtual,50,,true,Screen Share;Breakout Rooms,Online meeting space,09:00-12:00;13:00-17:00,09:00-12:00;13:00-17:00,09:00-12:00;13:00-17:00,09:00-12:00;13:00-17:00,09:00-12:00;13:00-17:00,,,Online room,15,60,5,7,12,,2,,,Voice;Theory
Stage,performance,100,456 Arts Blvd,false,Sound System;Lighting;Stage,Performance venue,,,,,,,10:00-22:00,Requires advance setup,60,240,30,30,48,75.00,1,2026-12-24;2026-12-25,true,Choir;Orchestra`;

const isNonNegInt = (v: string): boolean => /^\d+$/.test(v.trim());
const isNonNegNum = (v: string): boolean => /^\d+(\.\d+)?$/.test(v.trim());

function validateVenueCsvRow(row: CsvRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!row.name?.trim()) {
    errors.push({ row: rowIndex, column: 'name', message: 'Name is required' });
  }
  const intFields: [string, string][] = [
    ['max_capacity', 'Max Capacity'],
    ['min_booking_duration_minutes', 'Min Booking Duration'],
    ['max_booking_duration_minutes', 'Max Booking Duration'],
    ['buffer_minutes', 'Buffer Minutes'],
    ['advance_booking_days', 'Advance Booking Days'],
    ['cancellation_window_hours', 'Cancellation Window'],
    ['max_concurrent_bookings', 'Max Concurrent Bookings'],
  ];
  for (const [field, label] of intFields) {
    if (row[field]?.trim() && !isNonNegInt(row[field])) {
      errors.push({ row: rowIndex, column: field, message: `${label} must be a whole number` });
    }
  }
  if (row.cost_per_hour?.trim() && !isNonNegNum(row.cost_per_hour)) {
    errors.push({ row: rowIndex, column: 'cost_per_hour', message: 'Must be a number' });
  }
  const timeRangePattern = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  const dayColumns = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  for (const day of dayColumns) {
    const val = row[day]?.trim();
    if (val) {
      const ranges = val.split(';').map((s: string) => s.trim()).filter(Boolean);
      for (const range of ranges) {
        if (!timeRangePattern.test(range)) {
          errors.push({ row: rowIndex, column: day, message: `Invalid time range "${range}". Use HH:MM-HH:MM format` });
        }
      }
    }
  }
  return errors;
}

/* ── Instructor CSV Import config ─────────────────────────── */

const INSTRUCTOR_CSV_COLUMNS: CsvColumnDef[] = [
  { csvHeader: 'first_name', label: 'First Name', required: true },
  { csvHeader: 'last_name', label: 'Last Name', required: true },
  { csvHeader: 'email', label: 'Email' },
  { csvHeader: 'phone', label: 'Phone' },
  { csvHeader: 'skills', label: 'Skills' },
  { csvHeader: 'availability_json', label: 'Availability JSON' },
  { csvHeader: 'is_active', label: 'Is Active' },
  { csvHeader: 'on_call', label: 'On Call' },
  { csvHeader: 'notes', label: 'Notes' },
];

const INSTRUCTOR_CSV_EXAMPLE = `first_name,last_name,email,phone,skills,availability_json,is_active,on_call,notes
Maria,Gonzalez,maria.gonzalez@example.com,555-0101,Piano;Voice;Music Theory,"{""monday"":[{""start"":""09:00"",""end"":""15:00""}],""wednesday"":[{""start"":""09:00"",""end"":""15:00""}]}",true,false,Bilingual instructor
James,Chen,james.chen@example.com,555-0102,Guitar;Bass;Ukulele,"{""tuesday"":[{""start"":""10:00"",""end"":""18:00""}],""thursday"":[{""start"":""10:00"",""end"":""18:00""}],""friday"":[{""start"":""12:00"",""end"":""17:00""}]}",true,true,Available for weekend workshops
Aisha,Williams,aisha.williams@example.com,555-0103,Violin;Viola;Orchestra,"{""monday"":[{""start"":""08:00"",""end"":""14:00""}],""tuesday"":[{""start"":""08:00"",""end"":""14:00""}],""wednesday"":[{""start"":""08:00"",""end"":""14:00""}]}",true,false,`;

const isValidEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function validateInstructorCsvRow(row: CsvRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!row.first_name?.trim()) {
    errors.push({ row: rowIndex, column: 'first_name', message: 'First name is required' });
  }
  if (!row.last_name?.trim()) {
    errors.push({ row: rowIndex, column: 'last_name', message: 'Last name is required' });
  }
  if (row.email?.trim() && !isValidEmail(row.email)) {
    errors.push({ row: rowIndex, column: 'email', message: 'Invalid email format' });
  }
  if (row.availability_json?.trim()) {
    try { JSON.parse(row.availability_json); } catch {
      errors.push({ row: rowIndex, column: 'availability_json', message: 'Invalid JSON' });
    }
  }
  return errors;
}

/* ── Helpers ────────────────────────────────────────────────── */

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
      role="alert"
      aria-live="assertive"
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
    return <p className="text-sm text-slate-700">No availability set</p>;
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
            <div key={d.key} className="bg-slate-50 py-1.5 text-center text-xs font-medium text-slate-700">
              {d.short}
            </div>
          ))}
          {GRID_HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex items-center justify-end pr-1.5 text-[10px] text-slate-700 bg-white h-6 border-t border-slate-200">
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

/* ── Venue Detail / Edit Modal ─────────────────────────────── */

function VenueDetailModal({
  venue, saving, deleting, onClose, onSave, onDelete,
}: {
  venue: Venue;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (updates: Record<string, unknown>) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { selectedProgramId } = useProgram();

  /* ── Space types from tags API ─── */
  const [spaceTypes, setSpaceTypes] = useState<string[]>([]);
  useEffect(() => {
    fetch(`/api/tags?program_id=${selectedProgramId}`)
      .then((r) => r.json())
      .then((d) => {
        const types = (d.tags ?? [])
          .filter((t: { category: string }) => ['Space Types', 'Spaces Type', 'space types', 'Space Type'].includes(t.category))
          .map((t: { name: string }) => t.name);
        setSpaceTypes(types);
      })
      .catch(() => {});
  }, [selectedProgramId]);

  /* ── Edit-mode state ─── */
  const [editName, setEditName] = useState(venue.name || '');
  const [capacity, setCapacity] = useState<string>(
    venue.max_capacity != null ? String(venue.max_capacity) : ''
  );
  const [roomType, setRoomType] = useState(venue.space_type || '');
  const [venueSubjects, setVenueSubjects] = useState<string[]>(venue.subjects || []);
  const [accessible, setAccessible] = useState(
    venue.is_wheelchair_accessible ?? (venue.amenities ?? []).includes('wheelchair_accessible')
  );
  const [bufferMinutes, setBufferMinutes] = useState<string>(
    venue.buffer_minutes != null ? String(venue.buffer_minutes) : ''
  );
  const [notes, setNotes] = useState(venue.notes ?? '');
  const [editAvailability, setEditAvailability] = useState<AvailabilityJson | null>(
    venue.availability_json ?? null
  );

  const handleSave = () => {
    const amenities: string[] = [];
    if (accessible) amenities.push('wheelchair_accessible');
    onSave({
      name: editName.trim(),

      max_capacity: capacity ? Number(capacity) : null,
      space_type: roomType,
      amenities: amenities.length > 0 ? amenities : null,
      is_wheelchair_accessible: accessible,
      buffer_minutes: bufferMinutes ? Number(bufferMinutes) : null,
      availability_json: editAvailability,
      notes: notes.trim() || null,
      subjects: venueSubjects.length > 0 ? venueSubjects : null,
    });
  };

  const handleCancelEdit = () => {
    // Reset state back to venue values
    setEditName(venue.name || '');
    setCapacity(venue.max_capacity != null ? String(venue.max_capacity) : '');
    setRoomType(venue.space_type || '');
    setVenueSubjects(venue.subjects || []);
    setAccessible(venue.is_wheelchair_accessible ?? (venue.amenities ?? []).includes('wheelchair_accessible'));
    setBufferMinutes(venue.buffer_minutes != null ? String(venue.buffer_minutes) : '');
    setEditAvailability(venue.availability_json ?? null);
    setNotes(venue.notes ?? '');
    setEditing(false);
  };

  /* ── Derived display values ─── */
  const isAccessible = venue.is_wheelchair_accessible ?? (venue.amenities ?? []).includes('wheelchair_accessible');

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editing ? '' : venue.name}
      width="700px"
      footer={
        <>
          <Tooltip text="Jump to calendar filtered to this venue">
            <Link
              href={`/tools/scheduler/admin?venue=${venue.id}`}
              onClick={onClose}
              className="text-[13px] font-medium text-blue-500 hover:text-blue-600"
            >
              View Schedule &rarr;
            </Link>
          </Tooltip>
          <div className="flex-1" />
          {editing ? (
            <>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">Delete this venue?</span>
                  <Tooltip text="Confirm deletion">
                    <button
                      onClick={onDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting…' : 'Yes, Delete'}
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
                <Tooltip text="Delete this venue permanently">
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </Tooltip>
              )}
              <ModalButton onClick={handleCancelEdit}>Cancel</ModalButton>
              <ModalButton variant="primary" onClick={handleSave} disabled={saving || !editName.trim()} loading={saving}>
                Save Changes
              </ModalButton>
            </>
          ) : (
            <ModalButton onClick={() => setEditing(true)} icon={<Edit2 className="w-3.5 h-3.5" />}>
              Edit
            </ModalButton>
          )}
        </>
      }
    >
      {/* Editable name when in edit mode */}
      {editing && (
        <div className="px-6 py-3">
          <Tooltip text="Venue name">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-[22px] font-bold text-slate-900 bg-transparent border-b-2 border-blue-400 outline-none w-full max-w-[400px]"
              placeholder="Venue name"
            />
          </Tooltip>
        </div>
      )}

      {!editing ? (
        /* ── READ-ONLY VIEW ─── */
        <div className="divide-y divide-slate-200">

          {/* Capacity & Space Type */}
          <div className="flex items-center px-6 py-3 gap-6">
            <Tooltip text="Maximum capacity">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-700" />
                <span className="text-[13px] text-slate-700">
                  Capacity: <span className="font-medium">{venue.max_capacity ?? 'Not set'}</span>
                </span>
              </div>
            </Tooltip>
            <Tooltip text="Space type">
              <div className="flex items-center gap-1.5">
                <Home className="w-4 h-4 text-slate-700" />
                <span className="text-[13px] text-slate-700">
                  Space Type: <span className="font-medium">{venue.space_type || 'Not set'}</span>
                </span>
              </div>
            </Tooltip>
          </div>

          {/* Subjects */}
          {venue.subjects && venue.subjects.length > 0 && (
            <div className="flex items-center flex-wrap px-6 py-3 gap-1.5">
              <span className="text-[13px] text-slate-500 mr-1">Event Type:</span>
              {venue.subjects.map((s) => (
                <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Accessibility */}
          <div className="flex items-center px-6 py-3 gap-1.5">
            <Accessibility className="w-4 h-4 text-slate-700" />
            <span className="text-[13px] text-slate-700">
              Wheelchair accessible:{' '}
              <span className={`font-medium ${isAccessible ? 'text-emerald-600' : 'text-slate-700'}`}>
                {isAccessible ? 'Yes' : 'No'}
              </span>
            </span>
          </div>

          {/* Setup / Teardown Buffer */}
          <div className="flex items-center px-6 py-3 gap-1.5">
            <Tooltip text="Setup and teardown time required before/after events">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-700" />
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
              <StickyNote className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Notes</span>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {venue.notes || <span className="text-slate-700">No notes added</span>}
            </p>
          </div>
        </div>
      ) : (
        /* ── EDIT VIEW ─── */
        <div className="px-6 py-4 space-y-5">
          {/* Capacity */}
          <div>
            <label htmlFor="venue-capacity" className="block text-xs font-semibold text-slate-500 mb-1.5">Capacity</label>
            <Tooltip text="Maximum number of people this venue can hold">
              <input
                type="number"
                id="venue-capacity"
                min="0"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 30"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Availability Times */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Availability Times</label>
            <AvailabilityEditor
              value={editAvailability}
              onChange={setEditAvailability}
            />
          </div>

          {/* Space Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Space Type</label>
            <Tooltip text="Select the space type for this venue">
              <div className="relative">
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 cursor-pointer transition-colors"
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
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700 pointer-events-none" />
              </div>
            </Tooltip>
          </div>

          {/* Subjects (Optional) */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-xs font-semibold text-slate-500">Event Type (Optional)</label>
              <Tooltip text="Restrict this venue to specific event types. Leave empty for all event types.">
                <AlertTriangle className="w-3 h-3 text-slate-700" />
              </Tooltip>
            </div>
            <TagSelector
              category="Event Type"
              value={venueSubjects}
              onChange={setVenueSubjects}
              programId={selectedProgramId ?? ''}
              placeholder="All event types (no restriction)"
            />
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
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500 cursor-pointer accent-blue-500"
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
                  className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 resize-none transition-colors"
              />
            </Tooltip>
          </div>
        </div>
      )}
    </Modal>
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
    <Modal
      open={true}
      onClose={onClose}
      title={`${instructor.first_name} ${instructor.last_name}`}
      width="700px"
      footer={
        <>
          <Tooltip text="Jump to calendar filtered to this staff member">
            <Link
              href={`/tools/scheduler/admin?instructor=${instructor.id}`}
              onClick={onClose}
              className="text-[13px] font-medium text-blue-500 hover:text-blue-600"
            >
              View on Calendar &rarr;
            </Link>
          </Tooltip>
          <div className="flex-1" />
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
          <Tooltip text={instructor.is_active ? 'Make this staff member inactive' : 'Activate this staff member'}>
            <button
              onClick={onToggleStatus}
              disabled={togglingStatus}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-50 ${
                instructor.is_active
                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                  : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {togglingStatus ? 'Updating\u2026' : instructor.is_active ? 'Make Inactive' : 'Activate'}
            </button>
          </Tooltip>
          <Button variant="secondary" tooltip="Edit staff member profile" onClick={onEdit} aria-label={`Edit ${instructor.first_name} ${instructor.last_name}`}>Edit</Button>
        </>
      }
    >
      {/* Status badges */}
      <div className="flex items-center gap-2.5 px-6 py-3">
        <Tooltip text={instructor.is_active ? 'Active staff member' : 'Inactive staff member'}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${instructor.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </Tooltip>
        <span className="text-sm text-slate-500">{instructor.is_active ? 'Active' : 'Inactive'}</span>
        {instructor.on_call && (
          <Badge variant="status" color="green" tooltip="Available for last-minute substitutions">
            On-Call
          </Badge>
        )}
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
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Event Type</span>
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
          <span className="text-sm text-slate-700">No event types listed</span>
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
            <span className="text-[11px] text-slate-700 ml-auto whitespace-nowrap">
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
          <p className="text-sm text-slate-700">No sessions assigned yet.</p>
        )}
      </div>
    </Modal>
  );
}

/* ── Venue Create Modal ────────────────────────────────────── */

interface VenueFormData {
  name: string;
  space_type: string;
  max_capacity: string;
  is_virtual: boolean;
  is_wheelchair_accessible: boolean;
  buffer_minutes: string;
  availability_json: AvailabilityJson | null;
  notes: string;
  subjects: string[];
}

const EMPTY_VENUE_FORM: VenueFormData = {
  name: '',
  space_type: '',
  max_capacity: '',
  is_virtual: false,
  is_wheelchair_accessible: false,
  buffer_minutes: '',
  availability_json: null,
  notes: '',
  subjects: [],
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
  const { selectedProgramId } = useProgram();
  const [form, setForm] = useState<VenueFormData>({ ...EMPTY_VENUE_FORM });
  const [spaceTypes, setSpaceTypes] = useState<string[]>([]);
  const [loadingSpaceTypes, setLoadingSpaceTypes] = useState(true);
  const [showAddSpaceType, setShowAddSpaceType] = useState(false);
  const [newSpaceTypeName, setNewSpaceTypeName] = useState('');
  const [addingSpaceType, setAddingSpaceType] = useState(false);

  // Fetch space types from tags
  const fetchSpaceTypes = useCallback(() => {
    setLoadingSpaceTypes(true);
    fetch(`/api/tags?program_id=${selectedProgramId}`)
      .then((res) => res.json())
      .then((data) => {
        const types = (data.tags ?? [])
          .filter((t: { category: string }) => ['Space Types', 'Spaces Type', 'space types', 'Space Type'].includes(t.category))
          .map((t: { name: string }) => t.name);
        setSpaceTypes(types);
      })
      .catch(() => setSpaceTypes([]))
      .finally(() => setLoadingSpaceTypes(false));
  }, [selectedProgramId]);

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
        body: JSON.stringify({ name: trimmed, category: 'Space Types', program_id: selectedProgramId }),
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
    <Modal
      open={true}
      onClose={onClose}
      title="Add Venue"
      width="560px"
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton
            variant="primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            loading={saving}
            icon={!saving ? <Save className="w-3.5 h-3.5" /> : undefined}
          >
            {saving ? 'Creating…' : 'Add Venue'}
          </ModalButton>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="px-6 py-4 space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="venue-form-name" className="block text-xs font-semibold text-slate-500 mb-1.5">Name *</label>
          <Tooltip text="Venue or room name" className="w-full">
            <input
              type="text"
              id="venue-form-name"
              required
              aria-required="true"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              maxLength={100}
              placeholder="e.g. Main Stage"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
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
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
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
              className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <option value="">{loadingSpaceTypes ? 'Loading...' : spaceTypes.length === 0 ? 'None yet — use + to add' : 'Select type...'}</option>
              {spaceTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700 pointer-events-none" />
          </div>
        </div>

        {/* Subjects (Optional) */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-xs font-semibold text-slate-500">Event Type (Optional)</label>
            <Tooltip text="Restrict this venue to specific event types. Leave empty for all event types.">
              <AlertTriangle className="w-3 h-3 text-slate-700" />
            </Tooltip>
          </div>
          <TagSelector
            category="Event Type"
            value={form.subjects}
            onChange={(val) => setField('subjects', val as unknown as VenueFormData['subjects'])}
            programId={selectedProgramId ?? ''}
            placeholder="All event types (no restriction)"
          />
        </div>

        {/* Max Capacity */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Max Capacity</label>
          <Tooltip text="Maximum number of people this venue can hold (leave blank for unlimited)" className="w-full">
            <input
              type="number"
              min={0}
              value={form.max_capacity}
              onChange={(e) => setField('max_capacity', e.target.value)}
              placeholder="e.g. 30"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
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
                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500 cursor-pointer accent-blue-500"
              />
              <span className="text-sm text-slate-700">Wheelchair Accessible</span>
            </label>
          </Tooltip>
        </div>

        {/* Setup / Teardown Buffer */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Setup/Teardown Buffer</label>
          <Tooltip text="Minutes needed before and after events for setup and teardown" className="w-full">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={form.buffer_minutes}
                onChange={(e) => setField('buffer_minutes', e.target.value)}
                placeholder="0"
                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
              />
              <span className="text-sm text-slate-500">minutes</span>
            </div>
          </Tooltip>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Availability</label>
          <AvailabilityEditor
            value={form.availability_json}
            onChange={(v) => setField('availability_json', v)}
          />
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 resize-none transition-colors"
            />
          </Tooltip>
        </div>
      </form>
    </Modal>
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
  const [venueImportOpen, setVenueImportOpen] = useState(false);
  const [instructorImportOpen, setInstructorImportOpen] = useState(false);
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');

  /* ── Fetching ──────────────────────────────────────────── */

  const fetchInstructors = useCallback(async () => {
    setLoadingAll(true);
    try {
      const res = await fetch(`/api/instructors?program_id=${selectedProgramId}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const { instructors } = (await res.json()) as { instructors: Instructor[] };
      setAllInstructors(instructors);
    } catch {
      setAllInstructors([]);
    } finally {
      setLoadingAll(false);
    }
  }, [selectedProgramId]);

  const fetchVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const res = await fetch(`/api/venues?program_id=${selectedProgramId}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const { venues: data } = (await res.json()) as { venues: Venue[] };
      setVenues(data);
    } catch {
      setVenues([]);
    } finally {
      setLoadingVenues(false);
    }
  }, [selectedProgramId]);

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
      setToast({ message: updated.on_call ? 'Staff set as on-call' : 'Staff removed from on-call', type: 'success', id: Date.now() });
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

  const [deletingVenue, setDeletingVenue] = useState(false);
  const handleDeleteVenue = useCallback(async () => {
    if (!selectedVenue) return;
    setDeletingVenue(true);
    try {
      const res = await fetch(`/api/venues/${selectedVenue.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        if (data.error && (data.error.includes('foreign key') || data.error.includes('constraint'))) {
          throw new Error('Cannot delete: this venue is assigned to existing sessions. Remove it from sessions first.');
        }
        throw new Error(data.error || 'Failed to delete venue');
      }
      setVenues((prev) => prev.filter((v) => v.id !== selectedVenue.id));
      setSelectedVenue(null);
      setToast({ message: 'Venue deleted', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to delete venue', type: 'error', id: Date.now() });
    } finally {
      setDeletingVenue(false);
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
      if (isNew) body.program_id = selectedProgramId;
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
      setToast({ message: isNew ? 'Staff added successfully' : 'Staff updated successfully', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to save staff', type: 'error', id: Date.now() });
    } finally {
      setSavingInstructor(false);
    }
  }, [editingInstructor, selectedInstructor, selectedProgramId]);

  const handleDeleteInstructor = useCallback(async () => {
    if (!editingInstructor) return;
    setDeletingInstructor(true);
    try {
      const res = await fetch(`/api/instructors/${editingInstructor.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete staff');
      setAllInstructors((prev) => prev.filter((i) => i.id !== editingInstructor.id));
      if (selectedInstructor?.id === editingInstructor.id) setSelectedInstructor(null);
      setEditingInstructor(null);
      setToast({ message: 'Staff deleted successfully', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to delete staff', type: 'error', id: Date.now() });
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
        is_wheelchair_accessible: data.is_wheelchair_accessible,
        buffer_minutes: data.buffer_minutes ? Number(data.buffer_minutes) : null,
        availability_json: data.availability_json,
        notes: data.notes.trim() || null,
        subjects: data.subjects.length > 0 ? data.subjects : null,
        program_id: selectedProgramId,
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
  }, [selectedProgramId]);

  /* ── Derived state ─────────────────────────────────────── */

  const filteredVenues = venues.filter((v) => {
    if (venueSearch.trim()) {
      const q = venueSearch.toLowerCase();
      const name = (v.name ?? '').toLowerCase();
      const spaceType = (v.space_type ?? '').toLowerCase();
      return name.includes(q) || spaceType.includes(q);
    }
    return true;
  });

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
      <div className="flex items-center bg-white px-3 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-slate-200 gap-4 flex-shrink-0">
        <h1 className="text-lg sm:text-xl lg:text-[22px] font-bold text-slate-900 whitespace-nowrap">
          Staff &amp; Venues
        </h1>
      </div>

      {/* ── Content Area ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* ── Share Intake Form Section ────────────────────── */}
        <section className="bg-gradient-to-r from-blue-50 to-violet-50 rounded-lg border border-blue-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white border border-blue-200 flex-shrink-0">
              <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">
                Share Staff Availability Form
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-600 mb-3 sm:mb-4">
                Send this link to staff via email to collect their availability and contact information. The form saves directly to the system.
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
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">Staff</h2>
            <Badge
              variant="count"
              color="blue"
              tooltip={`${filtered.length} staff member${filtered.length !== 1 ? 's' : ''}`}
            >
              ({filtered.length})
            </Badge>
            <div className="flex-1 min-w-0" />

            {/* Search Bar */}
            <Tooltip text="Search by name, email, or event type">
              <div className="flex items-center w-full sm:w-[240px] border border-slate-200 rounded-lg px-3 py-1.5 gap-2">
                <Search className="w-4 h-4 text-slate-700 flex-shrink-0" />
                <input
                  type="text"
                  aria-label="Search people"
                  placeholder="Search staff..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 text-[13px] text-slate-900 placeholder:text-slate-500 bg-transparent outline-none"
                />
              </div>
            </Tooltip>

            {/* Status Filter */}
            <Tooltip text="Filter by staff status">
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
                <ChevronDown className="absolute right-3 w-3.5 h-3.5 text-slate-700 pointer-events-none" />
              </div>
            </Tooltip>

            <Button
              variant="ghost"
              icon={<Upload className="w-4 h-4" />}
              tooltip="Import staff from CSV"
              onClick={() => setInstructorImportOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              tooltip="Add a new staff member to the roster"
              onClick={() => setShowCreateModal(true)}
            >
              Add Staff
            </Button>
          </div>

          {loadingAll ? (
            <CardGridSkeleton />
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500">
              {allInstructors.length === 0
                ? 'No staff found.'
                : 'No staff match your filters.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((inst) => {
                const fullName = `${inst.first_name} ${inst.last_name}`;
                return (
                  <div
                    key={inst.id}
                    onClick={() => openDetail(inst)}
                    className="group relative bg-white rounded-lg shadow-[0_1px_3px_#0000000A] border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
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
                          tooltip={inst.is_active ? 'Active staff member' : 'Staff member is on leave'}
                        >
                          {inst.is_active ? 'Active' : 'On Leave'}
                        </Badge>
                      </div>
                    </div>

                    {/* Contact Info (click-to-copy) */}
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                    <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                    <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                        <span className="text-[11px] text-slate-500">No event types listed</span>
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
                              <span className="text-[10px] font-medium text-slate-500">
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

                    {/* View on Calendar Link */}
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Tooltip text="Jump to calendar filtered to this staff member">
                        <Link
                          href={`/tools/scheduler/admin?instructor=${inst.id}`}
                          className="text-xs font-medium text-blue-500 hover:text-blue-600"
                        >
                          View on Calendar &rarr;
                        </Link>
                      </Tooltip>
                    </div>

                    {/* Edit Button */}
                    <Tooltip text={`Edit ${inst.first_name} ${inst.last_name}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingInstructor(inst); }}
                        aria-label={`Edit ${inst.first_name} ${inst.last_name}`}
                        className="absolute bottom-3 right-3 w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-700" />
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Venues Section ──────────────────────────────── */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">Venues</h2>
            <Badge
              variant="count"
              color="blue"
              tooltip={`${filteredVenues.length} venue${filteredVenues.length !== 1 ? 's' : ''}`}
            >
              ({filteredVenues.length})
            </Badge>
            <div className="flex-1 min-w-0" />

            {/* Search Bar */}
            <Tooltip text="Search by venue name or space type">
              <div className="flex items-center w-full sm:w-[240px] border border-slate-200 rounded-lg px-3 py-1.5 gap-2">
                <Search className="w-4 h-4 text-slate-700 flex-shrink-0" />
                <input
                  type="text"
                  aria-label="Search venues"
                  placeholder="Search venues..."
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  className="flex-1 text-[13px] text-slate-900 placeholder:text-slate-500 bg-transparent outline-none"
                />
              </div>
            </Tooltip>

            <Button
              variant="ghost"
              icon={<Upload className="w-4 h-4" />}
              tooltip="Import venues from CSV"
              onClick={() => setVenueImportOpen(true)}
            >
              Import CSV
            </Button>
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
          ) : filteredVenues.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-700">
              {venues.length === 0
                ? 'No venues found.'
                : 'No venues match your search.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVenues.map((venue) => (
                <div
                  key={venue.id}
                  onClick={() => setSelectedVenue(venue)}
                  className="group relative bg-white rounded-lg shadow-[0_1px_3px_#0000000A] border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
                >
                  {/* Header: Name + Type Badge */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-slate-900 truncate">
                        {venue.name}
                      </p>
                      <p className="text-sm text-slate-700">{venue.space_type}</p>
                    </div>
                  </div>

                  {/* Subjects */}
                  {venue.subjects && venue.subjects.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1">
                      {venue.subjects.map((s) => (
                        <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Capacity */}
                  <Tooltip text={`Maximum capacity: ${venue.max_capacity ?? 'Unlimited'}`}>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[13px] text-slate-500">
                        Capacity: {venue.max_capacity ?? 'Unlimited'}
                      </span>
                    </div>
                  </Tooltip>

                  {/* View Schedule Link */}
                  {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Tooltip text="View venue schedule on the calendar">
                      <Link
                        href={`/tools/scheduler/admin?venue=${venue.id}`}
                        className="text-xs font-medium text-blue-500 hover:text-blue-600"
                      >
                        View Schedule &rarr;
                      </Link>
                    </Tooltip>
                  </div>

                  {/* Edit Button */}
                  <Tooltip text={`Edit ${venue.name}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedVenue(venue); }}
                      aria-label={`Edit ${venue.name}`}
                      className="absolute bottom-3 right-3 w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-700" />
                    </button>
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
          existingInstructors={allInstructors}
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
          deleting={deletingVenue}
          onClose={() => setSelectedVenue(null)}
          onSave={handleSaveVenue}
          onDelete={handleDeleteVenue}
        />
      )}

      {/* ── Venue CSV Import Dialog ─────────────────────────── */}
      <CsvImportDialog
        open={venueImportOpen}
        onClose={() => setVenueImportOpen(false)}
        title="Import Venues from CSV"
        columns={VENUE_CSV_COLUMNS}
        validateRow={validateVenueCsvRow}
        onImport={async (csvRows: CsvRow[]) => {
          const mapped = csvRows.map((r) => ({
            name: r.name || '',
            space_type: r.space_type || '',
            max_capacity: r.max_capacity || '',
            address: r.address || '',
            is_virtual: r.is_virtual || '',
            amenities: r.amenities || '',
            description: r.description || '',
            availability_json: r.availability_json || '',
            notes: r.notes || '',
            min_booking_duration_minutes: r.min_booking_duration_minutes || '',
            max_booking_duration_minutes: r.max_booking_duration_minutes || '',
            buffer_minutes: r.buffer_minutes || '',
            advance_booking_days: r.advance_booking_days || '',
            cancellation_window_hours: r.cancellation_window_hours || '',
            cost_per_hour: r.cost_per_hour || '',
            max_concurrent_bookings: r.max_concurrent_bookings || '',
            blackout_dates: r.blackout_dates || '',
            is_wheelchair_accessible: r.is_wheelchair_accessible || '',
            subjects: r.subjects || '',
          }));
          const res = await fetch('/api/venues/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: mapped, program_id: selectedProgramId }),
          });
          if (!res.ok) {
            const { error } = await res.json();
            throw new Error(error || 'Import failed');
          }
          const result = await res.json();
          if (result.imported > 0) {
            fetchVenues();
            setToast({ message: `${result.imported} venue(s) imported`, type: 'success', id: Date.now() });
          }
          return result;
        }}
        exampleCsv={VENUE_CSV_EXAMPLE}
        templateFilename="venues.csv"
      />

      {/* ── Instructor CSV Import Dialog ──────────────────── */}
      <CsvImportDialog
        open={instructorImportOpen}
        onClose={() => setInstructorImportOpen(false)}
        title="Import Staff from CSV"
        columns={INSTRUCTOR_CSV_COLUMNS}
        validateRow={validateInstructorCsvRow}
        onImport={async (csvRows: CsvRow[]) => {
          const mapped = csvRows.map((r) => ({
            first_name: r.first_name || '',
            last_name: r.last_name || '',
            email: r.email || '',
            phone: r.phone || '',
            skills: r.skills || '',
            availability_json: r.availability_json || '',
            is_active: r.is_active || '',
            on_call: r.on_call || '',
            notes: r.notes || '',
          }));
          const res = await fetch('/api/instructors/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: mapped, program_id: selectedProgramId }),
          });
          if (!res.ok) {
            const { error } = await res.json();
            throw new Error(error || 'Import failed');
          }
          const result = await res.json();
          if (result.imported > 0) {
            fetchInstructors();
            setToast({ message: `${result.imported} staff member(s) imported`, type: 'success', id: Date.now() });
          }
          return result;
        }}
        exampleCsv={INSTRUCTOR_CSV_EXAMPLE}
        templateFilename="staff.csv"
      />

      {/* ── Toast notifications ───────────────────────────── */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
