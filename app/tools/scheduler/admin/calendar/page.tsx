'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProgram } from '../ProgramContext';
import type { SchoolCalendar, CalendarStatusType, Instructor } from '@/types/database';
import Tooltip from '../../components/Tooltip';

// ── Helpers ──────────────────────────────────────────────────

const STATUS_LABELS: Record<CalendarStatusType, string> = {
  no_school: 'No School',
  early_dismissal: 'Early Dismissal',
  instructor_exception: 'Instructor Exception',
};

const STATUS_BADGE_CLASSES: Record<CalendarStatusType, string> = {
  no_school: 'bg-red-500/20 text-red-400 border-red-500/30',
  early_dismissal: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  instructor_exception: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const STATUS_TOOLTIPS: Record<CalendarStatusType, string> = {
  no_school: 'No classes on this date',
  early_dismissal: 'Classes end earlier than usual',
  instructor_exception: 'Schedule exception for a specific instructor',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(time: string | null): string {
  if (!time) return '--';
  // Handle both HH:MM and HH:MM:SS
  const parts = time.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Skeleton ─────────────────────────────────────────────────

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-muted/30" />
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-48 rounded bg-muted/30 mx-auto" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted/30" />
        ))}
      </div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: CalendarStatusType }) {
  return (
    <Tooltip text={STATUS_TOOLTIPS[status]}>
      <span
        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>
    </Tooltip>
  );
}

// ── Empty form state ─────────────────────────────────────────

interface EntryForm {
  date: string;
  description: string;
  status_type: CalendarStatusType;
  early_dismissal_time: string;
  target_instructor_id: string;
}

const EMPTY_FORM: EntryForm = {
  date: '',
  description: '',
  status_type: 'no_school',
  early_dismissal_time: '',
  target_instructor_id: '',
};

// ── Main page ────────────────────────────────────────────────

export default function CalendarPage() {
  const { selectedProgramId } = useProgram();

  // Data
  const [entries, setEntries] = useState<(SchoolCalendar & { instructor?: Instructor | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<CalendarStatusType | 'all'>('all');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<EntryForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({ ...EMPTY_FORM });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  // Calendar overlay
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  // ── Fetch entries ────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    if (!selectedProgramId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar?program_id=${selectedProgramId}`);
      if (!res.ok) throw new Error('Failed to load calendar entries');
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Filtered entries ─────────────────────────────────────────

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (filterType !== 'all' && entry.status_type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const desc = (entry.description ?? '').toLowerCase();
        const date = entry.date.toLowerCase();
        return desc.includes(q) || date.includes(q);
      }
      return true;
    });
  }, [entries, filterType, search]);

  // Sort by date ascending
  const sortedEntries = useMemo(() => {
    return [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // ── Add entry ────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!selectedProgramId || !addForm.date) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        program_id: selectedProgramId,
        date: addForm.date,
        description: addForm.description || null,
        status_type: addForm.status_type,
        early_dismissal_time: addForm.status_type === 'early_dismissal' ? addForm.early_dismissal_time || null : null,
        target_instructor_id: addForm.target_instructor_id || null,
      };
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create entry');
      setAddForm({ ...EMPTY_FORM });
      setShowAddForm(false);
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit entry ───────────────────────────────────────────────

  const startEdit = (entry: SchoolCalendar) => {
    setEditingId(entry.id);
    setEditForm({
      date: entry.date,
      description: entry.description ?? '',
      status_type: entry.status_type,
      early_dismissal_time: entry.early_dismissal_time ?? '',
      target_instructor_id: entry.target_instructor_id ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ ...EMPTY_FORM });
  };

  const handleEdit = async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: editForm.date,
        description: editForm.description || null,
        status_type: editForm.status_type,
        early_dismissal_time: editForm.status_type === 'early_dismissal' ? editForm.early_dismissal_time || null : null,
        target_instructor_id: editForm.target_instructor_id || null,
      };
      const res = await fetch(`/api/calendar/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update entry');
      cancelEdit();
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update entry');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete entry ─────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete entry');
      setDeletingId(null);
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── CSV import ───────────────────────────────────────────────

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedProgramId) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('program_id', selectedProgramId);
      const res = await fetch('/api/calendar/import', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();
      setImportResult({ imported: data.imported, skipped: data.skipped, total: data.total });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  // ── Calendar overlay data ────────────────────────────────────

  const calendarMap = useMemo(() => {
    const map = new Map<string, CalendarStatusType>();
    for (const entry of entries) {
      // If there's already an entry for a date, prefer no_school > early_dismissal > instructor_exception
      const existing = map.get(entry.date);
      if (!existing) {
        map.set(entry.date, entry.status_type);
      } else if (entry.status_type === 'no_school') {
        map.set(entry.date, 'no_school');
      }
    }
    return map;
  }, [entries]);

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  // ── No program selected ──────────────────────────────────────

  if (!selectedProgramId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">School Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Manage blackout dates, early dismissals, and instructor exceptions.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          Select a program to manage its calendar.
        </div>
      </div>
    );
  }

  // ── Render form fields (shared between add and edit) ─────────

  function renderFormFields(
    form: EntryForm,
    setForm: (f: EntryForm) => void,
    onSave: () => void,
    onCancel: () => void,
    isSaving: boolean,
  ) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Tooltip text="Select the calendar entry date">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Tooltip>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Tooltip text="Enter a description for this calendar event">
              <input
                type="text"
                placeholder="e.g. Winter Break"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Tooltip>
          </div>

          {/* Status type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Tooltip text="Choose the calendar event type">
              <select
                value={form.status_type}
                onChange={(e) => setForm({ ...form, status_type: e.target.value as CalendarStatusType })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="no_school">No School</option>
                <option value="early_dismissal">Early Dismissal</option>
                <option value="instructor_exception">Instructor Exception</option>
              </select>
            </Tooltip>
          </div>

          {/* Early dismissal time (conditional) */}
          {form.status_type === 'early_dismissal' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Dismissal Time</label>
              <Tooltip text="Set the early dismissal time">
                <input
                  type="time"
                  value={form.early_dismissal_time}
                  onChange={(e) => setForm({ ...form, early_dismissal_time: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Tooltip>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Tooltip text="Save this calendar entry">
            <button
              onClick={onSave}
              disabled={isSaving || !form.date}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </Tooltip>
          <Tooltip text="Discard changes and close form">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-md text-sm font-medium border border-border px-4 py-2 text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">School Calendar</h1>
        <p className="text-muted-foreground mt-1">
          Manage blackout dates, early dismissals, and instructor exceptions.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <Tooltip text="Dismiss this error">
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">
              Dismiss
            </button>
          </Tooltip>
        </div>
      )}

      {/* ── Visual Calendar Overlay ───────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Month Overview</h2>
        <div className="rounded-lg border border-border bg-card p-4">
          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="space-y-3">
              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <Tooltip text="Previous month">
                  <button
                    onClick={prevMonth}
                    className="rounded-md text-xs font-medium border border-border px-3 py-1.5 text-foreground hover:bg-muted transition-colors"
                  >
                    Prev
                  </button>
                </Tooltip>
                <h3 className="text-sm font-semibold">
                  {MONTH_NAMES[calMonth]} {calYear}
                </h3>
                <Tooltip text="Next month">
                  <button
                    onClick={nextMonth}
                    className="rounded-md text-xs font-medium border border-border px-3 py-1.5 text-foreground hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </Tooltip>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-xs font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Leading blank cells */}
                {Array.from({ length: getFirstDayOfWeek(calYear, calMonth) }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-10 rounded" />
                ))}

                {/* Day cells */}
                {Array.from({ length: getDaysInMonth(calYear, calMonth) }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const status = calendarMap.get(dateStr);

                  let cellClasses = 'h-10 rounded flex items-center justify-center text-xs font-medium transition-colors ';
                  if (status === 'no_school') {
                    cellClasses += 'bg-red-500/20 text-red-400 border border-red-500/30';
                  } else if (status === 'early_dismissal') {
                    cellClasses += 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
                  } else if (status === 'instructor_exception') {
                    cellClasses += 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
                  } else {
                    cellClasses += 'text-foreground hover:bg-muted/30';
                  }

                  // Highlight today
                  const isToday =
                    calYear === today.getFullYear() &&
                    calMonth === today.getMonth() &&
                    day === today.getDate();
                  if (isToday && !status) {
                    cellClasses += ' ring-1 ring-primary';
                  }

                  return (
                    <Tooltip key={day} text={status ? STATUS_TOOLTIPS[status] : `${MONTH_NAMES[calMonth]} ${day}`}>
                      <div className={cellClasses}>
                        {day}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
                <Tooltip text={STATUS_TOOLTIPS.no_school}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-red-500/20 border border-red-500/30" />
                    No School
                  </span>
                </Tooltip>
                <Tooltip text={STATUS_TOOLTIPS.early_dismissal}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500/30" />
                    Early Dismissal
                  </span>
                </Tooltip>
                <Tooltip text={STATUS_TOOLTIPS.instructor_exception}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-blue-500/20 border border-blue-500/30" />
                    Instructor Exception
                  </span>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Add Entry / CSV Import Controls ───────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <h2 className="text-lg font-semibold">Calendar Entries</h2>
          <div className="flex gap-2 sm:ml-auto">
            <Tooltip text="Add a blackout date, early dismissal, or instructor exception">
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setAddForm({ ...EMPTY_FORM });
                }}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {showAddForm ? 'Cancel' : 'Add Entry'}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">New Calendar Entry</h3>
            {renderFormFields(
              addForm,
              setAddForm,
              handleAdd,
              () => {
                setShowAddForm(false);
                setAddForm({ ...EMPTY_FORM });
              },
              saving,
            )}
          </div>
        )}
      </section>

      {/* ── CSV Import ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">CSV Import</h2>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            CSV format: <code className="bg-muted/30 rounded px-1 py-0.5">date, description, status_type, early_dismissal_time</code>
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Tooltip text="Select a CSV file to import calendar entries">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted/30 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground file:cursor-pointer hover:file:bg-muted/50"
              />
            </Tooltip>
            <Tooltip text="Bulk import calendar entries from a CSV file">
              <button
                onClick={handleImport}
                disabled={importLoading}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importLoading ? 'Importing...' : 'Import CSV'}
              </button>
            </Tooltip>
          </div>
          {importResult && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              Imported {importResult.imported} entries, {importResult.skipped} skipped (of {importResult.total} total).
            </div>
          )}
        </div>
      </section>

      {/* ── Search & Filter ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tooltip text="Search entries by description or date">
          <input
            type="text"
            placeholder="Search by description or date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Tooltip>
        <Tooltip text="Filter entries by type" position="bottom">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as CalendarStatusType | 'all')}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Types</option>
            <option value="no_school">No School</option>
            <option value="early_dismissal">Early Dismissal</option>
            <option value="instructor_exception">Instructor Exception</option>
          </select>
        </Tooltip>
      </div>

      {/* ── Entries Table ─────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {entries.length === 0
              ? 'No calendar entries yet. Add one above or import a CSV.'
              : 'No entries match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                    Early Dismissal Time
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                    Instructor
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isDeleting = deletingId === entry.id;

                  if (isEditing) {
                    return (
                      <tr key={entry.id} className="border-b border-border bg-muted/20">
                        <td colSpan={6} className="px-4 py-4">
                          {renderFormFields(
                            editForm,
                            setEditForm,
                            handleEdit,
                            cancelEdit,
                            editSaving,
                          )}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {entry.description ?? '--'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status_type} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {entry.status_type === 'early_dismissal'
                          ? formatTime(entry.early_dismissal_time)
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {entry.instructor
                          ? `${entry.instructor.first_name} ${entry.instructor.last_name}`
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDeleting ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">Delete?</span>
                            <Tooltip text="Permanently delete this entry">
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deleteLoading}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {deleteLoading ? 'Deleting...' : 'Confirm'}
                              </button>
                            </Tooltip>
                            <Tooltip text="Cancel deletion">
                              <button
                                onClick={() => setDeletingId(null)}
                                disabled={deleteLoading}
                                className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                              >
                                Cancel
                              </button>
                            </Tooltip>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip text="Edit this calendar entry">
                              <button
                                onClick={() => startEdit(entry)}
                                className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                              >
                                Edit
                              </button>
                            </Tooltip>
                            <Tooltip text="Delete this calendar entry">
                              <button
                                onClick={() => setDeletingId(entry.id)}
                                className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                Delete
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count footer */}
      {!loading && sortedEntries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {sortedEntries.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
        </p>
      )}
    </div>
  );
}
