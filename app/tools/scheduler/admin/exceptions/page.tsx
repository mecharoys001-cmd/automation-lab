'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProgram } from '../ProgramContext';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarOff,
  PartyPopper,
  Zap,
  Loader2,
} from 'lucide-react';
import type { CalendarStatusType } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchoolCalendarEntry {
  id: string;
  program_id: string;
  date: string;
  description: string | null;
  status_type: CalendarStatusType;
  early_dismissal_time: string | null;
  target_instructor_id: string | null;
  instructor?: { id: string; first_name: string; last_name: string } | null;
  created_at: string;
}

interface ExceptionFormData {
  date: string;
  status_type: CalendarStatusType;
  description: string;
  early_dismissal_time: string;
  target_instructor_id: string;
}

// ---------------------------------------------------------------------------
// Exception type config — maps DB status_type to UI display
// ---------------------------------------------------------------------------

const EXCEPTION_TYPE_CONFIG: Record<
  CalendarStatusType,
  { label: string; badgeColor: 'red' | 'amber' | 'blue'; icon: typeof CalendarOff }
> = {
  no_school: {
    label: 'No School',
    badgeColor: 'red',
    icon: CalendarOff,
  },
  early_dismissal: {
    label: 'Early Dismissal',
    badgeColor: 'amber',
    icon: Clock,
  },
  instructor_exception: {
    label: 'Special Event',
    badgeColor: 'blue',
    icon: PartyPopper,
  },
};

const EXCEPTION_TYPES: CalendarStatusType[] = [
  'no_school',
  'early_dismissal',
  'instructor_exception',
];

const emptyForm: ExceptionFormData = {
  date: '',
  status_type: 'no_school',
  description: '',
  early_dismissal_time: '',
  target_instructor_id: '',
};

// ---------------------------------------------------------------------------
// Shared style constants (matching design spec tokens)
// ---------------------------------------------------------------------------

const labelClass = 'block text-xs font-medium text-slate-500 mb-1';
const inputClass =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors';
const thClass =
  'text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider';
const tdClass = 'px-4 py-3 text-sm';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ExceptionsPage() {
  const { selectedProgramId } = useProgram();
  const [entries, setEntries] = useState<SchoolCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExceptionFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // =========================================================================
  // Fetch
  // =========================================================================

  const fetchEntries = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ program_id: selectedProgramId });
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // =========================================================================
  // Toast helper
  // =========================================================================

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // =========================================================================
  // Modal helpers
  // =========================================================================

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(entry: SchoolCalendarEntry) {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      status_type: entry.status_type,
      description: entry.description ?? '',
      early_dismissal_time: entry.early_dismissal_time ?? '',
      target_instructor_id: entry.target_instructor_id ?? '',
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  // =========================================================================
  // CRUD handlers
  // =========================================================================

  async function handleSave() {
    if (!form.date) {
      setFormError('Date is required.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!selectedProgramId) {
      setFormError('No program selected.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload: Record<string, string | null> = {
      program_id: selectedProgramId,
      date: form.date,
      status_type: form.status_type,
      description: form.description.trim(),
      early_dismissal_time:
        form.status_type === 'early_dismissal' && form.early_dismissal_time
          ? form.early_dismissal_time
          : null,
      target_instructor_id:
        form.status_type === 'instructor_exception' && form.target_instructor_id
          ? form.target_instructor_id
          : null,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/calendar/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update exception');
        showToast('Exception updated', 'success');
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create exception');
        showToast('Exception added', 'success');
      }
      closeModal();
      fetchEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this exception? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Exception deleted', 'success');
      fetchEntries();
    } catch {
      showToast('Failed to delete exception', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function formatDate(iso: string) {
    if (!iso) return '\u2014';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Stats
  const typeCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.status_type] = (acc[e.status_type] || 0) + 1;
    return acc;
  }, {});

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-[13px] font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Top Bar */}
      <div className="border-b border-slate-200 bg-white px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Exceptions</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Manage holidays, closures, early dismissals, and special events.
          </p>
        </div>
        <Tooltip text="Add a new schedule exception">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={openAdd}
          >
            Add Exception
          </Button>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Tooltip text="Total schedule exceptions this program">
            <div className="bg-white rounded-lg p-5 flex items-center gap-4 border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-[22px] h-[22px] text-slate-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Total</p>
                <p className="text-[28px] font-bold text-slate-900 leading-none">
                  {loading ? '\u2014' : entries.length}
                </p>
              </div>
            </div>
          </Tooltip>

          <Tooltip text="Days with no school (holidays, closures)">
            <div className="bg-white rounded-lg p-5 flex items-center gap-4 border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <CalendarOff className="w-[22px] h-[22px] text-red-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">No School</p>
                <p className="text-[28px] font-bold text-slate-900 leading-none">
                  {loading ? '\u2014' : typeCounts['no_school'] ?? 0}
                </p>
              </div>
            </div>
          </Tooltip>

          <Tooltip text="Days with early dismissal">
            <div className="bg-white rounded-lg p-5 flex items-center gap-4 border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-[22px] h-[22px] text-amber-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Early Dismissal</p>
                <p className="text-[28px] font-bold text-slate-900 leading-none">
                  {loading ? '\u2014' : typeCounts['early_dismissal'] ?? 0}
                </p>
              </div>
            </div>
          </Tooltip>

          <Tooltip text="Instructor-specific exceptions and special events">
            <div className="bg-white rounded-lg p-5 flex items-center gap-4 border border-slate-200 shadow-sm">
              <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Zap className="w-[22px] h-[22px] text-blue-500" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Special Events</p>
                <p className="text-[28px] font-bold text-slate-900 leading-none">
                  {loading ? '\u2014' : typeCounts['instructor_exception'] ?? 0}
                </p>
              </div>
            </div>
          </Tooltip>
        </div>

        {/* Exceptions Table */}
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center text-sm text-slate-400">
            Loading exceptions...
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">No Exceptions</p>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Add holidays, closures, or early dismissals to the schedule.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Description</th>
                    <th className={thClass}>Details</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const config = EXCEPTION_TYPE_CONFIG[entry.status_type];
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors"
                      >
                        <td className={tdClass}>
                          <Tooltip text={`Exception on ${entry.date}`}>
                            <span className="font-medium text-slate-900">
                              {formatDate(entry.date)}
                            </span>
                          </Tooltip>
                        </td>
                        <td className={tdClass}>
                          <Tooltip text={config.label}>
                            <Badge
                              variant="table"
                              color={config.badgeColor}
                            >
                              {config.label}
                            </Badge>
                          </Tooltip>
                        </td>
                        <td className={`${tdClass} text-slate-500 max-w-xs truncate`}>
                          <Tooltip text={entry.description ?? 'No description'}>
                            <span>{entry.description || '\u2014'}</span>
                          </Tooltip>
                        </td>
                        <td className={`${tdClass} text-slate-400 text-xs`}>
                          {entry.status_type === 'early_dismissal' && entry.early_dismissal_time && (
                            <Tooltip text="Early dismissal time">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {entry.early_dismissal_time.slice(0, 5)}
                              </span>
                            </Tooltip>
                          )}
                          {entry.status_type === 'instructor_exception' && entry.instructor && (
                            <Tooltip text="Affected instructor">
                              <span>
                                {entry.instructor.first_name} {entry.instructor.last_name}
                              </span>
                            </Tooltip>
                          )}
                          {entry.status_type === 'no_school' && (
                            <Tooltip text="Affects all sessions on this date">
                              <span>All sessions</span>
                            </Tooltip>
                          )}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <div className="inline-flex items-center gap-2">
                            <Tooltip text="Edit this exception">
                              <button
                                onClick={() => openEdit(entry)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                            </Tooltip>
                            <Tooltip text="Delete this exception">
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingId === entry.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-300 text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {deletingId === entry.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Deleting…
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </>
                                )}
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

          {/* Modal card — design spec: rounded-16, shadow */}
          <div className="relative z-50 w-full max-w-lg bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            {/* Modal Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 flex-1">
                {editingId ? 'Edit Exception' : 'Add Exception'}
              </h2>
              <Tooltip text="Close without saving">
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </Tooltip>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Date */}
              <div>
                <Tooltip text="The date this exception applies to" position="bottom">
                  <label className={labelClass}>Date</label>
                </Tooltip>
                <Tooltip text="Select the exception date" position="bottom">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className={inputClass}
                  />
                </Tooltip>
              </div>

              {/* Exception Type */}
              <div>
                <Tooltip text="What kind of schedule exception is this?" position="bottom">
                  <label className={labelClass}>Exception Type</label>
                </Tooltip>
                <div className="grid grid-cols-3 gap-2">
                  {EXCEPTION_TYPES.map((type) => {
                    const cfg = EXCEPTION_TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    const isSelected = form.status_type === type;
                    return (
                      <Tooltip key={type} text={cfg.label}>
                        <button
                          onClick={() => setForm((f) => ({ ...f, status_type: type }))}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-xs font-medium transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                          {cfg.label}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <Tooltip text="Brief description of this exception" position="bottom">
                  <label className={labelClass}>Description</label>
                </Tooltip>
                <Tooltip text="E.g., 'Thanksgiving Break', 'Teacher In-Service'" position="bottom">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none"
                    placeholder="e.g., Thanksgiving Break"
                  />
                </Tooltip>
              </div>

              {/* Early Dismissal Time — only for early_dismissal type */}
              {form.status_type === 'early_dismissal' && (
                <div>
                  <Tooltip text="Time when early dismissal begins" position="bottom">
                    <label className={labelClass}>Dismissal Time</label>
                  </Tooltip>
                  <Tooltip text="Set the time students are dismissed" position="bottom">
                    <input
                      type="time"
                      value={form.early_dismissal_time}
                      onChange={(e) => setForm((f) => ({ ...f, early_dismissal_time: e.target.value }))}
                      className={inputClass}
                    />
                  </Tooltip>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-500 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {formError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200">
              <Button
                variant="secondary"
                size="md"
                onClick={closeModal}
                tooltip="Discard changes"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                disabled={saving}
                tooltip="Save exception details"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? 'Save' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
