'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Loader2, AlertTriangle, Filter,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { TagSelector } from '../ui/TagSelector';
import { Modal, ModalButton } from '../ui/Modal';
import type {
  Instructor, Venue, SchedulingMode,
} from '@/types/database';
import { skillsMatch, availabilityCoversWindow, toTimeWindow, parseDate } from '@/lib/scheduler/utils';

/* ── Constants ──────────────────────────────────────────────── */

const GRADE_OPTIONS = [
  'Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
];

const DURATION_PRESETS = [30, 45, 60, 90];

/* ── Form state ─────────────────────────────────────────────── */

export interface TemplateFormData {
  name: string;
  required_skills: string[];
  instructor_id: string;
  venue_id: string;
  grade_groups: string[];
  duration_minutes: number;
  duration_custom: boolean;
  week_cycle_length: number | null;
  week_in_cycle: number | null;
  additional_tags: string[];
  is_active: boolean;
  scheduling_mode: SchedulingMode;
  starts_on: string;
  ends_on: string;
  duration_weeks: number | null;
  session_count: number | null;
  within_weeks: number | null;
  sessions_per_week: number;
}

const EMPTY_FORM: TemplateFormData = {
  name: '',
  required_skills: [],
  instructor_id: '',
  venue_id: '',
  grade_groups: [],
  duration_minutes: 60,
  duration_custom: false,
  week_cycle_length: null,
  week_in_cycle: null,
  additional_tags: [],
  is_active: true,
  scheduling_mode: 'ongoing',
  starts_on: '',
  ends_on: '',
  duration_weeks: null,
  session_count: null,
  within_weeks: null,
  sessions_per_week: 1,
};

/* ── Props ──────────────────────────────────────────────────── */

export interface TemplateFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with form data when user clicks Save/Create. The consumer handles the API call. */
  onSave: (data: TemplateFormData) => Promise<void>;
  /** Pre-populate the form for editing an existing template */
  initialData?: Partial<TemplateFormData>;
  /** Title override – defaults to "New Event Template" / "Edit Event Template" */
  title?: string;
  /** Submit button label override */
  submitLabel?: string;
  programId: string | null;
  /** When used from the calendar: show date/time fields */
  initialDate?: string;
  initialTime?: string;
  initialVenueId?: string;
  /** Show session date/time fields (for calendar usage) */
  showSessionFields?: boolean;
  /** Session ID being edited — used to exclude self from venue conflict checks */
  editingSessionId?: string;
}

/* ── Helpers ────────────────────────────────────────────────── */

/** Convert "9:00 AM" → "09:00" */
function displayTimeTo24h(time12: string): string {
  if (!time12) return '09:00';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  // Handle HH:mm:ss format
  if (/^\d{2}:\d{2}:\d{2}$/.test(time12)) return time12.slice(0, 5);
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '09:00';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

/* ── Component ──────────────────────────────────────────────── */

export function TemplateFormModal({
  open,
  onClose,
  onSave,
  initialData,
  title,
  submitLabel,
  programId,
  initialDate,
  initialTime,
  initialVenueId,
  showSessionFields = false,
  editingSessionId,
}: TemplateFormModalProps) {
  const isEditing = !!initialData;

  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Session fields (only used when showSessionFields is true)
  const [sessionDate, setSessionDate] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState('09:00');

  // Reference data
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        const dur = initialData.duration_minutes ?? 60;
        setForm({
          ...EMPTY_FORM,
          ...initialData,
          duration_custom: initialData.duration_custom ?? !DURATION_PRESETS.includes(dur),
          duration_minutes: dur,
        });
      } else {
        setForm({
          ...EMPTY_FORM,
          venue_id: initialVenueId ?? '',
        });
      }
      setSessionDate(initialDate ?? '');
      setSessionStartTime(initialTime ? displayTimeTo24h(initialTime) : '09:00');
      setSaving(false);
      setError(null);
      setNameError(null);
    }
  }, [open, initialData, initialDate, initialTime, initialVenueId]);

  // Fetch reference data on open
  useEffect(() => {
    if (!open || !programId) return;
    const load = async () => {
      const [instRes, venueRes] = await Promise.all([
        fetch(`/api/instructors?program_id=${programId}&_t=${Date.now()}`),
        fetch(`/api/venues?program_id=${programId}&_t=${Date.now()}`),
      ]);
      if (instRes.ok) {
        const d = await instRes.json();
        setInstructors(d.instructors ?? d ?? []);
      }
      if (venueRes.ok) {
        const d = await venueRes.json();
        setVenues(d.venues ?? d ?? []);
      }
    };
    load();
  }, [open, programId]);

  /* ── Form helpers ───────────────────────────────────────── */

  const updateForm = (patch: Partial<TemplateFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const toggleArrayField = (field: 'grade_groups' | 'required_skills', value: string) => {
    setForm((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  /* ── Constraint-based filtering ────────────────────────── */

  const filteredInstructors = useMemo(() => {
    const active = instructors.filter((i) => i.is_active);
    const skillFiltered = active.filter((inst) =>
      skillsMatch(inst.skills, form.required_skills.length > 0 ? form.required_skills : null)
    );

    // When editing a session with a known date/time, also filter by availability
    if (showSessionFields && sessionDate && sessionStartTime) {
      const date = parseDate(sessionDate);
      const dayOfWeek = date.getDay();
      const endMinutes =
        (parseInt(sessionStartTime.split(':')[0], 10) * 60 +
          parseInt(sessionStartTime.split(':')[1], 10)) +
        form.duration_minutes;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      const sessionWindow = toTimeWindow(sessionStartTime, endTime);

      return skillFiltered.filter((inst) =>
        availabilityCoversWindow(inst.availability_json, dayOfWeek, sessionWindow)
      );
    }

    return skillFiltered;
  }, [instructors, form.required_skills, showSessionFields, sessionDate, sessionStartTime, form.duration_minutes]);

  /* ── Venue conflict checking (session fields only) ───── */

  const [venueConflict, setVenueConflict] = useState<string | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  useEffect(() => {
    if (!open || !showSessionFields || !form.venue_id || !sessionDate || !sessionStartTime || form.duration_minutes <= 0) {
      setVenueConflict(null);
      return;
    }

    const [sH, sM] = sessionStartTime.split(':').map(Number);
    const endMinutes = sH * 60 + sM + form.duration_minutes;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCheckingConflict(true);
      try {
        const params = new URLSearchParams({
          venue_id: form.venue_id,
          date: sessionDate,
          start_time: sessionStartTime,
          end_time: endTime,
        });
        if (editingSessionId) params.set('exclude_id', editingSessionId);
        const res = await fetch(`/api/sessions/check-conflict?${params}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.conflict) {
            setVenueConflict(
              `Venue conflict: ${data.venue_name} is already booked from ${data.conflicting_session.start_time} to ${data.conflicting_session.end_time} (${data.conflicting_session.name})`
            );
          } else {
            setVenueConflict(null);
          }
        }
      } catch {
        // Ignore abort errors
      } finally {
        setCheckingConflict(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, showSessionFields, form.venue_id, sessionDate, sessionStartTime, form.duration_minutes, editingSessionId]);

  /* ── Submit ────────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (!programId) {
      setError('Select a program first');
      return;
    }
    if (!form.name.trim()) {
      setNameError('Name is required');
      setError('Name is required');
      nameInputRef.current?.focus();
      return;
    }
    // venue_id is optional — the generator can auto-assign based on availability
    if (form.duration_minutes <= 0) {
      setError('Duration must be greater than 0');
      return;
    }
    if (showSessionFields && !sessionDate) {
      setError('Session date is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Build the data to pass to the consumer
      const dataToSave: TemplateFormData & { sessionDate?: string; sessionStartTime?: string } = {
        ...form,
      };
      if (showSessionFields) {
        (dataToSave as any).sessionDate = sessionDate;
        (dataToSave as any).sessionStartTime = sessionStartTime;
      }
      await onSave(dataToSave);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const modalTitle = title ?? (isEditing ? 'Edit Event Template' : 'New Event Template');
  const buttonLabel = submitLabel ?? (
    showSessionFields
      ? (saving ? 'Creating...' : 'Create Event')
      : (saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Template')
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      width="600px"
      warnings={[
        ...(filteredInstructors.length === 0 && (form.required_skills.length > 0 || (showSessionFields && sessionDate))
          ? [{ id: 'staff', label: 'Staff Availability', message: `No staff available${form.required_skills.length > 0 ? ` for ${form.required_skills.join(', ')}` : ''}${showSessionFields && sessionDate ? ' at this date/time' : ''}` }]
          : []),
        ...(venueConflict
          ? [{ id: 'venue', label: 'Venue Conflict', message: venueConflict }]
          : []),
      ]}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton
            variant="primary"
            onClick={handleSubmit}
            disabled={saving || !!venueConflict}
            loading={saving}
          >
            {saving ? (showSessionFields ? 'Creating...' : 'Saving...') : buttonLabel}
          </ModalButton>
        </>
      }
    >
      <div className="p-6 space-y-5">

        {/* Error banner */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* 1. Name */}
        <FormField label="Name" required error={nameError} htmlFor="template-name">
          <input
            ref={nameInputRef}
            type="text"
            id="template-name"
            aria-required="true"
            value={form.name}
            onChange={(e) => {
              updateForm({ name: e.target.value });
              if (nameError) setNameError(null);
              if (error === 'Name is required') setError(null);
            }}
            placeholder="e.g., Weekly Strings K-2"
            autoFocus
            className={`w-full h-10 rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition-colors ${
              nameError
                ? 'border-red-400 focus-visible:border-red-400 focus-visible:ring-1 focus:ring-red-400'
                : 'border-slate-200 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500'
            }`}
          />
        </FormField>

        {/* 2. Event Type */}
        <FormField label="Event Type">
          <TagSelector
            value={form.required_skills}
            programId={programId ?? ''}
            onChange={(skills) => {
              updateForm({ required_skills: skills });
              // Clear instructor if they don't match the new event type
              if (form.instructor_id && skills.length > 0) {
                const inst = instructors.find((i) => i.id === form.instructor_id);
                if (inst && !skillsMatch(inst.skills, skills)) {
                  updateForm({ required_skills: skills, instructor_id: '' });
                  return;
                }
              }
            }}
            category="Event Type"
            placeholder="Select event type..."
          />
        </FormField>

        {/* 3. Staff */}
        <FormField label="Staff" htmlFor="template-staff">
          <select
            id="template-staff"
            value={form.instructor_id}
            onChange={(e) => updateForm({ instructor_id: e.target.value })}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 cursor-pointer transition-colors appearance-none"
          >
            <option value="">— None —</option>
            {filteredInstructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.first_name} {i.last_name}
              </option>
            ))}
          </select>
          {filteredInstructors.length === 0 && (form.required_skills.length > 0 || (showSessionFields && sessionDate)) && (
            <span className="text-[11px] text-red-500 mt-0.5 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3 inline align-middle" />
              No staff available{form.required_skills.length > 0 ? ` for ${form.required_skills.join(', ')}` : ''}{showSessionFields && sessionDate ? ' at this date/time' : ''}.{' '}
              <a href="/tools/scheduler/admin/people" className="text-blue-500 underline">
                Add on Staff &amp; Venues page
              </a>
            </span>
          )}
          {filteredInstructors.length > 0 && (form.required_skills.length > 0 || (showSessionFields && sessionDate)) && (
            <span className="text-[11px] text-slate-500 mt-0.5 inline-flex items-center gap-0.5">
              <Filter className="w-3 h-3 inline align-middle" />
              Filtered by{form.required_skills.length > 0 ? ` event type: ${form.required_skills.join(', ')}` : ''}{form.required_skills.length > 0 && showSessionFields && sessionDate ? ' &' : ''}{showSessionFields && sessionDate ? ' availability' : ''}
            </span>
          )}
        </FormField>

        {/* 4. Venue */}
        <FormField label="Venue" hint="Leave empty to auto-assign based on availability" htmlFor="template-venue">
          <select
            id="template-venue"
            value={form.venue_id}
            onChange={(e) => updateForm({ venue_id: e.target.value })}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 cursor-pointer transition-colors appearance-none"
          >
            <option value="">— Auto-assign —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{(v as any).max_capacity ? ` (cap: ${(v as any).max_capacity})` : ''}
              </option>
            ))}
          </select>
          {venueConflict && (
            <span className="text-[11px] text-red-600 mt-0.5 inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 inline align-middle" />
              {venueConflict}
            </span>
          )}
          {checkingConflict && (
            <span className="text-[11px] text-slate-400 mt-0.5">Checking availability...</span>
          )}
        </FormField>

        {/* 5. Grade Group */}
        <FormField label="Grade Group">
          <div className="flex flex-wrap gap-1.5">
            {GRADE_OPTIONS.map((g) => {
              const selected = form.grade_groups.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleArrayField('grade_groups', g)}
                  className={`px-3 py-1 rounded-full text-[13px] font-medium border transition-all cursor-pointer ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </FormField>

        {/* 6. Scheduling Mode */}
        <FormField label="Scheduling Mode" hint="When events are generated">
          <div className="flex flex-col gap-2.5">
            {/* Ongoing */}
            <label className={`flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${(form.week_cycle_length ?? 1) === 1 && form.scheduling_mode === 'ongoing' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                name="scheduling_mode"
                value="ongoing"
                checked={form.scheduling_mode === 'ongoing'}
                onChange={() => updateForm({ scheduling_mode: 'ongoing' })}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700">Ongoing</span>
                <div className="text-xs text-slate-400 mt-0.5">Runs for the entire program year</div>
              </div>
            </label>

            {/* Date Range */}
            <label className={`flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${form.scheduling_mode === 'date_range' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                name="scheduling_mode"
                value="date_range"
                checked={form.scheduling_mode === 'date_range'}
                onChange={() => updateForm({ scheduling_mode: 'date_range' })}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700">Date Range</span>
                <div className="text-xs text-slate-400 mt-0.5">Runs between specific start and end dates</div>
                {form.scheduling_mode === 'date_range' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">From</label>
                      <input
                        type="date"
                        value={form.starts_on}
                        onChange={(e) => updateForm({ starts_on: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Until</label>
                      <input
                        type="date"
                        value={form.ends_on}
                        onChange={(e) => updateForm({ ends_on: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* Duration */}
            <label className={`flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${form.scheduling_mode === 'duration' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                name="scheduling_mode"
                value="duration"
                checked={form.scheduling_mode === 'duration'}
                onChange={() => updateForm({ scheduling_mode: 'duration' })}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700">Duration</span>
                <div className="text-xs text-slate-400 mt-0.5">Starts on a date and runs for a set number of weeks</div>
                {form.scheduling_mode === 'duration' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Starts</label>
                      <input
                        type="date"
                        value={form.starts_on}
                        onChange={(e) => updateForm({ starts_on: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Weeks</label>
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={form.duration_weeks ?? ''}
                        onChange={(e) => updateForm({ duration_weeks: e.target.value ? Number(e.target.value) : null })}
                        placeholder="e.g. 12"
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* Session Count */}
            <label className={`flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${form.scheduling_mode === 'session_count' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                name="scheduling_mode"
                value="session_count"
                checked={form.scheduling_mode === 'session_count'}
                onChange={() => updateForm({ scheduling_mode: 'session_count' })}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-700">Session Count</span>
                <div className="text-xs text-slate-400 mt-0.5">Create a fixed number of sessions, optionally within a time window</div>
                {form.scheduling_mode === 'session_count' && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Starts</label>
                      <input
                        type="date"
                        value={form.starts_on}
                        onChange={(e) => updateForm({ starts_on: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Number of Sessions</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={form.session_count ?? ''}
                          onChange={(e) => updateForm({ session_count: e.target.value ? Number(e.target.value) : null })}
                          placeholder="e.g. 10"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Within X Weeks (optional)</label>
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={form.within_weeks ?? ''}
                          onChange={(e) => updateForm({ within_weeks: e.target.value ? Number(e.target.value) : null })}
                          placeholder="No limit"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </FormField>

        {/* 7. Session Duration */}
        <FormField label="Event Duration">
          <div className="flex gap-1.5 flex-wrap items-center">
            {DURATION_PRESETS.map((mins) => {
              const selected = !form.duration_custom && form.duration_minutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => updateForm({ duration_minutes: mins, duration_custom: false })}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {mins} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => updateForm({ duration_custom: true })}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                form.duration_custom
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Custom
            </button>
            {form.duration_custom && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={form.duration_minutes}
                  onChange={(e) => updateForm({ duration_minutes: Number(e.target.value) || 0 })}
                  className="w-20 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                />
                <span className="text-[13px] text-slate-500">min</span>
              </div>
            )}
          </div>
        </FormField>

        {/* Sessions Per Week */}
        <FormField label="Sessions Per Week">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateForm({ sessions_per_week: n })}
                className={`h-10 w-12 rounded-lg text-[13px] font-semibold border transition-all cursor-pointer ${
                  form.sessions_per_week === n
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {n}×
              </button>
            ))}
            <span className="text-[13px] text-slate-500 ml-1">
              {form.sessions_per_week === 1 ? '(once a week)' : form.sessions_per_week === 5 ? '(daily)' : 'per week'}
            </span>
          </div>
        </FormField>

        {/* Schedule Pattern */}
        <FormField label="Schedule Pattern">
          <div className="flex flex-col gap-2">
            {/* Radio options */}
            <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${(form.week_cycle_length ?? 1) === 1 ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                checked={(form.week_cycle_length ?? 1) === 1}
                onChange={() => updateForm({ week_cycle_length: null, week_in_cycle: null })}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-[13px] font-medium text-slate-900">Every week</span>
              <span className="text-xs text-slate-500 ml-auto">(runs weekly)</span>
            </label>

            <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${form.week_cycle_length === 2 ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                checked={form.week_cycle_length === 2}
                onChange={() => updateForm({ week_cycle_length: 2, week_in_cycle: form.week_in_cycle ?? 0 })}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-[13px] font-medium text-slate-900">Alternating weeks</span>
              <span className="text-xs text-slate-500 ml-auto">(Week A / Week B)</span>
            </label>

            <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${form.week_cycle_length === 3 ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                checked={form.week_cycle_length === 3}
                onChange={() => updateForm({ week_cycle_length: 3, week_in_cycle: form.week_in_cycle ?? 0 })}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-[13px] font-medium text-slate-900">Every 3 weeks</span>
              <span className="text-xs text-slate-500 ml-auto">(Week A / Week B / Week C)</span>
            </label>

            <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${(form.week_cycle_length ?? 1) > 3 ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'}`}>
              <input
                type="radio"
                checked={(form.week_cycle_length ?? 1) > 3}
                onChange={() => updateForm({ week_cycle_length: 4, week_in_cycle: form.week_in_cycle ?? 0 })}
                className="cursor-pointer accent-blue-500"
              />
              <span className="text-[13px] font-medium text-slate-900">Custom rotation:</span>
              <input
                type="number"
                min={4}
                max={8}
                value={(form.week_cycle_length ?? 1) > 3 ? (form.week_cycle_length ?? 4) : 4}
                onChange={(e) => {
                  const val = Math.max(4, Number(e.target.value) || 4);
                  updateForm({ week_cycle_length: val, week_in_cycle: form.week_in_cycle ?? 0 });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if ((form.week_cycle_length ?? 1) <= 3) {
                    updateForm({ week_cycle_length: 4, week_in_cycle: 0 });
                  }
                }}
                className="w-16 h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
              />
              <span className="text-xs text-slate-500">weeks</span>
            </label>

            {/* Week in cycle selector (shown when > 1 week) */}
            {form.week_cycle_length != null && form.week_cycle_length > 1 && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                <label className="text-xs font-semibold text-slate-900 mb-2 block">
                  This template runs in:
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: form.week_cycle_length }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateForm({ week_in_cycle: i })}
                      className={`px-4 py-1.5 rounded-full text-[13px] font-medium border transition-all cursor-pointer ${
                        (form.week_in_cycle ?? 0) === i
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Week {String.fromCharCode(65 + i)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Tip: Use alternating weeks for schedules that rotate. For example, if Grade 3 Piano runs in Week A and Grade 4 Piano runs in Week B, create both templates and assign them to different weeks.
                </p>
              </div>
            )}
          </div>
        </FormField>

        {/* Additional Tags */}
        <FormField label="Additional Tags">
          <TagSelector
            value={form.additional_tags}
            onChange={(tags) => updateForm({ additional_tags: tags })}
            programId={programId ?? ''}
            excludeCategories={['Space Types']}
            placeholder="Select optional tags..."
          />
        </FormField>

        {/* Active toggle */}
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => updateForm({ is_active: e.target.checked })}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
        </div>

        {/* Session fields (only shown when creating from calendar) */}
        {showSessionFields && (
          <>
            <div className="border-t border-slate-200 mt-1 pt-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Session Placement
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Session Date">
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                />
              </FormField>
              <FormField label="Start Time">
                <input
                  type="time"
                  value={sessionStartTime}
                  onChange={(e) => setSessionStartTime(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                />
              </FormField>
            </div>
          </>
        )}

      </div>

    </Modal>
  );
}

/* ── Shared form components ─────────────────────────────────── */

function FormField({ label, hint, required, error, children, htmlFor }: { label: string; hint?: string; required?: boolean; error?: string | null; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="font-normal normal-case ml-1.5 text-slate-400">{hint}</span>}
      </label>
      {children}
      {error && (
        <span className="text-xs text-red-500 font-medium">{error}</span>
      )}
    </div>
  );
}
