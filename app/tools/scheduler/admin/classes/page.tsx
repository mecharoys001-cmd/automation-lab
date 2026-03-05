'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Loader2, Check, AlertTriangle, X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TagSelector } from '../../components/ui/TagSelector';
import { TemplateList } from '../../components/templates/TemplateList';
import type { TemplateListItem } from '../../components/templates/TemplateList';
import { useProgram } from '../ProgramContext';
import type {
  SessionTemplate, Instructor, Venue,
  TemplateType, RotationMode,
} from '@/types/database';

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
  { value: 'tagged_slot', label: 'Tagged Slot', desc: 'Instructor assigned by tag' },
  { value: 'auto_assign', label: 'Auto Assign', desc: 'System picks instructor' },
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

const SKILL_OPTIONS = [
  'Percussion', 'Strings', 'Brass', 'Choral', 'Piano', 'Guitar', 'Woodwind',
];

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
};

/* ── Helpers ────────────────────────────────────────────────── */

function computeDuration(start: string | null, end: string | null): number {
  const [sh, sm] = (start || '09:00').split(':').map(Number);
  const [eh, em] = (end || '10:00').split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatTime(t: string | null): string {
  const [h, m] = (t || '09:00').split(':').map(Number);
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

export default function ClassesPage() {
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
      setToast({ message: 'Failed to load class templates', type: 'error', id: Date.now() });
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
    setForm({
      template_type: t.template_type,
      rotation_mode: t.rotation_mode,
      day_of_week: t.day_of_week,
      grade_groups: t.grade_groups ?? [],
      start_time: t.start_time?.slice(0, 5) ?? '09:00',
      end_time: t.end_time?.slice(0, 5) ?? '10:00',
      instructor_id: t.instructor_id ?? '',
      venue_id: t.venue_id ?? '',
      required_skills: t.required_skills ?? [],
      is_active: t.is_active,
      week_cycle_length: t.week_cycle_length,
      week_in_cycle: t.week_in_cycle,
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

  /* ── CRUD ───────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!selectedProgramId) return;
    if (form.grade_groups.length === 0) {
      setToast({ message: 'Select at least one grade group', type: 'error', id: Date.now() });
      return;
    }
    const duration = computeDuration(form.start_time, form.end_time);
    if (duration <= 0) {
      setToast({ message: 'End time must be after start time', type: 'error', id: Date.now() });
      return;
    }

    setSaving(true);
    try {
      const body = {
        program_id: selectedProgramId,
        template_type: form.template_type,
        rotation_mode: form.rotation_mode,
        day_of_week: form.day_of_week,
        grade_groups: form.grade_groups,
        start_time: form.start_time,
        end_time: form.end_time,
        duration_minutes: duration,
        instructor_id: form.instructor_id || null,
        venue_id: form.venue_id || null,
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
        message: editingId ? 'Class template updated' : 'Class template created',
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
      setToast({ message: 'Class template deleted', type: 'success', id: Date.now() });
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
    const dayLabel = DAYS_OF_WEEK.find((d) => d.value === t.day_of_week)?.label ?? '\u2014';
    const cycleLabel = t.week_cycle_length && t.week_cycle_length > 1
      ? `Wk ${(t.week_in_cycle ?? 0) + 1}/${t.week_cycle_length}`
      : 'Weekly';
    return {
      id: t.id,
      name: (t.grade_groups ?? []).join(', ') || '\u2014',
      dayLabel,
      timeLabel: `${formatTime(t.start_time)} \u2013 ${formatTime(t.end_time)}`,
      gradeGroups: t.grade_groups ?? [],
      instructor: getInstructorName(t.instructor_id),
      venue: getVenueName(t),
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
          Select a program from the sidebar to manage class templates.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Classes
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              Create and manage session templates
            </p>
          </div>
        </div>

        {/* Create button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={openCreateForm} tooltip="Create a new session template">
            <Plus className="w-4 h-4" />
            New Class
          </Button>
        </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
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
                {editingId ? 'Edit Class Template' : 'New Class Template'}
              </h2>
              <button
                onClick={closeForm}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Template Type & Rotation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Template Type">
                <select
                  value={form.template_type}
                  onChange={(e) => updateForm({ template_type: e.target.value as TemplateType })}
                  className="form-select"
                  style={selectStyle}
                >
                  {TEMPLATE_TYPES.map((tt) => (
                    <option key={tt.value} value={tt.value}>{tt.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Rotation Mode">
                <select
                  value={form.rotation_mode}
                  onChange={(e) => updateForm({ rotation_mode: e.target.value as RotationMode })}
                  style={selectStyle}
                >
                  {ROTATION_MODES.map((rm) => (
                    <option key={rm.value} value={rm.value}>{rm.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Day & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <FormField label="Day of Week">
                <select
                  value={form.day_of_week}
                  onChange={(e) => updateForm({ day_of_week: Number(e.target.value) })}
                  style={selectStyle}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Start Time">
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => updateForm({ start_time: e.target.value })}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="End Time">
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => updateForm({ end_time: e.target.value })}
                  style={inputStyle}
                />
              </FormField>
            </div>

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

            {/* Instructor & Venue */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="Instructor">
                <select
                  value={form.instructor_id}
                  onChange={(e) => updateForm({ instructor_id: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">— None —</option>
                  {instructors.filter((i) => i.is_active).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.first_name} {i.last_name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Venue">
                <select
                  value={form.venue_id}
                  onChange={(e) => updateForm({ venue_id: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">— None —</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Required Skills */}
            <FormField label="Required Skills">
              <TagSelector
                value={form.required_skills}
                onChange={(skills) => setForm(prev => ({ ...prev, required_skills: skills }))}
                category="Skills"
                placeholder="Select instructor skills required for this class..."
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
                ) : editingId ? 'Save Changes' : 'Create Class'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center">
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
                Delete Class Template
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
