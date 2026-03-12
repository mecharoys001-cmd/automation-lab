'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Loader2, AlertTriangle, X, Filter,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { TagSelector } from '../ui/TagSelector';
import type {
  Instructor, Venue, SchedulingMode,
} from '@/types/database';
import { skillsMatch } from '@/lib/scheduler/utils';

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
}

/* ── Helpers ────────────────────────────────────────────────── */

/** Convert "9:00 AM" → "09:00" */
function displayTimeTo24h(time12: string): string {
  if (!time12) return '09:00';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
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
}: TemplateFormModalProps) {
  const isEditing = !!initialData;

  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, [open, initialData, initialDate, initialTime, initialVenueId]);

  // Fetch reference data on open
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [instRes, venueRes] = await Promise.all([
        fetch(`/api/instructors?_t=${Date.now()}`),
        fetch(`/api/venues?_t=${Date.now()}`),
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
  }, [open]);

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
    return active.filter((inst) =>
      skillsMatch(inst.skills, form.required_skills.length > 0 ? form.required_skills : null)
    );
  }, [instructors, form.required_skills]);

  /* ── Submit ────────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (!programId) {
      setError('Select a program first');
      return;
    }
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
      ? (saving ? 'Creating...' : 'Create Template & Session')
      : (saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event Template')
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        style={{
          position: 'relative',
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          maxWidth: 600,
          width: '100%',
          margin: '0 16px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 28px 0 28px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Error banner */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* 1. Name */}
          <FormField label="Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="e.g., Weekly Strings K-2"
              autoFocus
              style={inputStyle}
            />
          </FormField>

          {/* 2. Subject */}
          <FormField label="Subject">
            <TagSelector
              value={form.required_skills}
              onChange={(skills) => {
                updateForm({ required_skills: skills });
                // Clear instructor if they don't match the new subject
                if (form.instructor_id && skills.length > 0) {
                  const inst = instructors.find((i) => i.id === form.instructor_id);
                  if (inst && !skillsMatch(inst.skills, skills)) {
                    updateForm({ required_skills: skills, instructor_id: '' });
                    return;
                  }
                }
              }}
              category="Subjects"
              placeholder="Select subject..."
            />
          </FormField>

          {/* 3. Staff */}
          <FormField label="Staff">
            <select
              value={form.instructor_id}
              onChange={(e) => updateForm({ instructor_id: e.target.value })}
              style={selectStyle}
            >
              <option value="">— None —</option>
              {filteredInstructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.first_name} {i.last_name}
                </option>
              ))}
            </select>
            {filteredInstructors.length === 0 && form.required_skills.length > 0 && (
              <span style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>
                <AlertTriangle className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                No staff teach {form.required_skills.join(', ')}.{' '}
                <a href="/tools/scheduler/admin/people" style={{ color: '#3B82F6', textDecoration: 'underline' }}>
                  Add on Staff &amp; Venues page
                </a>
              </span>
            )}
            {form.required_skills.length > 0 && filteredInstructors.length > 0 && (
              <span style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                <Filter className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                Filtered by subject: {form.required_skills.join(', ')}
              </span>
            )}
          </FormField>

          {/* 4. Venue */}
          <FormField label="Venue">
            <select
              value={form.venue_id}
              onChange={(e) => updateForm({ venue_id: e.target.value })}
              style={selectStyle}
            >
              <option value="">— None —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{(v as any).max_capacity ? ` (cap: ${(v as any).max_capacity})` : ''}
                </option>
              ))}
            </select>
          </FormField>

          {/* 5. Grade Group */}
          <FormField label="Grade Group">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GRADE_OPTIONS.map((g) => {
                const selected = form.grade_groups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleArrayField('grade_groups', g)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 500,
                      border: '1px solid',
                      borderColor: selected ? '#3B82F6' : '#E2E8F0',
                      backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                      color: selected ? '#2563EB' : '#64748B',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* 6. Scheduling Mode */}
          <FormField label="Scheduling Mode" hint="When classes are generated">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Ongoing */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduling_mode"
                  value="ongoing"
                  checked={form.scheduling_mode === 'ongoing'}
                  onChange={() => updateForm({ scheduling_mode: 'ongoing' })}
                  style={{ marginTop: 3, accentColor: '#3B82F6' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>Ongoing</span>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Runs for the entire program year</div>
                </div>
              </label>

              {/* Date Range */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduling_mode"
                  value="date_range"
                  checked={form.scheduling_mode === 'date_range'}
                  onChange={() => updateForm({ scheduling_mode: 'date_range' })}
                  style={{ marginTop: 3, accentColor: '#3B82F6' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>Date Range</span>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Runs between specific start and end dates</div>
                  {form.scheduling_mode === 'date_range' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>From</label>
                        <input
                          type="date"
                          value={form.starts_on}
                          onChange={(e) => updateForm({ starts_on: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>Until</label>
                        <input
                          type="date"
                          value={form.ends_on}
                          onChange={(e) => updateForm({ ends_on: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Duration */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduling_mode"
                  value="duration"
                  checked={form.scheduling_mode === 'duration'}
                  onChange={() => updateForm({ scheduling_mode: 'duration' })}
                  style={{ marginTop: 3, accentColor: '#3B82F6' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>Duration</span>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Starts on a date and runs for a set number of weeks</div>
                  {form.scheduling_mode === 'duration' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>Starts</label>
                        <input
                          type="date"
                          value={form.starts_on}
                          onChange={(e) => updateForm({ starts_on: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>Weeks</label>
                        <input
                          type="number"
                          min={1}
                          max={52}
                          value={form.duration_weeks ?? ''}
                          onChange={(e) => updateForm({ duration_weeks: e.target.value ? Number(e.target.value) : null })}
                          placeholder="e.g. 12"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Session Count */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="scheduling_mode"
                  value="session_count"
                  checked={form.scheduling_mode === 'session_count'}
                  onChange={() => updateForm({ scheduling_mode: 'session_count' })}
                  style={{ marginTop: 3, accentColor: '#3B82F6' }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>Class Count</span>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Create a fixed number of classes, optionally within a time window</div>
                  {form.scheduling_mode === 'session_count' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>Starts</label>
                        <input
                          type="date"
                          value={form.starts_on}
                          onChange={(e) => updateForm({ starts_on: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>Number of Classes</label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={form.session_count ?? ''}
                            onChange={(e) => updateForm({ session_count: e.target.value ? Number(e.target.value) : null })}
                            placeholder="e.g. 10"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 2 }}>Within X Weeks (optional)</label>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={form.within_weeks ?? ''}
                            onChange={(e) => updateForm({ within_weeks: e.target.value ? Number(e.target.value) : null })}
                            placeholder="No limit"
                            style={inputStyle}
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
          <FormField label="Class Duration">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {DURATION_PRESETS.map((mins) => {
                const selected = !form.duration_custom && form.duration_minutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => updateForm({ duration_minutes: mins, duration_custom: false })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      border: '1px solid',
                      borderColor: selected ? '#3B82F6' : '#E2E8F0',
                      backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                      color: selected ? '#2563EB' : '#64748B',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {mins} min
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => updateForm({ duration_custom: true })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: form.duration_custom ? '#3B82F6' : '#E2E8F0',
                  backgroundColor: form.duration_custom ? '#EFF6FF' : '#FFFFFF',
                  color: form.duration_custom ? '#2563EB' : '#64748B',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                Custom
              </button>
              {form.duration_custom && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={form.duration_minutes}
                    onChange={(e) => updateForm({ duration_minutes: Number(e.target.value) || 0 })}
                    style={{ ...inputStyle, width: 80 }}
                  />
                  <span style={{ fontSize: 13, color: '#64748B' }}>min</span>
                </div>
              )}
            </div>
          </FormField>

          {/* Sessions Per Week */}
          <FormField label="Sessions Per Week">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateForm({ sessions_per_week: n })}
                  style={{
                    height: 40,
                    width: 48,
                    borderRadius: 8,
                    border: `1px solid ${form.sessions_per_week === n ? '#3B82F6' : '#E2E8F0'}`,
                    background: form.sessions_per_week === n ? '#3B82F6' : '#fff',
                    color: form.sessions_per_week === n ? '#fff' : '#334155',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {n}×
                </button>
              ))}
              <span style={{ fontSize: 13, color: '#64748B', marginLeft: 4 }}>
                {form.sessions_per_week === 1 ? '(once a week)' : form.sessions_per_week === 5 ? '(daily)' : 'per week'}
              </span>
            </div>
          </FormField>

          {/* Repeats Every X Weeks */}
          <FormField label="Repeats Every X Weeks">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min={1}
                max={8}
                value={form.week_cycle_length ?? 1}
                onChange={(e) => {
                  const val = Number(e.target.value) || 1;
                  updateForm({
                    week_cycle_length: val <= 1 ? null : val,
                    week_in_cycle: val > 1 ? (form.week_in_cycle ?? 0) : null,
                  });
                }}
                style={{ ...inputStyle, width: 80 }}
              />
              <span style={{ fontSize: 13, color: '#64748B' }}>
                {(form.week_cycle_length ?? 1) <= 1 ? '(every week)' : 'weeks'}
              </span>
            </div>
            {form.week_cycle_length != null && form.week_cycle_length > 1 && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 4, display: 'block' }}>
                  Week in Cycle
                </label>
                <select
                  value={form.week_in_cycle ?? 0}
                  onChange={(e) => updateForm({ week_in_cycle: Number(e.target.value) })}
                  style={{ ...selectStyle, width: 140 }}
                >
                  {Array.from({ length: form.week_cycle_length }, (_, i) => (
                    <option key={i} value={i}>Week {i + 1}</option>
                  ))}
                </select>
              </div>
            )}
          </FormField>

          {/* Additional Tags */}
          <FormField label="Additional Tags">
            <TagSelector
              value={form.additional_tags}
              onChange={(tags) => updateForm({ additional_tags: tags })}
              placeholder="Select optional tags..."
            />
          </FormField>

          {/* Active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => updateForm({ is_active: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#3B82F6' }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>Active</span>
            </label>
          </div>

          {/* Session fields (only shown when creating from calendar) */}
          {showSessionFields && (
            <>
              <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 4, paddingTop: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Session Placement
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Session Date">
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Start Time">
                  <input
                    type="time"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>
            </>
          )}

        </div>{/* end scrollable form body */}

        {/* Actions */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 28px', borderTop: '1px solid #E2E8F0' }}>
          <Button variant="secondary" onClick={onClose} tooltip="Discard changes">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={saving}
            tooltip={isEditing ? 'Save template changes' : 'Create new template'}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {showSessionFields ? 'Creating...' : 'Saving...'}
              </>
            ) : buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared form components ─────────────────────────────────── */

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
        {hint && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, color: '#94A3B8' }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 40,
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  padding: '0 12px',
  fontSize: 14,
  color: '#0F172A',
  outline: 'none',
  width: '100%',
  fontFamily: 'Inter, sans-serif',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 0.5rem center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '1.25rem 1.25rem',
  paddingRight: '2rem',
  cursor: 'pointer',
};
