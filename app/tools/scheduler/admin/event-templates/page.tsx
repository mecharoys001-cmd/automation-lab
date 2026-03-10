'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Loader2, Check, AlertTriangle, X, Filter, Upload,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TagSelector } from '../../components/ui/TagSelector';
import { SubjectDashboard } from '../../components/ui/SubjectDashboard';
import { CsvImportDialog, type CsvColumnDef, type ValidationError } from '../../components/ui/CsvImportDialog';
import type { CsvRow } from '@/lib/csvDedup';
import { TemplateList } from '../../components/templates/TemplateList';
import type { TemplateListItem } from '../../components/templates/TemplateList';
import { useProgram } from '../ProgramContext';
import type {
  SessionTemplate, Instructor, Venue,
  TemplateType, RotationMode, DayOfWeek, TimeBlock,
  AvailabilityJson,
} from '@/types/database';
import { skillsMatch } from '@/lib/scheduler/utils';

/* ── Constants ──────────────────────────────────────────────── */

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TEMPLATE_TYPES: { value: TemplateType; label: string; desc: string }[] = [
  { value: 'fully_defined', label: 'Fully Defined', desc: 'All fields specified' },
  { value: 'tagged_slot', label: 'Tagged Slot', desc: 'Staff assigned by tag' },
  { value: 'auto_assign', label: 'Auto Assign', desc: 'System picks staff' },
  { value: 'time_block', label: 'Time Block', desc: 'Reserved time only' },
];

const ROTATION_MODES: { value: RotationMode; label: string }[] = [
  { value: 'consistent', label: 'Consistent' },
  { value: 'rotate', label: 'Rotate' },
];

const GRADE_OPTIONS = [
  'Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
];

/* ── CSV Import config ─────────────────────────────────────── */

const TEMPLATE_CSV_COLUMNS: CsvColumnDef[] = [
  { csvHeader: 'name', label: 'Name' },
  { csvHeader: 'day', label: 'Day', required: true },
  { csvHeader: 'start_time', label: 'Start Time', required: true },
  { csvHeader: 'end_time', label: 'End Time', required: true },
  { csvHeader: 'venue', label: 'Venue' },
  { csvHeader: 'instructor', label: 'Staff' },
  { csvHeader: 'subjects', label: 'Subjects' },
  { csvHeader: 'grades', label: 'Grades' },
];

const VALID_DAYS = new Set([
  'sunday', 'sun', 'monday', 'mon', 'tuesday', 'tue',
  'wednesday', 'wed', 'thursday', 'thu', 'friday', 'fri',
  'saturday', 'sat', '0', '1', '2', '3', '4', '5', '6',
]);

function validateTemplateCsvRow(row: CsvRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!row.day?.trim()) {
    errors.push({ row: rowIndex, column: 'day', message: 'Day is required' });
  } else if (!VALID_DAYS.has(row.day.toLowerCase().trim())) {
    errors.push({ row: rowIndex, column: 'day', message: 'Invalid day (use Mon-Sun or 0-6)' });
  }
  if (!row.start_time?.trim()) {
    errors.push({ row: rowIndex, column: 'start_time', message: 'Required' });
  } else if (!/^\d{1,2}:\d{2}$/.test(row.start_time.trim())) {
    errors.push({ row: rowIndex, column: 'start_time', message: 'Use HH:MM format' });
  }
  if (!row.end_time?.trim()) {
    errors.push({ row: rowIndex, column: 'end_time', message: 'Required' });
  } else if (!/^\d{1,2}:\d{2}$/.test(row.end_time.trim())) {
    errors.push({ row: rowIndex, column: 'end_time', message: 'Use HH:MM format' });
  }
  if (row.start_time && row.end_time && /^\d{1,2}:\d{2}$/.test(row.start_time) && /^\d{1,2}:\d{2}$/.test(row.end_time)) {
    const [sh, sm] = row.start_time.split(':').map(Number);
    const [eh, em] = row.end_time.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      errors.push({ row: rowIndex, column: 'end_time', message: 'Must be after start time' });
    }
  }
  return errors;
}

const TEMPLATE_CSV_EXAMPLE = `name,day,start_time,end_time,venue,instructor,subjects,grades
Piano Lab,Monday,09:00,10:00,Classroom 101,John Smith,Piano,3rd;4th
Strings,Tuesday,10:00,11:30,Stage,Jane Doe,Strings,5th;6th
Choir,Wednesday,13:00,14:00,Cafe,,Choral,K;1st;2nd`;

/* ── Toast ──────────────────────────────────────────────────── */

interface ToastState { message: string; type: 'success' | 'error'; id: number }

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

/* ── Form state ─────────────────────────────────────────────── */

interface TemplateForm {
  template_type: TemplateType;
  rotation_mode: RotationMode;
  day_of_week: number;
  grade_groups: string[];
  start_time: string;
  end_time: string;
  instructor_id: string;
  venue_id: string;
  required_skills: string[];
  is_active: boolean;
  week_cycle_length: number | null;
  week_in_cycle: number | null;
  no_set_day: boolean;
  no_set_time: boolean;
  no_set_instructor: boolean;
  no_set_venue: boolean;
}

const EMPTY_FORM: TemplateForm = {
  template_type: 'fully_defined',
  rotation_mode: 'consistent',
  day_of_week: 1,
  grade_groups: [],
  start_time: '09:00',
  end_time: '10:00',
  instructor_id: '',
  venue_id: '',
  required_skills: [],
  is_active: true,
  week_cycle_length: null,
  week_in_cycle: null,
  no_set_day: false,
  no_set_time: false,
  no_set_instructor: false,
  no_set_venue: false,
};

/* ── Helpers ────────────────────────────────────────────────── */

/** Map numeric day_of_week (0=Sun) to AvailabilityJson key */
const DAY_NUM_TO_NAME: Record<number, DayOfWeek> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

/** Safely parse availability_json — handles string, object, or null */
function parseAvailability(raw: AvailabilityJson | string | null | undefined): AvailabilityJson | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      console.warn('[Scheduler] Failed to parse availability_json string:', raw);
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

/** Check if availability data has ANY day-level entries (vs being empty/null) */
function hasAnyDayEntries(availability: AvailabilityJson): boolean {
  return DAYS_OF_WEEK.some((d) => {
    const dayName = DAY_NUM_TO_NAME[d.value];
    return dayName in availability;
  });
}

/** Check if an instructor/venue is available on a given day */
function isAvailableOnDay(rawAvailability: AvailabilityJson | string | null, dayNum: number): boolean {
  const availability = parseAvailability(rawAvailability);
  if (!availability) return true; // No availability data = assume available
  if (!hasAnyDayEntries(availability)) return true; // Empty object = assume available
  const dayName = DAY_NUM_TO_NAME[dayNum];
  const blocks = availability[dayName];
  // Key missing when other keys exist = UNAVAILABLE (not set = not available)
  if (blocks === undefined) return false;
  return blocks.length > 0; // empty array = unavailable; has blocks = available
}

/** Check if an instructor/venue is available at a specific time on a given day */
function isAvailableAtTime(
  rawAvailability: AvailabilityJson | string | null,
  dayNum: number,
  startTime: string,
  endTime: string,
): boolean {
  const availability = parseAvailability(rawAvailability);
  if (!availability) return true;
  if (!hasAnyDayEntries(availability)) return true;
  const dayName = DAY_NUM_TO_NAME[dayNum];
  const blocks = availability[dayName];
  // Key missing when other keys exist = UNAVAILABLE
  if (blocks === undefined) return false;
  if (blocks.length === 0) return false; // explicitly empty = unavailable
  return blocks.some((b) => startTime >= b.start && endTime <= b.end);
}

/** Get all days an instructor/venue is available */
function getAvailableDays(rawAvailability: AvailabilityJson | string | null): number[] {
  const availability = parseAvailability(rawAvailability);
  if (!availability) return DAYS_OF_WEEK.map((d) => d.value); // all days
  if (!hasAnyDayEntries(availability)) return DAYS_OF_WEEK.map((d) => d.value);
  return DAYS_OF_WEEK
    .map((d) => d.value)
    .filter((dayNum) => {
      const dayName = DAY_NUM_TO_NAME[dayNum];
      const blocks = availability[dayName];
      // Key missing = unavailable when other keys are present
      if (blocks === undefined) return false;
      return blocks.length > 0;
    });
}

function computeDuration(start: string | null, end: string | null): number {
  const [sh, sm] = (start || '09:00').split(':').map(Number);
  const [eh, em] = (end || '10:00').split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatTime(t: string | null): string {
  if (!t) return '\u2014';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/* ── Extended template type with joined relations ───────────── */

interface TemplateWithRelations extends SessionTemplate {
  venue?: Venue | null;
  instructor?: Instructor | null;
}

/* ── Page Component ─────────────────────────────────────────── */

export default function EventTemplatesPage() {
  const { selectedProgramId } = useProgram();

  const [templates, setTemplates] = useState<TemplateWithRelations[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CSV import
  const [importOpen, setImportOpen] = useState(false);

  /* ── Fetch data ─────────────────────────────────────────── */

  const fetchTemplates = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/templates?program_id=${selectedProgramId}&_t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const { templates: data } = await res.json();
      setTemplates(data ?? []);
    } catch {
      setToast({ message: 'Failed to load event templates', type: 'error', id: Date.now() });
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  const fetchLookups = useCallback(async () => {
    try {
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
    } catch {
      // Non-critical, dropdowns will just be empty
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  /* ── Form helpers ───────────────────────────────────────── */

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (t: TemplateWithRelations) => {
    const noDay = t.day_of_week == null;
    const noTime = !t.start_time && !t.end_time;
    const noInstructor = !t.instructor_id;
    const noVenue = !t.venue_id;
    setForm({
      template_type: t.template_type,
      rotation_mode: t.rotation_mode,
      day_of_week: t.day_of_week ?? 1,
      grade_groups: t.grade_groups ?? [],
      start_time: t.start_time?.slice(0, 5) ?? '',
      end_time: t.end_time?.slice(0, 5) ?? '',
      instructor_id: t.instructor_id ?? '',
      venue_id: t.venue_id ?? '',
      required_skills: t.required_skills ?? [],
      is_active: t.is_active,
      week_cycle_length: t.week_cycle_length,
      week_in_cycle: t.week_in_cycle,
      no_set_day: noDay,
      no_set_time: noTime,
      no_set_instructor: noInstructor,
      no_set_venue: noVenue,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (patch: Partial<TemplateForm>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };

      // When instructor changes, check if current day/time is still valid
      if (!next.no_set_day && patch.instructor_id !== undefined && patch.instructor_id) {
        const inst = instructors.find((i) => i.id === patch.instructor_id);
        if (inst?.availability_json) {
          const availDays = getAvailableDays(inst.availability_json);
          if (!availDays.includes(next.day_of_week)) {
            // Reset day to first available day
            next.day_of_week = availDays[0] ?? next.day_of_week;
          }
        }
      }

      // When day changes, check if current instructor is still valid
      if (!next.no_set_day && patch.day_of_week !== undefined && next.instructor_id) {
        const inst = instructors.find((i) => i.id === next.instructor_id);
        if (inst?.availability_json && !isAvailableOnDay(inst.availability_json, next.day_of_week)) {
          next.instructor_id = '';
        }
      }

      return next;
    });
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

  /** Instructors filtered by subject match, then annotated with day/time availability */
  const filteredInstructors = useMemo(() => {
    const active = instructors.filter((i) => i.is_active);
    // Only show instructors whose skills match the template's required_skills
    const subjectFiltered = active.filter((inst) =>
      skillsMatch(inst.skills, form.required_skills.length > 0 ? form.required_skills : null)
    );
    return subjectFiltered.map((inst) => {
      if (form.no_set_day) {
        return { ...inst, available: true, availOnDay: true };
      }
      const availOnDay = isAvailableOnDay(inst.availability_json, form.day_of_week);
      const availAtTime = form.start_time && form.end_time
        ? isAvailableAtTime(inst.availability_json, form.day_of_week, form.start_time, form.end_time)
        : availOnDay;
      return { ...inst, available: availAtTime, availOnDay };
    });
  }, [instructors, form.no_set_day, form.day_of_week, form.start_time, form.end_time, form.required_skills]);

  /** Days filtered by selected instructor's availability */
  const filteredDays = useMemo(() => {
    if (!form.instructor_id) return DAYS_OF_WEEK.map((d) => ({ ...d, available: true }));
    const inst = instructors.find((i) => i.id === form.instructor_id);
    if (!inst) {
      console.warn('[Scheduler] filteredDays: instructor not found for id:', form.instructor_id);
      return DAYS_OF_WEEK.map((d) => ({ ...d, available: true }));
    }
    const parsed = parseAvailability(inst.availability_json);
    if (!parsed) {
      console.warn('[Scheduler] filteredDays: no availability_json for instructor:', inst.first_name, inst.last_name, '— raw value:', inst.availability_json);
      return DAYS_OF_WEEK.map((d) => ({ ...d, available: true }));
    }
    const availDays = getAvailableDays(inst.availability_json);
    console.info('[Scheduler] filteredDays:', inst.first_name, inst.last_name, '— available days:', availDays.map(d => DAY_NUM_TO_NAME[d]));
    return DAYS_OF_WEEK.map((d) => ({ ...d, available: availDays.includes(d.value) }));
  }, [instructors, form.instructor_id]);

  /** Get time blocks for selected instructor on selected day */
  const selectedInstructorTimeBlocks = useMemo(() => {
    if (!form.instructor_id) return null;
    const inst = instructors.find((i) => i.id === form.instructor_id);
    if (!inst) {
      console.log('[EventTemplates] No instructor found for id:', form.instructor_id);
      return null;
    }
    
    console.log('[EventTemplates] Instructor:', inst.first_name, inst.last_name);
    console.log('[EventTemplates] availability_json:', inst.availability_json);
    
    if (!inst.availability_json) {
      console.log('[EventTemplates] No availability_json on instructor');
      return null;
    }
    
    const availability = parseAvailability(inst.availability_json);
    console.log('[EventTemplates] Parsed availability:', availability);
    
    if (!availability) {
      console.log('[EventTemplates] Failed to parse availability');
      return null;
    }
    
    const dayName = DAY_NUM_TO_NAME[form.day_of_week];
    console.log('[EventTemplates] Looking for day:', dayName, '(day_of_week:', form.day_of_week, ')');
    
    const blocks = availability[dayName];
    console.log('[EventTemplates] Blocks for', dayName, ':', blocks);
    
    if (!blocks || blocks.length === 0) {
      console.log('[EventTemplates] No blocks found or empty array');
      return null;
    }
    
    return blocks;
  }, [instructors, form.instructor_id, form.day_of_week]);

  /** Selected venue info for capacity hint */
  const selectedVenue = useMemo(() => {
    if (!form.venue_id) return null;
    return venues.find((v) => v.id === form.venue_id) ?? null;
  }, [venues, form.venue_id]);

  /* ── CRUD ───────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!selectedProgramId) return;
    if (form.grade_groups.length === 0) {
      setToast({ message: 'Select at least one grade group', type: 'error', id: Date.now() });
      return;
    }
    if (!form.no_set_time) {
      const duration = computeDuration(form.start_time, form.end_time);
      if (duration <= 0) {
        setToast({ message: 'End time must be after start time', type: 'error', id: Date.now() });
        return;
      }
    }

    const duration = form.no_set_time ? null : computeDuration(form.start_time, form.end_time);

    setSaving(true);
    try {
      const body = {
        program_id: selectedProgramId,
        template_type: form.template_type,
        rotation_mode: form.rotation_mode,
        day_of_week: form.no_set_day ? null : form.day_of_week,
        grade_groups: form.grade_groups,
        start_time: form.no_set_time ? null : form.start_time,
        end_time: form.no_set_time ? null : form.end_time,
        duration_minutes: duration,
        instructor_id: form.no_set_instructor ? null : (form.instructor_id || null),
        venue_id: form.no_set_venue ? null : (form.venue_id || null),
        required_skills: form.required_skills.length > 0 ? form.required_skills : null,
        is_active: form.is_active,
        week_cycle_length: form.week_cycle_length,
        week_in_cycle: form.week_in_cycle,
      };

      const url = editingId ? `/api/templates/${editingId}` : '/api/templates';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setToast({
        message: editingId ? 'Event template updated' : 'Event template created',
        type: 'success',
        id: Date.now(),
      });
      closeForm();
      await fetchTemplates();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to save template',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setDeleteConfirmId(null);
      setToast({ message: 'Event template deleted', type: 'success', id: Date.now() });
      await fetchTemplates();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete template',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setDeleting(false);
    }
  };

  /* ── Lookup helpers ─────────────────────────────────────── */

  const getInstructorName = (id: string | null) => {
    if (!id) return '—';
    const inst = instructors.find((i) => i.id === id);
    return inst ? `${inst.first_name} ${inst.last_name}` : '—';
  };

  const getVenueName = (t: TemplateWithRelations) => {
    if (t.venue) return t.venue.name;
    if (!t.venue_id) return '—';
    const v = venues.find((v) => v.id === t.venue_id);
    return v ? v.name : '—';
  };

  /* ── Map templates to TemplateListItem ─────────────────── */

  const templateListItems: TemplateListItem[] = templates.map((t) => {
    const dayLabel = t.day_of_week != null ? (DAYS_OF_WEEK.find((d) => d.value === t.day_of_week)?.label ?? '\u2014') : '\u2014';
    const cycleLabel = t.week_cycle_length && t.week_cycle_length > 1
      ? `Wk ${(t.week_in_cycle ?? 0) + 1}/${t.week_cycle_length}`
      : 'Weekly';
    const subject = (t.required_skills ?? []).join(', ') || '\u2014';
    return {
      id: t.id,
      name: (t.grade_groups ?? []).join(', ') || '\u2014',
      dayLabel,
      timeLabel: t.start_time && t.end_time ? `${formatTime(t.start_time)} \u2013 ${formatTime(t.end_time)}` : '\u2014',
      gradeGroups: t.grade_groups ?? [],
      instructor: getInstructorName(t.instructor_id),
      venue: getVenueName(t),
      subject,
      typeLabel: TEMPLATE_TYPES.find((tt) => tt.value === t.template_type)?.label ?? t.template_type,
      cycleLabel,
      tags: t.required_skills ?? [],
      isActive: t.is_active,
    };
  });

  /* ── Guard: no program selected ──────────────────────────── */

  if (!selectedProgramId) {
    return (
      <div className="overflow-y-auto h-full bg-slate-50 p-8">
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm">
          Select a program from the sidebar to manage event templates.
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="overflow-y-auto h-full" style={{ backgroundColor: '#F8FAFC', padding: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Event Templates
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              Create and manage session templates
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setImportOpen(true)} tooltip="Import templates from CSV">
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
            <Button variant="primary" onClick={openCreateForm} tooltip="Create a new session template">
              <Plus className="w-4 h-4" />
              New Event Template
            </Button>
          </div>
        </div>

        {/* Subject Dashboard */}
        <SubjectDashboard templates={templates} />

        {/* Template Table */}
        <TemplateList
          mode="table"
          templates={templateListItems}
          loading={loading}
          onEdit={(id) => {
            const t = templates.find((t) => t.id === id);
            if (t) openEditForm(t);
          }}
          onDelete={(id) => setDeleteConfirmId(id)}
        />
      </div>

      {/* ── Create / Edit Form Modal ──────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeForm} />
          <div
            style={{
              position: 'relative',
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              padding: 28,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              maxWidth: 600,
              width: '100%',
              margin: '0 16px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {editingId ? 'Edit Event Template' : 'New Event Template'}
              </h2>
              <button
                onClick={closeForm}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Staff */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <label style={rowLabelStyle}>Staff</label>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select
                  value={form.instructor_id}
                  onChange={(e) => updateForm({ instructor_id: e.target.value })}
                  disabled={form.no_set_instructor}
                  style={{
                    ...selectStyle,
                    ...(form.no_set_instructor ? disabledFieldStyle : {}),
                    ...(form.instructor_id && !form.no_set_instructor && filteredInstructors.find((i) => i.id === form.instructor_id && !i.available)
                      ? { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }
                      : {}),
                  }}
                >
                  <option value="">— None —</option>
                  {filteredInstructors
                    .sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1))
                    .map((i) => (
                      <option
                        key={i.id}
                        value={i.id}
                        style={!i.available ? { color: '#94A3B8' } : undefined}
                      >
                        {i.first_name} {i.last_name}
                        {!i.available ? ' (unavailable)' : ''}
                      </option>
                    ))}
                </select>
                {!form.no_set_instructor && filteredInstructors.length === 0 && form.required_skills.length > 0 && (
                  <span style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }} title="No staff have the required subjects. Add staff with these subjects on the Staff & Venues page.">
                    <AlertTriangle className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    No staff teach {form.required_skills.join(', ')}. Add staff with this subject on the Staff & Venues page.
                  </span>
                )}
                {!form.no_set_instructor && form.required_skills.length > 0 && filteredInstructors.length > 0 && (
                  <span style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} title="Only staff whose subjects match the template's required subjects are shown">
                    <Filter className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    Filtered by subject: {form.required_skills.join(', ')}
                  </span>
                )}
                {!form.no_set_instructor && filteredInstructors.some((i) => !i.available) && (
                  <span style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>
                    <Filter className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    Filtered by {DAYS_OF_WEEK.find((d) => d.value === form.day_of_week)?.label} {form.start_time}–{form.end_time}
                  </span>
                )}
              </div>
              <InlineFlexToggle
                checked={form.no_set_instructor}
                onChange={(checked) => updateForm({ no_set_instructor: checked, ...(checked ? { instructor_id: '' } : {}) })}
              />
            </div>

            {/* Venue */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <label style={rowLabelStyle}>Venue</label>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select
                  value={form.venue_id}
                  onChange={(e) => updateForm({ venue_id: e.target.value })}
                  disabled={form.no_set_venue}
                  style={{
                    ...selectStyle,
                    ...(form.no_set_venue ? disabledFieldStyle : {}),
                  }}
                >
                  <option value="">— None —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.max_capacity ? ` (cap: ${v.max_capacity})` : ''}
                    </option>
                  ))}
                </select>
                {!form.no_set_venue && selectedVenue?.max_capacity && (
                  <span style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Max capacity: {selectedVenue.max_capacity} students
                  </span>
                )}
              </div>
              <InlineFlexToggle
                checked={form.no_set_venue}
                onChange={(checked) => updateForm({ no_set_venue: checked, ...(checked ? { venue_id: '' } : {}) })}
              />
            </div>

            {/* Day of Week */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <label style={rowLabelStyle}>Day of Week</label>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select
                  value={form.day_of_week}
                  onChange={(e) => updateForm({ day_of_week: Number(e.target.value) })}
                  disabled={form.no_set_day}
                  style={{ ...selectStyle, ...(form.no_set_day ? disabledFieldStyle : {}) }}
                >
                  {filteredDays.map((d) => (
                    <option
                      key={d.value}
                      value={d.value}
                      disabled={!d.available}
                    >
                      {d.label}{!d.available ? ' (unavailable)' : ''}
                    </option>
                  ))}
                </select>
                {!form.no_set_day && filteredDays.some((d) => !d.available) && (
                  <span style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>
                    <Filter className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    Filtered by staff availability
                  </span>
                )}
              </div>
              <InlineFlexToggle
                checked={form.no_set_day}
                onChange={(checked) => updateForm({ no_set_day: checked, ...(checked ? {} : { day_of_week: 1 }) })}
              />
            </div>

            {/* Time */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <label style={rowLabelStyle}>Time</label>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => updateForm({ start_time: e.target.value })}
                  disabled={form.no_set_time}
                  style={{ ...inputStyle, flex: 1, ...(form.no_set_time ? disabledFieldStyle : {}) }}
                />
                <span style={{ color: '#94A3B8', fontSize: 14, flexShrink: 0 }}>–</span>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => updateForm({ end_time: e.target.value })}
                  disabled={form.no_set_time}
                  style={{ ...inputStyle, flex: 1, ...(form.no_set_time ? disabledFieldStyle : {}) }}
                />
              </div>
              <InlineFlexToggle
                checked={form.no_set_time}
                onChange={(checked) => updateForm({ no_set_time: checked, ...(checked ? { start_time: '', end_time: '' } : { start_time: '09:00', end_time: '10:00' }) })}
              />
            </div>

            {/* Staff Time Availability */}
            {!form.no_set_day && selectedInstructorTimeBlocks && selectedInstructorTimeBlocks.length > 0 && (
              <div style={{
                padding: 12,
                backgroundColor: '#F0F9FF',
                borderRadius: 8,
                border: '1px solid #BFDBFE',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF', marginBottom: 8 }}>
                  Staff available on {DAYS_OF_WEEK.find((d) => d.value === form.day_of_week)?.label}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedInstructorTimeBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#1E40AF',
                        backgroundColor: '#DBEAFE',
                        padding: '4px 10px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatTime(block.start)} – {formatTime(block.end)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grade Groups */}
            <FormField label="Grade Groups">
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

            {/* Required Subjects */}
            <FormField label="Required Subjects">
              <TagSelector
                value={form.required_skills}
                onChange={(skills) => setForm(prev => ({ ...prev, required_skills: skills }))}
                category="Subjects"
                placeholder="Select staff subjects required for this event template..."
              />
            </FormField>

            {/* Multi-week Pattern */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Week Cycle Length" hint="Leave empty for weekly">
                <input
                  type="number"
                  min={1}
                  max={8}
                  placeholder="1"
                  value={form.week_cycle_length ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    updateForm({
                      week_cycle_length: val,
                      week_in_cycle: val && val > 1 ? (form.week_in_cycle ?? 0) : null,
                    });
                  }}
                  style={inputStyle}
                />
              </FormField>
              {form.week_cycle_length != null && form.week_cycle_length > 1 && (
                <FormField label="Week in Cycle" hint={`0–${form.week_cycle_length - 1}`}>
                  <select
                    value={form.week_in_cycle ?? 0}
                    onChange={(e) => updateForm({ week_in_cycle: Number(e.target.value) })}
                    style={selectStyle}
                  >
                    {Array.from({ length: form.week_cycle_length }, (_, i) => (
                      <option key={i} value={i}>Week {i + 1}</option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>

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

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
              <Button variant="secondary" onClick={closeForm} tooltip="Discard changes">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                tooltip={editingId ? 'Save template changes' : 'Create new template'}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? 'Save Changes' : 'Create Event Template'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────── */}
      {deleteConfirmId && (() => {
        const t = templates.find((t) => t.id === deleteConfirmId);
        if (!t) return null;
        const dayLabel = DAYS_OF_WEEK.find((d) => d.value === t.day_of_week)?.label ?? '';
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirmId(null)} />
            <div style={{
              position: 'relative',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              maxWidth: 400,
              width: '100%',
              margin: '0 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Delete Event Template
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
                Delete the <strong>{dayLabel}</strong> {formatTime(t.start_time)} – {formatTime(t.end_time)} template
                for <strong>{(t.grade_groups ?? []).join(', ')}</strong>?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
                <Button variant="secondary" onClick={() => setDeleteConfirmId(null)} tooltip="Cancel">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting}
                  tooltip="Permanently delete"
                  style={{ backgroundColor: '#EF4444', color: '#FFFFFF', borderColor: '#EF4444' }}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Deleting…
                    </>
                  ) : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Event Templates from CSV"
        columns={TEMPLATE_CSV_COLUMNS}
        validateRow={validateTemplateCsvRow}
        onImport={async (csvRows) => {
          if (!selectedProgramId) throw new Error('No program selected');
          const mapped = csvRows.map((r) => ({
            name: r.name || '',
            day: r.day,
            start_time: r.start_time,
            end_time: r.end_time,
            venue: r.venue || '',
            instructor: r.instructor || '',
            subjects: r.subjects || '',
            grades: r.grades || '',
          }));
          const res = await fetch('/api/templates/import', {
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
            fetchTemplates();
            setToast({ message: `${result.imported} template(s) imported`, type: 'success', id: Date.now() });
          }
          return result;
        }}
        exampleCsv={TEMPLATE_CSV_EXAMPLE}
      />

      {/* Toast */}
      {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
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

const disabledFieldStyle: React.CSSProperties = {
  opacity: 0.45,
  backgroundColor: '#F1F5F9',
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  width: 90,
  flexShrink: 0,
  paddingTop: 11,
};

function ToggleCheckbox({
  label,
  tooltip,
  checked,
  onChange,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        marginBottom: 4,
      }}
      title={tooltip}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: '#3B82F6', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 12, fontWeight: 500, color: checked ? '#3B82F6' : '#94A3B8' }}>
        {label}
      </span>
    </label>
  );
}

function InlineFlexToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        paddingTop: 9,
      }}
      title="Auto-assign by scheduler"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 13, height: 13, accentColor: '#3B82F6', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, fontWeight: 500, color: checked ? '#3B82F6' : '#94A3B8' }}>
        Auto
      </span>
    </label>
  );
}
