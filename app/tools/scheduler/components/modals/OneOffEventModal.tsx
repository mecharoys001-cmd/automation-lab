'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Plus, CalendarPlus, Pencil, Trash2, XCircle } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  skills: string[] | null;
}

interface Venue {
  id: string;
  name: string;
  space_type: string;
}

interface Tag {
  id: string;
  name: string;
  category?: string | null;
}

export type RecurrenceType = 'none' | 'weekly' | 'every_x_weeks' | 'for_x_sessions' | 'until_date';

export interface RecurrenceOptions {
  type: RecurrenceType;
  interval_weeks?: number;   // for 'every_x_weeks'
  session_count?: number;    // for 'for_x_sessions'
  until_date?: string;       // for 'until_date' (YYYY-MM-DD)
}

export interface OneOffEventFormData {
  name: string;
  subject_tag_id: string | null;
  instructor_id: string | null;
  venue_id: string | null;
  grade_groups: string[];
  date: string;
  start_time: string; // HH:MM (24h)
  duration_minutes: number;
  recurrence?: RecurrenceOptions;
  /** When instructor rotation is enabled, list of instructor IDs to rotate through */
  rotation_instructor_ids?: string[];
}

export interface InitialTemplate {
  id: string;
  name: string | null;
  required_skills: string[] | null;
  instructor_id: string | null;
  venue_id: string | null;
  grade_groups: string[];
  duration_minutes: number;
}

export interface EditEventData {
  id: string;
  title: string;
  date: string;
  time: string;          // "9:00 AM" display format
  endTime: string;       // "10:00 AM" display format
  instructor: string;    // display name
  instructorId?: string;
  venue?: string;
  venueId?: string;
  gradeGroups?: string[];
  subjects?: string[];
  subjectTagId?: string;
  tags?: string[];
  notes?: string;
  status?: string;
  templateId?: string;
}

interface OneOffEventModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: OneOffEventFormData) => Promise<void>;
  /** Pre-filled date in YYYY-MM-DD format */
  initialDate?: string;
  /** Pre-filled time in "9:00 AM" display format */
  initialTime?: string;
  programId: string | null;
  /** Pre-fill form from a template (e.g. dragged from sidebar) */
  initialTemplate?: InitialTemplate;
  /** When provided, modal is in edit mode and pre-fills from this event */
  editEvent?: EditEventData;
  /** Called when deleting an event in edit mode */
  onDelete?: (eventId: string, mode: 'single' | 'future') => void | Promise<void>;
  /** Called when cancelling an event in edit mode */
  onCancelEvent?: (eventId: string, mode: 'single' | 'future') => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADE_OPTIONS = [
  'Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "9:00 AM" → "09:00" */
function displayTimeTo24h(time12: string): string {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '09:00';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Calculate duration in minutes from two 24h time strings */
function calculateDuration(start24: string, end24: string): number {
  const [sH, sM] = start24.split(':').map(Number);
  const [eH, eM] = end24.split(':').map(Number);
  const diff = (eH * 60 + eM) - (sH * 60 + sM);
  return diff > 0 ? diff : 45; // fallback to 45 if invalid
}

export function OneOffEventModal({
  open,
  onClose,
  onSubmit,
  initialDate,
  initialTime,
  programId,
  initialTemplate,
  editEvent,
  onDelete,
  onCancelEvent,
}: OneOffEventModalProps) {
  const [name, setName] = useState('');
  const [subjectTagId, setSubjectTagId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [gradeGroups, setGradeGroups] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [saving, setSaving] = useState(false);

  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [intervalWeeks, setIntervalWeeks] = useState(2);
  const [sessionCount, setSessionCount] = useState(4);
  const [untilDate, setUntilDate] = useState('');

  // Instructor rotation state
  const [rotateInstructors, setRotateInstructors] = useState(false);
  const [rotationInstructorIds, setRotationInstructorIds] = useState<string[]>([]);

  // Reference data
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (editEvent) {
        // EDIT MODE: pre-fill from existing event
        setName(editEvent.title);
        setDate(editEvent.date);
        const start24 = editEvent.time ? displayTimeTo24h(editEvent.time) : '09:00';
        setStartTime(start24);

        // Calculate duration from start/end time
        if (editEvent.endTime) {
          const end24 = displayTimeTo24h(editEvent.endTime);
          setDurationMinutes(calculateDuration(start24, end24));
        } else {
          setDurationMinutes(45);
        }

        setSubjectTagId(editEvent.subjectTagId ?? '');
        setInstructorId(editEvent.instructorId ?? '');
        setVenueId(editEvent.venueId ?? '');
        setGradeGroups(editEvent.gradeGroups ?? []);
      } else if (initialTemplate) {
        setName(initialTemplate.name ?? '');
        setSubjectTagId('');
        setInstructorId(initialTemplate.instructor_id ?? '');
        setVenueId(initialTemplate.venue_id ?? '');
        setGradeGroups(initialTemplate.grade_groups ?? []);
        setDate(initialDate ?? '');
        setStartTime(initialTime ? displayTimeTo24h(initialTime) : '09:00');
        setDurationMinutes(initialTemplate.duration_minutes ?? 45);
      } else {
        setName('');
        setSubjectTagId('');
        setInstructorId('');
        setVenueId('');
        setGradeGroups([]);
        setDate(initialDate ?? '');
        setStartTime(initialTime ? displayTimeTo24h(initialTime) : '09:00');
        setDurationMinutes(45);
      }
      setRecurrenceType('none');
      setIntervalWeeks(2);
      setSessionCount(4);
      setUntilDate('');
      setRotateInstructors(false);
      setRotationInstructorIds([]);
      setSaving(false);
    }
  }, [open, editEvent, initialDate, initialTime, initialTemplate]);

  // Fetch reference data on mount
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      const [instrRes, venueRes, tagRes] = await Promise.all([
        fetch('/api/instructors?is_active=true'),
        fetch('/api/venues'),
        fetch('/api/tags'),
      ]);

      if (instrRes.ok) {
        const body = await instrRes.json();
        setInstructors(body.instructors ?? []);
      }
      if (venueRes.ok) {
        const body = await venueRes.json();
        setVenues(body.venues ?? []);
      }
      if (tagRes.ok) {
        const body = await tagRes.json();
        // Filter to subject tags only (category = 'Subjects' or no category)
        const allTags: Tag[] = body.tags ?? [];
        setTags(allTags);

        // Don't auto-select tags from template skills — user must explicitly choose
      }
    };

    load();
  }, [open, initialTemplate]);

  const toggleGrade = useCallback((grade: string) => {
    setGradeGroups((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const recurrence: RecurrenceOptions | undefined =
        recurrenceType === 'none'
          ? undefined
          : recurrenceType === 'weekly'
            ? { type: 'weekly' }
            : recurrenceType === 'every_x_weeks'
              ? { type: 'every_x_weeks', interval_weeks: intervalWeeks }
              : recurrenceType === 'for_x_sessions'
                ? { type: 'for_x_sessions', session_count: sessionCount }
                : { type: 'until_date', until_date: untilDate };

      await onSubmit({
        name: name.trim(),
        subject_tag_id: subjectTagId || null,
        instructor_id: rotateInstructors ? null : (instructorId || null),
        venue_id: venueId || null,
        grade_groups: gradeGroups,
        date,
        start_time: startTime,
        duration_minutes: durationMinutes,
        recurrence,
        rotation_instructor_ids: rotateInstructors && rotationInstructorIds.length >= 2
          ? rotationInstructorIds
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Filter subject tags (category = 'Subjects')
  const subjectTags = tags.filter(
    (t) => t.category?.toLowerCase() === 'subjects' || t.category?.toLowerCase() === 'subject',
  );
  // If no subject-category tags exist, show all tags as fallback
  const displayTags = subjectTags.length > 0 ? subjectTags : tags;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-[70] w-[520px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-[0_8px_32px_#00000033] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${editEvent ? 'bg-amber-50' : initialTemplate ? 'bg-emerald-50' : 'bg-blue-50'}`}>
              {editEvent ? (
                <Pencil className="w-5 h-5 text-amber-500" />
              ) : initialTemplate ? (
                <CalendarPlus className="w-5 h-5 text-emerald-500" />
              ) : (
                <Plus className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                {editEvent ? 'Edit Event' : initialTemplate ? 'Schedule Event' : 'Create One-Off Event'}
              </h3>
              {editEvent ? (
                <p className="text-[12px] text-slate-500">Update event details</p>
              ) : initialTemplate ? (
                <p className="text-[12px] text-slate-500">
                  {initialTemplate.name || initialTemplate.required_skills?.[0] || 'Event'} — {initialTemplate.duration_minutes ?? 45}m
                </p>
              ) : (
                <p className="text-[12px] text-slate-500">Assemblies, guest performances, make-up classes</p>
              )}
            </div>
          </div>
          <Tooltip text="Close">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </Tooltip>
        </div>

        {/* Divider */}
        <div className="mx-6 my-3 border-t border-slate-100 shrink-0" />

        {/* Form body */}
        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Event Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Event Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Assembly, Guest Artist Visit"
              autoFocus
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Subject Tag + Instructor row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject Tag</label>
              <select
                value={subjectTagId}
                onChange={(e) => setSubjectTagId(e.target.value)}
                className={`w-full h-10 rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer ${
                  subjectTagId ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'
                }`}
              >
                <option value="">— No tag —</option>
                {displayTags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {subjectTagId && (
                <p className="text-[11px] text-blue-600">
                  Tag will be applied to this event
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff</label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="">— None —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.first_name} {i.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Venue</label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="">— None —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.space_type})
                </option>
              ))}
            </select>
          </div>

          {/* Grade Groups */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Grade Groups</label>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_OPTIONS.map((g) => {
                const selected = gradeGroups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + Time + Duration row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration (min)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 0))}
                min={5}
                max={480}
                step={5}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Recurrence (hidden in edit mode — only applies to new events) */}
          {!editEvent && <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recurrence</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['none', 'One-time only'],
                ['weekly', 'Weekly'],
                ['every_x_weeks', 'Every X weeks'],
                ['for_x_sessions', 'For X sessions'],
                ['until_date', 'Until date'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRecurrenceType(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    recurrenceType === value
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Conditional fields */}
            {recurrenceType === 'every_x_weeks' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Every</span>
                <input
                  type="number"
                  value={intervalWeeks}
                  onChange={(e) => setIntervalWeeks(Math.max(2, parseInt(e.target.value) || 2))}
                  min={2}
                  max={52}
                  className="w-16 h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-500">weeks</span>
              </div>
            )}

            {recurrenceType === 'for_x_sessions' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Repeat for</span>
                <input
                  type="number"
                  value={sessionCount}
                  onChange={(e) => setSessionCount(Math.max(2, parseInt(e.target.value) || 2))}
                  min={2}
                  max={52}
                  className="w-16 h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-500">total sessions</span>
              </div>
            )}

            {recurrenceType === 'until_date' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Repeat until</span>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  min={date}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            {recurrenceType !== 'none' && (
              <p className="text-[11px] text-slate-400">
                Blackout days will be skipped automatically. Sessions won&apos;t be created outside the program date range.
              </p>
            )}

            {/* Instructor Rotation */}
            {recurrenceType !== 'none' && (
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rotateInstructors}
                    onChange={(e) => {
                      setRotateInstructors(e.target.checked);
                      if (!e.target.checked) setRotationInstructorIds([]);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600">Rotate Instructors</span>
                </label>

                {rotateInstructors && (
                  <div className="space-y-1.5 pl-6">
                    <p className="text-[11px] text-slate-400">
                      Select 2+ staff to rotate through recurring sessions (A, B, A, B, ...).
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {instructors.map((instr) => {
                        const selected = rotationInstructorIds.includes(instr.id);
                        return (
                          <button
                            key={instr.id}
                            type="button"
                            onClick={() =>
                              setRotationInstructorIds((prev) =>
                                selected
                                  ? prev.filter((id) => id !== instr.id)
                                  : [...prev, instr.id],
                              )
                            }
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              selected
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {instr.first_name} {instr.last_name}
                          </button>
                        );
                      })}
                    </div>
                    {rotateInstructors && rotationInstructorIds.length >= 2 && (
                      <p className="text-[11px] text-slate-500">
                        Rotation order: {rotationInstructorIds.map((id) => {
                          const i = instructors.find((x) => x.id === id);
                          return i ? `${i.first_name} ${i.last_name[0]}.` : '?';
                        }).join(' → ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>}
        </div>

        {/* Divider */}
        <div className="mx-6 my-1 border-t border-slate-100 shrink-0" />

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-6 pt-3 shrink-0">
          {/* Delete / Cancel Event — left side (edit mode only) */}
          {editEvent ? (
            <div className="flex gap-2">
              {onDelete && (
                <Tooltip text="Delete this event">
                  <button
                    onClick={() => onDelete(editEvent.id, 'single')}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </Tooltip>
              )}
              {onCancelEvent && (
                <Tooltip text="Mark this event as cancelled">
                  <button
                    onClick={() => onCancelEvent(editEvent.id, 'single')}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancel Event
                  </button>
                </Tooltip>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* Cancel / Save — right side */}
          <div className="flex items-center gap-3">
            <Tooltip text="Cancel and close">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </Tooltip>

            <Tooltip text={name.trim() ? (editEvent ? 'Save changes' : recurrenceType !== 'none' ? 'Create recurring sessions' : 'Create this one-off session') : 'Event name is required'}>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !date || saving || (recurrenceType === 'until_date' && !untilDate)}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : editEvent ? null : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {saving
                  ? (editEvent ? 'Saving...' : 'Creating...')
                  : editEvent
                    ? 'Save Changes'
                    : recurrenceType !== 'none' ? 'Create Sessions' : 'Create Event'}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
// Deployment timestamp: Thu Mar 12 21:31:55 EDT 2026
