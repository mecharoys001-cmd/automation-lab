'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Venue, VenueInsert, AvailabilityJson, DayOfWeek, TimeBlock } from '@/types/database';
import Tooltip from '../../components/Tooltip';

// ── Helpers ──────────────────────────────────────────────────

function availabilitySummary(avail: AvailabilityJson | null): string {
  if (!avail) return 'Not set';
  const DAY_ABBR: Record<DayOfWeek, string> = {
    monday: 'M', tuesday: 'Tu', wednesday: 'W', thursday: 'Th',
    friday: 'F', saturday: 'Sa', sunday: 'Su',
  };
  const days = (Object.keys(avail) as DayOfWeek[]).filter(
    (d) => avail[d] && avail[d]!.length > 0,
  );
  if (days.length === 0) return 'Not set';
  return days.map((d) => DAY_ABBR[d]).join(', ');
}

// ── Skeleton loader ──────────────────────────────────────────

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-48 rounded-lg bg-muted/30 animate-pulse" />
      ))}
    </div>
  );
}

// ── Availability grid constants ──────────────────────────────

const ALL_DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];

const GRID_HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM

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

// ── Editable availability grid ───────────────────────────────

function EditableAvailabilityGrid({
  availability,
  onChange,
}: {
  availability: AvailabilityJson | null;
  onChange: (avail: AvailabilityJson) => void;
}) {
  const avail = availability ?? {};

  function toggleHour(day: DayOfWeek, hour: number) {
    const blocks = avail[day] ?? [];
    const start = `${hour.toString().padStart(2, '0')}:00`;
    const end = `${(hour + 1).toString().padStart(2, '0')}:00`;

    if (isHourAvailable(hour, blocks)) {
      // Remove this hour: filter out blocks that cover it and split if needed
      const newBlocks: TimeBlock[] = [];
      for (const b of blocks) {
        const [bsh, bsm] = b.start.split(':').map(Number);
        const [beh, bem] = b.end.split(':').map(Number);
        const bs = bsh * 60 + bsm;
        const be = beh * 60 + bem;
        const slotStart = hour * 60;
        const slotEnd = (hour + 1) * 60;

        if (bs >= slotEnd || be <= slotStart) {
          // No overlap, keep as-is
          newBlocks.push(b);
        } else {
          // Split around the removed hour
          if (bs < slotStart) {
            newBlocks.push({ start: b.start, end: start });
          }
          if (be > slotEnd) {
            newBlocks.push({ start: end, end: b.end });
          }
        }
      }
      onChange({ ...avail, [day]: newBlocks });
    } else {
      // Add this hour, then merge adjacent blocks
      const allBlocks = [...blocks, { start, end }];
      // Sort by start time
      allBlocks.sort((a, b) => {
        const [ash] = a.start.split(':').map(Number);
        const [bsh] = b.start.split(':').map(Number);
        return ash - bsh;
      });
      // Merge adjacent/overlapping
      const merged: TimeBlock[] = [allBlocks[0]];
      for (let i = 1; i < allBlocks.length; i++) {
        const prev = merged[merged.length - 1];
        if (allBlocks[i].start <= prev.end) {
          prev.end = allBlocks[i].end > prev.end ? allBlocks[i].end : prev.end;
        } else {
          merged.push(allBlocks[i]);
        }
      }
      onChange({ ...avail, [day]: merged });
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        <div
          className="grid gap-px rounded-lg border border-border overflow-hidden"
          style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
        >
          {/* Header row */}
          <div className="bg-muted/50 p-1" />
          {ALL_DAYS.map((day) => (
            <div
              key={day.key}
              className="bg-muted/50 py-1.5 text-center text-xs font-medium text-muted-foreground"
            >
              {day.short}
            </div>
          ))}

          {/* Time rows */}
          {GRID_HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex items-center justify-end pr-1.5 text-[10px] text-muted-foreground bg-card h-6 border-t border-border">
                {formatHourLabel(hour)}
              </div>
              {ALL_DAYS.map((day) => {
                const blocks = avail[day.key] ?? [];
                const available = isHourAvailable(hour, blocks);
                return (
                  <Tooltip text={`Toggle ${day.short} ${formatHourLabel(hour)} availability`}>
                    <div
                      key={`${day.key}-${hour}`}
                      className={`h-6 border-t border-l border-border flex items-center justify-center cursor-pointer transition-colors ${
                        available ? 'bg-green-500/40 hover:bg-green-500/60' : 'bg-background hover:bg-muted/50'
                      }`}
                      onClick={() => toggleHour(day.key, hour)}
                    >
                      <span className={`text-[10px] leading-none font-medium ${available ? 'text-white' : 'text-muted-foreground'}`}>
                        {formatHourLabel(hour)}
                      </span>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Venue edit modal ─────────────────────────────────────────

type VenueFormData = Omit<VenueInsert, 'id' | 'created_at'>;

const EMPTY_FORM: VenueFormData = {
  name: '',
  space_type: '',
  max_capacity: null,
  availability_json: null,
  is_virtual: false,
  notes: null,
  min_booking_duration_minutes: null,
  max_booking_duration_minutes: null,
  buffer_minutes: null,
  advance_booking_days: null,
  cancellation_window_hours: null,
  address: null,
  amenities: [],
  cost_per_hour: null,
  max_concurrent_bookings: 1,
  blackout_dates: [],
  description: null,
};

function VenueModal({
  venue,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  venue: Venue | null; // null = creating new
  saving: boolean;
  deleting: boolean;
  onSave: (data: VenueFormData) => void;
  onDelete: (() => void) | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<VenueFormData>(EMPTY_FORM);
  const [amenitiesInput, setAmenitiesInput] = useState('');
  const [newBlackoutDate, setNewBlackoutDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (venue) {
      setForm({
        name: venue.name,
        space_type: venue.space_type,
        max_capacity: venue.max_capacity,
        availability_json: venue.availability_json,
        is_virtual: venue.is_virtual,
        notes: venue.notes,
        min_booking_duration_minutes: venue.min_booking_duration_minutes,
        max_booking_duration_minutes: venue.max_booking_duration_minutes,
        buffer_minutes: venue.buffer_minutes,
        advance_booking_days: venue.advance_booking_days,
        cancellation_window_hours: venue.cancellation_window_hours,
        address: venue.address,
        amenities: venue.amenities ?? [],
        cost_per_hour: venue.cost_per_hour,
        max_concurrent_bookings: venue.max_concurrent_bookings,
        blackout_dates: venue.blackout_dates ?? [],
        description: venue.description,
      });
      setAmenitiesInput((venue.amenities ?? []).join(', '));
    } else {
      setForm(EMPTY_FORM);
      setAmenitiesInput('');
    }
    setNewBlackoutDate('');
    setConfirmDelete(false);
  }, [venue]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Parse amenities from comma-separated input
    const amenities = amenitiesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({ ...form, amenities });
  }

  function setField<K extends keyof VenueFormData>(key: K, value: VenueFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addBlackoutDate() {
    if (!newBlackoutDate) return;
    const dates = form.blackout_dates ?? [];
    if (!dates.includes(newBlackoutDate)) {
      setField('blackout_dates', [...dates, newBlackoutDate].sort());
    }
    setNewBlackoutDate('');
  }

  function removeBlackoutDate(date: string) {
    setField('blackout_dates', (form.blackout_dates ?? []).filter((d) => d !== date));
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {venue ? 'Edit Venue' : 'New Venue'}
          </h2>
          <Tooltip text="Close dialog">
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Tooltip>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Basic Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Name *</label>
                <Tooltip text="Enter venue name" className="w-full">
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Space Type *</label>
                <Tooltip text="Enter space type (e.g., Classroom, Auditorium)" className="w-full">
                  <input
                    type="text"
                    required
                    value={form.space_type}
                    onChange={(e) => setField('space_type', e.target.value)}
                    placeholder="e.g., Classroom, Auditorium"
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Address</label>
              <Tooltip text="Enter venue address" className="w-full">
                <input
                  type="text"
                  value={form.address ?? ''}
                  onChange={(e) => setField('address', e.target.value || null)}
                  placeholder="123 Main St, City, State"
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Tooltip>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Tooltip text="Enter venue description" className="w-full">
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setField('description', e.target.value || null)}
                  rows={2}
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Tooltip text="Toggle virtual venue mode">
                <input
                  type="checkbox"
                  id="is_virtual"
                  checked={form.is_virtual}
                  onChange={(e) => setField('is_virtual', e.target.checked)}
                  className="rounded border-border"
                />
              </Tooltip>
              <label htmlFor="is_virtual" className="text-sm text-foreground">Virtual venue</label>
            </div>
          </div>

          {/* Capacity & Booking */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capacity &amp; Booking</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Max Capacity</label>
                <Tooltip text="Set maximum capacity" className="w-full">
                  <input
                    type="number"
                    min={0}
                    value={form.max_capacity ?? ''}
                    onChange={(e) => setField('max_capacity', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max Concurrent</label>
                <Tooltip text="Set max concurrent bookings" className="w-full">
                  <input
                    type="number"
                    min={1}
                    value={form.max_concurrent_bookings}
                    onChange={(e) => setField('max_concurrent_bookings', Number(e.target.value) || 1)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cost/Hour ($)</label>
                <Tooltip text="Set hourly cost rate" className="w-full">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.cost_per_hour ?? ''}
                    onChange={(e) => setField('cost_per_hour', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Min Duration (min)</label>
                <Tooltip text="Set minimum booking duration in minutes" className="w-full">
                  <input
                    type="number"
                    min={0}
                    value={form.min_booking_duration_minutes ?? ''}
                    onChange={(e) => setField('min_booking_duration_minutes', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max Duration (min)</label>
                <Tooltip text="Set maximum booking duration in minutes" className="w-full">
                  <input
                    type="number"
                    min={0}
                    value={form.max_booking_duration_minutes ?? ''}
                    onChange={(e) => setField('max_booking_duration_minutes', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Buffer (min)</label>
                <Tooltip text="Set buffer time between bookings" className="w-full">
                  <input
                    type="number"
                    min={0}
                    value={form.buffer_minutes ?? ''}
                    onChange={(e) => setField('buffer_minutes', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Advance Booking (days)</label>
                <Tooltip text="Set how far in advance bookings are allowed" className="w-full">
                  <input
                    type="number"
                    min={0}
                    value={form.advance_booking_days ?? ''}
                    onChange={(e) => setField('advance_booking_days', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cancel Window (hrs)</label>
                <Tooltip text="Set cancellation window in hours" className="w-full">
                  <input
                    type="number"
                    min={0}
                    value={form.cancellation_window_hours ?? ''}
                    onChange={(e) => setField('cancellation_window_hours', e.target.value ? Number(e.target.value) : null)}
                    className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amenities</h3>
            <Tooltip text="Enter amenities, comma-separated" className="w-full">
              <input
                type="text"
                value={amenitiesInput}
                onChange={(e) => setAmenitiesInput(e.target.value)}
                placeholder="Piano, Whiteboard, Projector (comma-separated)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Tooltip>
            {amenitiesInput && (
              <div className="flex flex-wrap gap-1.5">
                {amenitiesInput.split(',').map((s) => s.trim()).filter(Boolean).map((a) => (
                  <span key={a} className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Blackout Dates */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blackout Dates</h3>
            <div className="flex gap-2">
              <Tooltip text="Select a blackout date">
                <input
                  type="date"
                  value={newBlackoutDate}
                  onChange={(e) => setNewBlackoutDate(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Tooltip>
              <Tooltip text="Add blackout date">
                <button
                  type="button"
                  onClick={addBlackoutDate}
                  disabled={!newBlackoutDate}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </Tooltip>
            </div>
            {(form.blackout_dates ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(form.blackout_dates ?? []).map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400"
                  >
                    {d}
                    <Tooltip text="Remove blackout date">
                      <button
                        type="button"
                        onClick={() => removeBlackoutDate(d)}
                        className="hover:text-red-300 transition-colors"
                      >
                        &times;
                      </button>
                    </Tooltip>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Availability Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Availability
            </h3>
            <p className="text-xs text-muted-foreground">Click cells to toggle availability</p>
            <EditableAvailabilityGrid
              availability={form.availability_json}
              onChange={(avail) => setField('availability_json', avail)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h3>
            <Tooltip text="Add internal notes about this venue" className="w-full">
              <textarea
                value={form.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value || null)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </Tooltip>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              {onDelete && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Are you sure?</span>
                    <Tooltip text="Confirm venue deletion">
                      <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Cancel deletion">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip text="Delete this venue">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete Venue
                    </button>
                  </Tooltip>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip text="Discard changes">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip text={venue ? 'Save changes' : 'Create venue'}>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : venue ? 'Save Changes' : 'Create Venue'}
                </button>
              </Tooltip>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/venues');
      if (!res.ok) throw new Error('Failed to fetch');
      const { venues: data } = (await res.json()) as { venues: Venue[] };
      setVenues(data);
    } catch {
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  function openCreate() {
    setEditingVenue(null);
    setModalOpen(true);
  }

  function openEdit(venue: Venue) {
    setEditingVenue(venue);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingVenue(null);
  }

  async function handleSave(data: VenueFormData) {
    setSaving(true);
    try {
      if (editingVenue) {
        // PATCH
        const res = await fetch(`/api/venues/${editingVenue.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update');
        const { venue } = (await res.json()) as { venue: Venue };
        setVenues((prev) => prev.map((v) => (v.id === venue.id ? venue : v)));
      } else {
        // POST
        const res = await fetch('/api/venues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create');
        const { venue } = (await res.json()) as { venue: Venue };
        setVenues((prev) => [...prev, venue]);
      }
      closeModal();
    } catch {
      // Error handling could be improved with toast/notification
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingVenue) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/venues/${editingVenue.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setVenues((prev) => prev.filter((v) => v.id !== editingVenue.id));
      closeModal();
    } catch {
      // Error handling could be improved
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Venue Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage venue settings, availability, and booking parameters.
          </p>
        </div>
        <Tooltip text="Create a new venue">
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + New Venue
          </button>
        </Tooltip>
      </div>

      {/* Venue cards */}
      {loading ? (
        <CardGridSkeleton />
      ) : venues.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          No venues found. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <Tooltip key={venue.id} text="Click to edit venue">
            <div
              className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-muted-foreground/30 transition-colors cursor-pointer"
              onClick={() => openEdit(venue)}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{venue.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {venue.space_type}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0">
                  <span
                    className={`h-2 w-2 rounded-full ${venue.is_virtual ? 'bg-blue-400' : 'bg-green-400'}`}
                  />
                  {venue.is_virtual ? 'Virtual' : 'In-Person'}
                </span>
              </div>

              {/* Address */}
              {venue.address && (
                <p className="text-sm text-muted-foreground truncate">{venue.address}</p>
              )}

              {/* Capacity & Concurrent */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {venue.max_capacity != null && (
                  <div className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {venue.max_capacity}
                  </div>
                )}
                {venue.max_concurrent_bookings > 1 && (
                  <span className="text-xs">({venue.max_concurrent_bookings} concurrent)</span>
                )}
              </div>

              {/* Amenities */}
              {venue.amenities && venue.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {venue.amenities.map((a) => (
                    <span
                      key={a}
                      className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {/* Availability summary */}
              <div className="text-xs text-muted-foreground">
                Availability: {availabilitySummary(venue.availability_json)}
              </div>
            </div>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Count footer */}
      {!loading && venues.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {venues.length} venue{venues.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <VenueModal
          venue={editingVenue}
          saving={saving}
          deleting={deleting}
          onSave={handleSave}
          onDelete={editingVenue ? handleDelete : null}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
