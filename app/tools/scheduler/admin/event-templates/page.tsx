'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Loader2, Check, AlertTriangle, Upload,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SubjectDashboard } from '../../components/ui/SubjectDashboard';
import { CsvImportDialog, type CsvColumnDef, type ValidationError } from '../../components/ui/CsvImportDialog';
import type { CsvRow } from '@/lib/csvDedup';
import { TemplateList } from '../../components/templates/TemplateList';
import type { TemplateListItem } from '../../components/templates/TemplateList';
import { TemplateFormModal } from '../../components/modals/TemplateFormModal';
import type { TemplateFormData } from '../../components/modals/TemplateFormModal';
import { useProgram } from '../ProgramContext';
import type {
  SessionTemplate, Instructor, Venue,
} from '@/types/database';
import { getSubjectColor } from '../../lib/subjectColors';

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
  { csvHeader: 'subjects', label: 'Event Type' },
  { csvHeader: 'grades', label: 'Grades' },
  { csvHeader: 'scheduling_mode', label: 'Scheduling Mode' },
  { csvHeader: 'starts_on', label: 'Starts On' },
  { csvHeader: 'ends_on', label: 'Ends On' },
  { csvHeader: 'duration_weeks', label: 'Duration Weeks' },
  { csvHeader: 'session_count', label: 'Event Count' },
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
  const [editInitialData, setEditInitialData] = useState<Partial<TemplateFormData> | undefined>(undefined);

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
    if (!selectedProgramId) return;
    try {
      const [instRes, venueRes] = await Promise.all([
        fetch(`/api/instructors?program_id=${selectedProgramId}&_t=${Date.now()}`),
        fetch(`/api/venues?program_id=${selectedProgramId}&_t=${Date.now()}`),
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
  }, [selectedProgramId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  /* ── Form helpers ───────────────────────────────────────── */

  const openCreateForm = () => {
    setEditInitialData(undefined);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (t: TemplateWithRelations) => {
    setEditInitialData({
      name: t.name ?? '',
      required_skills: t.required_skills ?? [],
      instructor_id: t.instructor_id ?? '',
      venue_id: t.venue_id ?? '',
      grade_groups: t.grade_groups ?? [],
      duration_minutes: t.duration_minutes ?? 60,
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
      sessions_per_week: t.sessions_per_week ?? 1,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditInitialData(undefined);
  };

  /* ── CRUD ───────────────────────────────────────────────── */

  const handleSave = async (formData: TemplateFormData) => {
    if (!selectedProgramId) throw new Error('No program selected');

    const body = {
      program_id: selectedProgramId,
      name: formData.name || null,
      template_type: 'fully_defined' as const,
      rotation_mode: 'consistent' as const,
      day_of_week: null,
      grade_groups: formData.grade_groups,
      start_time: null,
      end_time: null,
      duration_minutes: formData.duration_minutes,
      instructor_id: formData.instructor_id || null,
      venue_id: formData.venue_id || null,
      required_skills: formData.required_skills.length > 0 ? formData.required_skills : null,
      additional_tags: formData.additional_tags.length > 0 ? formData.additional_tags : null,
      is_active: formData.is_active,
      week_cycle_length: formData.week_cycle_length,
      week_in_cycle: formData.week_in_cycle,
      scheduling_mode: formData.scheduling_mode,
      starts_on: formData.starts_on || null,
      ends_on: formData.ends_on || null,
      duration_weeks: formData.duration_weeks,
      session_count: formData.session_count,
      within_weeks: formData.within_weeks,
      sessions_per_week: formData.sessions_per_week,
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
    await fetchTemplates();
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
    const skills = t.required_skills ?? [];
    const subject = skills.join(', ') || '\u2014';
    const subjectEmoji = skills.length > 0 ? getSubjectColor(skills[0]).emoji : undefined;
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
      subjectEmoji,
      typeLabel: 'Template',
      cycleLabel,
      tags: [...skills, ...(t.additional_tags ?? [])],
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
            <Button variant="primary" onClick={openCreateForm} tooltip="Create a new event template">
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
      <TemplateFormModal
        open={showForm}
        onClose={closeForm}
        onSave={handleSave}
        initialData={editInitialData}
        programId={selectedProgramId}
      />

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
        templateFilename="event-templates.csv"
      />

      {/* Toast */}
      {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}


