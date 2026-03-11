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
  SessionTemplate, Instructor, Venue, SchedulingMode,
} from '@/types/database';
import { skillsMatch } from '@/lib/scheduler/utils';

/* ── Constants ──────────────────────────────────────────────── */


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
  { csvHeader: 'scheduling_mode', label: 'Scheduling Mode' },
  { csvHeader: 'starts_on', label: 'Starts On' },
  { csvHeader: 'ends_on', label: 'Ends On' },
  { csvHeader: 'duration_weeks', label: 'Duration Weeks' },
  { csvHeader: 'session_count', label: 'Session Count' },
  { csvHeader: 'within_weeks', label: 'Within Weeks' },
  { csvHeader: 'week_cycle_length', label: 'Week Cycle Length' },
  { csvHeader: 'week_in_cycle', label: 'Week in Cycle' },
  { csvHeader: 'additional_tags', label: 'Additional Tags' },
];

const VALID_DAYS = new Set([
  'sunday', 'sun', 'monday', 'mon', 'tuesday', 'tue',
  'wednesday', 'wed', 'thursday', 'thu', 'friday', 'fri',
  'saturday', 'sat', '0', '1', '2', '3', '4', '5', '6',
]);

const VALID_SCHEDULING_MODES = new Set(['date_range', 'duration', 'session_count', 'ongoing']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  // Scheduling mode validation
  const mode = (row.scheduling_mode?.trim().toLowerCase()) || 'ongoing';
  if (row.scheduling_mode?.trim() && !VALID_SCHEDULING_MODES.has(mode)) {
    errors.push({ row: rowIndex, column: 'scheduling_mode', message: 'Must be ongoing, date_range, duration, or session_count' });
  }
  if (mode === 'date_range') {
    if (!row.starts_on?.trim()) {
      errors.push({ row: rowIndex, column: 'starts_on', message: 'Required for date_range mode' });
    } else if (!DATE_RE.test(row.starts_on.trim())) {
      errors.push({ row: rowIndex, column: 'starts_on', message: 'Use YYYY-MM-DD format' });
    }
    if (!row.ends_on?.trim()) {
      errors.push({ row: rowIndex, column: 'ends_on', message: 'Required for date_range mode' });
    } else if (!DATE_RE.test(row.ends_on.trim())) {
      errors.push({ row: rowIndex, column: 'ends_on', message: 'Use YYYY-MM-DD format' });
    }
  }
  if (mode === 'duration') {
    if (!row.starts_on?.trim()) {
      errors.push({ row: rowIndex, column: 'starts_on', message: 'Required for duration mode' });
    } else if (!DATE_RE.test(row.starts_on.trim())) {
      errors.push({ row: rowIndex, column: 'starts_on', message: 'Use YYYY-MM-DD format' });
    }
    if (!row.duration_weeks?.trim()) {
      errors.push({ row: rowIndex, column: 'duration_weeks', message: 'Required for duration mode' });
    } else if (isNaN(Number(row.duration_weeks)) || Number(row.duration_weeks) < 1) {
      errors.push({ row: rowIndex, column: 'duration_weeks', message: 'Must be a positive integer' });
    }
  }
  if (mode === 'session_count') {
    if (!row.session_count?.trim()) {
      errors.push({ row: rowIndex, column: 'session_count', message: 'Required for session_count mode' });
    } else if (isNaN(Number(row.session_count)) || Number(row.session_count) < 1) {
      errors.push({ row: rowIndex, column: 'session_count', message: 'Must be a positive integer' });
    }
  }
  // Optional field format checks
  if (row.starts_on?.trim() && !DATE_RE.test(row.starts_on.trim()) && mode !== 'date_range' && mode !== 'duration') {
    errors.push({ row: rowIndex, column: 'starts_on', message: 'Use YYYY-MM-DD format' });
  }
  if (row.duration_weeks?.trim() && (isNaN(Number(row.duration_weeks)) || Number(row.duration_weeks) < 1)) {
    errors.push({ row: rowIndex, column: 'duration_weeks', message: 'Must be a positive integer' });
  }
  if (row.within_weeks?.trim() && (isNaN(Number(row.within_weeks)) || Number(row.within_weeks) < 1)) {
    errors.push({ row: rowIndex, column: 'within_weeks', message: 'Must be a positive integer' });
  }
  if (row.week_cycle_length?.trim() && (isNaN(Number(row.week_cycle_length)) || Number(row.week_cycle_length) < 1)) {
    errors.push({ row: rowIndex, column: 'week_cycle_length', message: 'Must be a positive integer' });
  }
  if (row.week_in_cycle?.trim() && (isNaN(Number(row.week_in_cycle)) || Number(row.week_in_cycle) < 0)) {
    errors.push({ row: rowIndex, column: 'week_in_cycle', message: 'Must be a non-negative integer' });
  }

  return errors;
}

const TEMPLATE_CSV_EXAMPLE = `name,day,start_time,end_time,venue,instructor,subjects,grades,scheduling_mode,starts_on,ends_on,duration_weeks,session_count,within_weeks,week_cycle_length,week_in_cycle,additional_tags
Piano Lab,Monday,09:00,10:00,Classroom 101,John Smith,Piano,3rd;4th,ongoing,,,,,,,,
Strings,Tuesday,10:00,11:30,Stage,Jane Doe,Strings,5th;6th,date_range,2026-09-01,2026-12-15,,,,2,1,
Choir,Wednesday,13:00,14:00,Cafe,,Choral,K;1st;2nd,duration,2026-09-01,,12,,,,, Performance;Holiday
Guitar,Thursday,14:00,15:00,Classroom 101,,Guitar,7th;8th,session_count,2026-09-01,,,10,20,,,`;

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
}

const EMPTY_FORM: TemplateForm = {
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
};

const DURATION_PRESETS = [30, 45, 60, 90];

/* ── Helpers ────────────────────────────────────────────────── */

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
    const dur = t.duration_minutes ?? 60;
    setForm({
      name: t.name ?? '',
      required_skills: t.required_skills ?? [],
      instructor_id: t.instructor_id ?? '',
      venue_id: t.venue_id ?? '',
      grade_groups: t.grade_groups ?? [],
      duration_minutes: dur,
      duration_custom: !DURATION_PRESETS.includes(dur),
      week_cycle_length: t.week_cycle_length,
      week_in_cycle: t.week_in_cycle,
      additional_tags: t.additional_tags ?? [],
      is_active: t.is_active,
      scheduling_mode: t.scheduling_mode ?? 'ongoing',
      starts_on: t.starts_on ?? '',
      ends_on: t.ends_on ?? '',
      duration_weeks: t.duration_weeks,
      session_count: t.session_count,
      within_weeks: t.within_weeks,
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

  /** Instructors filtered by subject match only */
  const filteredInstructors = useMemo(() => {
    const active = instructors.filter((i) => i.is_active);
    return active.filter((inst) =>
      skillsMatch(inst.skills, form.required_skills.length > 0 ? form.required_skills : null)
    );
  }, [instructors, form.required_skills]);

  /* ── CRUD ───────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!selectedProgramId) return;
    if (form.duration_minutes <= 0) {
      setToast({ message: 'Duration must be greater than 0', type: 'error', id: Date.now() });
      return;
    }

    setSaving(true);
    try {
      const body = {
        program_id: selectedProgramId,
        name: form.name || null,
        template_type: 'fully_defined' as const,
        rotation_mode: 'consistent' as const,
        day_of_week: null,
        grade_groups: form.grade_groups,
        start_time: null,
        end_time: null,
        duration_minutes: form.duration_minutes,
        instructor_id: form.instructor_id || null,
        venue_id: form.venue_id || null,
        required_skills: form.required_skills.length > 0 ? form.required_skills : null,
        additional_tags: form.additional_tags.length > 0 ? form.additional_tags : null,
        is_active: form.is_active,
        week_cycle_length: form.week_cycle_length,
        week_in_cycle: form.week_in_cycle,
        scheduling_mode: form.scheduling_mode,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        duration_weeks: form.duration_weeks,
        session_count: form.session_count,
        within_weeks: form.within_weeks,
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
    const cycleLabel = t.week_cycle_length && t.week_cycle_length > 1
      ? `Every ${t.week_cycle_length} wks`
      : 'Weekly';
    const subject = (t.required_skills ?? []).join(', ') || '\u2014';
    const displayName = t.name || subject || (t.grade_groups ?? []).join(', ') || 'Untitled';
    return {
      id: t.id,
      name: displayName,
      dayLabel: '\u2014',
      timeLabel: t.duration_minutes ? `${t.duration_minutes} min` : '\u2014',
      gradeGroups: t.grade_groups ?? [],
      instructor: getInstructorName(t.instructor_id),
      venue: getVenueName(t),
      subject,
      typeLabel: 'Template',
      cycleLabel,
      tags: [...(t.required_skills ?? []), ...(t.additional_tags ?? [])],
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
            <Button variant="primary" onClick={openCreateForm} tooltip="Create a new class template">
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
                {editingId ? 'Edit Event Template' : 'New Event Template'}
              </h2>
              <button
                onClick={closeForm}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Scrollable form body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 1. Name */}
            <FormField label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g., Weekly Strings K-2"
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
                    {v.name}{v.max_capacity ? ` (cap: ${v.max_capacity})` : ''}
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

            {/* 7. Repeats Every X Weeks */}
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

            {/* 8. Additional Tags */}
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

            </div>{/* end scrollable form body */}

            {/* Actions */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 28px', borderTop: '1px solid #E2E8F0' }}>
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
        const displayName = t.name || (t.required_skills ?? []).join(', ') || (t.grade_groups ?? []).join(', ') || 'this template';
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
                Delete <strong>{displayName}</strong>?
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
            scheduling_mode: r.scheduling_mode || '',
            starts_on: r.starts_on || '',
            ends_on: r.ends_on || '',
            duration_weeks: r.duration_weeks || '',
            session_count: r.session_count || '',
            within_weeks: r.within_weeks || '',
            week_cycle_length: r.week_cycle_length || '',
            week_in_cycle: r.week_in_cycle || '',
            additional_tags: r.additional_tags || '',
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

