'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProgram } from '../ProgramContext';
import type { SchoolCalendar, CalendarStatusType, Instructor } from '@/types/database';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  Search,
  Filter,
  X,
  Pencil,
  Trash2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Save,
  Send,
  Wand2,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────

const STATUS_LABELS: Record<CalendarStatusType, string> = {
  no_school: 'No School',
  early_dismissal: 'Early Dismissal',
  instructor_exception: 'Instructor Exception',
};

const STATUS_COLORS: Record<CalendarStatusType, { badge: string; dot: string; cell: string }> = {
  no_school: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
    cell: 'bg-red-50 text-red-700 border border-red-200',
  },
  early_dismissal: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    cell: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  instructor_exception: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    cell: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
};

const STATUS_TOOLTIPS: Record<CalendarStatusType, string> = {
  no_school: 'No events on this date',
  early_dismissal: 'Events end earlier than usual',
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
    <div className="space-y-2 animate-pulse p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-8 w-48 rounded-lg bg-slate-100 mx-auto" />
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="h-5 rounded bg-slate-100" />
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-[52px] rounded-lg bg-slate-100" />
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
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status].badge}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[status].dot}`} />
        {STATUS_LABELS[status]}
      </span>
    </Tooltip>
  );
}

// ── Toast Notification ───────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  console.log('[TOAST] Toast rendered:', toast.message, 'type:', toast.type);
  
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {isSuccess ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

// ── Types for calendar map entries ────────────────────────────

type CalendarMapEntry = {
  status_type: CalendarStatusType;
  description: string | null;
  early_dismissal_time: string | null;
  instructor?: { first_name: string; last_name: string } | null;
};

// ── Day headers ──────────────────────────────────────────────

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// ── Single month grid for infinite scroll view ───────────────

function MonthGrid({
  year,
  month,
  calendarMap,
  today,
}: {
  year: number;
  month: number;
  calendarMap: Map<string, CalendarMapEntry[]>;
  today: Date;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  // Calculate total cells needed for complete rows (always fill last row)
  const totalCells = firstDay + daysInMonth;
  const totalRows = Math.ceil(totalCells / 7);
  const trailingBlanks = totalRows * 7 - totalCells;

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Month header */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </h3>
        {isCurrentMonth && (
          <Tooltip text="This is the current calendar month">
            <span className="text-[11px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full cursor-help">
              Current Month
            </span>
          </Tooltip>
        )}
      </div>

      <div className="p-3">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 mb-0.5">
          {DAY_HEADERS.map((d, i) => (
            <Tooltip key={d} text={DAY_FULL_NAMES[i]}>
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider text-center py-2 ${
                  i === 0 || i === 6 ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {d}
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Day cells grid */}
        <div className="grid grid-cols-7">
          {/* Leading blanks */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`blank-s-${i}`} className="min-h-[52px] border-b border-r border-slate-50 bg-slate-25" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEntries = calendarMap.get(dateStr) ?? [];
            const colIndex = (firstDay + i) % 7;
            const isWeekend = colIndex === 0 || colIndex === 6;

            const isToday =
              year === today.getFullYear() &&
              month === today.getMonth() &&
              day === today.getDate();

            // Build tooltip text from events
            let tooltipText = `${MONTH_NAMES[month]} ${day}, ${year}`;
            if (dayEntries.length > 0) {
              const eventLines = dayEntries.map((e) => {
                let line = `${STATUS_LABELS[e.status_type]}`;
                if (e.description) line += `: ${e.description}`;
                if (e.status_type === 'early_dismissal' && e.early_dismissal_time) {
                  line += ` (${formatTime(e.early_dismissal_time)})`;
                }
                if (e.instructor) {
                  line += ` — ${e.instructor.first_name} ${e.instructor.last_name}`;
                }
                return line;
              });
              tooltipText += `\n${eventLines.join('\n')}`;
            }

            // Determine highest-priority status for cell background
            const primaryStatus = dayEntries.find((e) => e.status_type === 'no_school')?.status_type
              ?? dayEntries[0]?.status_type
              ?? null;

            let cellBg = isWeekend ? 'bg-slate-50/50' : 'bg-white';
            if (primaryStatus) {
              cellBg = STATUS_COLORS[primaryStatus].cell;
            }

            return (
              <Tooltip key={day} text={tooltipText}>
                <div
                  className={`min-h-[52px] border-b border-r border-slate-100 px-1 py-0.5 transition-colors cursor-default ${cellBg} ${
                    !primaryStatus ? 'hover:bg-slate-50' : ''
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium leading-none inline-flex items-center justify-center w-5 h-5 rounded-full ${
                        isToday
                          ? 'bg-blue-500 text-white font-bold'
                          : isWeekend
                          ? 'text-slate-400'
                          : 'text-slate-700'
                      }`}
                    >
                      {day}
                    </span>
                    {dayEntries.length > 1 && (
                      <span className="text-[9px] text-slate-400 font-medium">
                        +{dayEntries.length}
                      </span>
                    )}
                  </div>

                  {/* Event indicators */}
                  {dayEntries.length > 0 && (
                    <div className="mt-0.5 space-y-px overflow-hidden">
                      {dayEntries.slice(0, 2).map((entry, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-0.5 rounded px-0.5 py-px ${
                            primaryStatus && idx === 0 ? '' : 'bg-opacity-60'
                          }`}
                        >
                          <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${STATUS_COLORS[entry.status_type].dot}`} />
                          <span className="text-[9px] leading-tight truncate font-medium text-slate-600">
                            {entry.description
                              ? entry.description.length > 12
                                ? entry.description.slice(0, 12) + '...'
                                : entry.description
                              : STATUS_LABELS[entry.status_type]}
                          </span>
                        </div>
                      ))}
                      {dayEntries.length > 2 && (
                        <span className="text-[8px] text-slate-400 pl-0.5">
                          +{dayEntries.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Tooltip>
            );
          })}

          {/* Trailing blanks to complete the last row */}
          {Array.from({ length: trailingBlanks }).map((_, i) => (
            <div key={`blank-e-${i}`} className="min-h-[52px] border-b border-r border-slate-50 bg-slate-25" />
          ))}
        </div>
      </div>
    </div>
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
  const editOriginalRef = useRef<EntryForm>({ ...EMPTY_FORM });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  // Save / Publish / Generate state
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Infinite scroll calendar
  const today = new Date();
  const [monthRange, setMonthRange] = useState(() => {
    // Start 2 months before current, show 6 months initially
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return {
      startYear: start.getFullYear(),
      startMonth: start.getMonth(),
      count: 8,
    };
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // ── Fetch entries ────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    console.log('[FETCH] A. fetchEntries called, selectedProgramId:', selectedProgramId);
    if (!selectedProgramId) {
      console.log('[FETCH] B. No selectedProgramId, returning early');
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    console.log('[FETCH] C. About to fetch from API');
    try {
      const res = await fetch(`/api/calendar?program_id=${selectedProgramId}`);
      console.log('[FETCH] D. API response received, status:', res.status);
      if (!res.ok) throw new Error('Failed to load calendar entries');
      const data = await res.json();
      console.log('[FETCH] E. Data parsed, entries count:', data.entries?.length ?? 0);
      setEntries(data.entries ?? []);
      console.log('[FETCH] F. Entries state updated successfully');
    } catch (err) {
      console.error('[FETCH] ERROR:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      console.log('[FETCH] G. fetchEntries completed');
    }
  }, [selectedProgramId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Warn on navigate-away when there are unsaved changes ────
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Save / Publish / Generate handlers ──────────────────────

  const handleSaveDraft = async () => {
    console.log('[SAVE] 1. handleSaveDraft started');
    setIsSaving(true);
    console.log('[SAVE] 2. isSaving set to true');
    try {
      // Persist a full-year version snapshot via the versions API
      const year = new Date().getFullYear();
      console.log('[SAVE] 3. Saving full-year version snapshot for', year);
      const res = await fetch(`/api/versions/save?year=${year}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save version');
      }
      console.log('[SAVE] 4. Version saved, re-fetching entries');
      await fetchEntries();
      console.log('[SAVE] 5. fetchEntries() completed successfully');
      setIsDirty(false);
      console.log('[SAVE] 6. isDirty set to false');
      setToast({ message: `Full-year schedule saved as draft (${year})`, type: 'success', id: Date.now() });
    } catch (err) {
      console.error('[SAVE] ERROR in catch block:', err);
      setToast({ message: 'Failed to save draft. Please try again.', type: 'error', id: Date.now() });
    } finally {
      setIsSaving(false);
      console.log('[SAVE] 7. Finally block - isSaving set to false');
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`/api/versions/save?year=${year}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to publish');
      }
      setIsDirty(false);
      setToast({ message: `Full-year schedule published (${year})`, type: 'success', id: Date.now() });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to publish schedule. Please try again.',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!selectedProgramId) return;
    setIsGenerating(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch('/api/sessions/generate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: selectedProgramId, year }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Generation failed');
      }
      await fetchEntries();
      setIsDirty(true);
      const count = body.total_generated ?? 0;
      setToast({
        message: count > 0
          ? `${count} draft session${count !== 1 ? 's' : ''} generated for ${year}`
          : 'No new sessions generated — templates may already be scheduled.',
        type: 'success',
        id: Date.now(),
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to generate schedule. Please try again.',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Infinite scroll observers ──────────────────────────────

  useEffect(() => {
    const container = scrollContainerRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!container || !topEl || !bottomEl) return;

    const observer = new IntersectionObserver(
      (ents) => {
        for (const entry of ents) {
          if (entry.isIntersecting && entry.target === bottomEl) {
            setMonthRange((prev) => ({ ...prev, count: prev.count + 3 }));
          }
          if (entry.isIntersecting && entry.target === topEl) {
            setMonthRange((prev) => {
              const d = new Date(prev.startYear, prev.startMonth - 3, 1);
              return {
                startYear: d.getFullYear(),
                startMonth: d.getMonth(),
                count: prev.count + 3,
              };
            });
          }
        }
      },
      { root: container, rootMargin: '200px' },
    );

    observer.observe(topEl);
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, []);

  // ── Generate month list for infinite scroll ─────────────────

  const months = useMemo(() => {
    const result: { year: number; month: number }[] = [];
    for (let i = 0; i < monthRange.count; i++) {
      const d = new Date(monthRange.startYear, monthRange.startMonth + i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  }, [monthRange]);

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

  const sortedEntries = useMemo(() => {
    return [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // ── Calendar overlay data ────────────────────────────────────

  const calendarMap = useMemo(() => {
    const map = new Map<string, CalendarMapEntry[]>();
    for (const entry of entries) {
      const existing = map.get(entry.date) ?? [];
      existing.push({
        status_type: entry.status_type,
        description: entry.description,
        early_dismissal_time: entry.early_dismissal_time,
        instructor: entry.instructor
          ? { first_name: entry.instructor.first_name, last_name: entry.instructor.last_name }
          : null,
      });
      map.set(entry.date, existing);
    }
    // Sort entries within each day: no_school first, then early_dismissal, then instructor_exception
    const priority: Record<CalendarStatusType, number> = { no_school: 0, early_dismissal: 1, instructor_exception: 2 };
    for (const [, arr] of map) {
      arr.sort((a, b) => priority[a.status_type] - priority[b.status_type]);
    }
    return map;
  }, [entries]);

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
      setIsDirty(true);
      setToast({ message: 'Calendar entry added', type: 'success', id: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create entry';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
    } finally {
      setSaving(false);
    }
  };

  // ── Edit entry ───────────────────────────────────────────────

  // Track whether inline edit form has unsaved modifications
  const isEditDirty = editingId !== null && (
    editForm.date !== editOriginalRef.current.date ||
    editForm.description !== editOriginalRef.current.description ||
    editForm.status_type !== editOriginalRef.current.status_type ||
    editForm.early_dismissal_time !== editOriginalRef.current.early_dismissal_time ||
    editForm.target_instructor_id !== editOriginalRef.current.target_instructor_id
  );

  const startEdit = (entry: SchoolCalendar) => {
    // Warn if current inline edit has unsaved changes
    if (editingId && isEditDirty) {
      if (!window.confirm('You have unsaved changes to the current entry. Discard them?')) {
        return;
      }
    }
    const formValues: EntryForm = {
      date: entry.date,
      description: entry.description ?? '',
      status_type: entry.status_type,
      early_dismissal_time: entry.early_dismissal_time ?? '',
      target_instructor_id: entry.target_instructor_id ?? '',
    };
    editOriginalRef.current = { ...formValues };
    setEditingId(entry.id);
    setEditForm(formValues);
  };

  const cancelEdit = () => {
    // Warn if inline edit has unsaved changes
    if (isEditDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setEditingId(null);
    setEditForm({ ...EMPTY_FORM });
    editOriginalRef.current = { ...EMPTY_FORM };
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
      // Reset original ref so cancelEdit doesn't trigger dirty warning
      editOriginalRef.current = { ...editForm };
      cancelEdit();
      await fetchEntries();
      setIsDirty(true);
      setToast({ message: 'Calendar entry updated', type: 'success', id: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update entry';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
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
      setIsDirty(true);
      setToast({ message: 'Calendar entry deleted', type: 'success', id: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
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
      if (data.imported > 0) setIsDirty(true);
      setToast({ message: `Imported ${data.imported} calendar entries`, type: 'success', id: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
    } finally {
      setImportLoading(false);
    }
  };

  // ── Scroll to today ──────────────────────────────────────────

  const scrollToToday = () => {
    const el = document.getElementById(`month-${today.getFullYear()}-${today.getMonth()}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── No program selected ──────────────────────────────────────

  if (!selectedProgramId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-md">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">School Calendar</h1>
          <p className="text-sm text-slate-500">
            Select a program to manage its calendar entries.
          </p>
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
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
            <Tooltip text="Select the calendar entry date">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
            <Tooltip text="Enter a description for this calendar event">
              <input
                type="text"
                placeholder="e.g. Winter Break"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Status type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</label>
            <Tooltip text="Choose the calendar event type">
              <select
                value={form.status_type}
                onChange={(e) => setForm({ ...form, status_type: e.target.value as CalendarStatusType })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              >
                <option value="no_school">No School</option>
                <option value="early_dismissal">Early Dismissal</option>
                <option value="instructor_exception">Instructor Exception</option>
              </select>
            </Tooltip>
          </div>

          {/* Early dismissal time (conditional) */}
          {form.status_type === 'early_dismissal' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dismissal Time</label>
              <Tooltip text="Set the early dismissal time">
                <input
                  type="time"
                  value={form.early_dismissal_time}
                  onChange={(e) => setForm({ ...form, early_dismissal_time: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
              </Tooltip>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={onSave}
            disabled={isSaving || !form.date}
            tooltip="Save school calendar date"
            icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={isSaving} tooltip="Discard changes and close form">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8 space-y-8">
        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">School Calendar</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage blackout dates, early dismissals, and instructor exceptions.
              </p>
            </div>
            {isDirty && (
              <Tooltip text="You have unsaved changes">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-medium text-amber-600">Unsaved</span>
                </span>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              tooltip="Save calendar changes without publishing"
              onClick={handleSaveDraft}
              disabled={!isDirty || isSaving || isPublishing || isGenerating}
            >
              {isSaving ? 'Saving…' : 'Save as Draft'}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              tooltip="Publish all changes to the live schedule"
              onClick={handlePublish}
              disabled={isDirty || isPublishing || isSaving || isGenerating || entries.length === 0}
            >
              {isPublishing ? 'Publishing…' : 'Publish Schedule'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              tooltip="Generate calendar from templates"
              onClick={handleGenerateSchedule}
              disabled={isGenerating || isSaving || isPublishing}
            >
              {isGenerating ? 'Generating…' : 'Generate Schedule'}
            </Button>
            <div className="w-px h-8 bg-slate-200" />
            <Button
              variant="secondary"
              size="md"
              icon={importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              tooltip="Import calendar entries from a CSV file"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading || isSaving || isPublishing || isGenerating}
            >
              {importLoading ? 'Importing…' : 'Import CSV'}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              tooltip="Add a blackout date, early dismissal, or instructor exception"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setAddForm({ ...EMPTY_FORM });
              }}
            >
              {showAddForm ? 'Cancel' : 'Add Entry'}
            </Button>
          </div>
        </div>

        {/* Hidden file input for CSV */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImport}
        />

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <Tooltip text="Dismiss this error">
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
            <span>
              Imported {importResult.imported} entries, {importResult.skipped} skipped (of {importResult.total} total).
            </span>
            <Tooltip text="Dismiss">
              <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-emerald-600 ml-4 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* ── Inline add form ────────────────────────────────── */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">New Calendar Entry</h3>
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

        {/* ── Scrollable Month Calendar (Infinite Scroll) ──── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Calendar Overview</h2>
              <Tooltip text="Months load automatically as you scroll up or down">
                <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium cursor-help">
                  Scroll for more
                </span>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip text="Navigate to earlier months">
                <button
                  onClick={() =>
                    setMonthRange((prev) => {
                      const d = new Date(prev.startYear, prev.startMonth - 6, 1);
                      return { startYear: d.getFullYear(), startMonth: d.getMonth(), count: prev.count + 6 };
                    })
                  }
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Load earlier months"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip text="Scroll to today's date in the calendar">
                <button
                  onClick={scrollToToday}
                  className="text-[13px] font-medium text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md transition-colors"
                >
                  Today
                </button>
              </Tooltip>
              <Tooltip text="Navigate to later months">
                <button
                  onClick={() =>
                    setMonthRange((prev) => ({ ...prev, count: prev.count + 6 }))
                  }
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Load later months"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <Tooltip text={STATUS_TOOLTIPS.no_school}>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="h-3 w-3 rounded-sm bg-red-100 border border-red-200" />
                    No School
                  </span>
                </Tooltip>
                <Tooltip text={STATUS_TOOLTIPS.early_dismissal}>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-200" />
                    Early Dismissal
                  </span>
                </Tooltip>
                <Tooltip text={STATUS_TOOLTIPS.instructor_exception}>
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="h-3 w-3 rounded-sm bg-blue-100 border border-blue-200" />
                    Instructor Exception
                  </span>
                </Tooltip>
                <Tooltip text="Today's date is highlighted with a blue circle">
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="h-3 w-3 rounded-full bg-blue-500" />
                    Today
                  </span>
                </Tooltip>
                <Tooltip text="Weekend days are subtly shaded">
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-200" />
                    Weekend
                  </span>
                </Tooltip>
              </div>

              {/* Scrollable month grid */}
              <div
                ref={scrollContainerRef}
                className="max-h-[600px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-5 scroll-smooth"
              >
                {/* Top sentinel for loading earlier months */}
                <div ref={topSentinelRef} className="h-1" />

                {months.map(({ year, month }) => (
                  <div key={`${year}-${month}`} id={`month-${year}-${month}`}>
                    <MonthGrid
                      year={year}
                      month={month}
                      calendarMap={calendarMap}
                      today={today}
                    />
                  </div>
                ))}

                {/* Bottom sentinel for loading more months */}
                <div ref={bottomSentinelRef} className="h-1" />
              </div>
            </div>
          )}
        </section>

        {/* ── Search & Filter ──────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            <Tooltip text="List of all calendar entries for this program">
              <span className="cursor-help">Calendar Entries</span>
            </Tooltip>
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Tooltip text="Search entries by description or date">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by description or date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                />
              </div>
            </Tooltip>
            <Tooltip text="Filter entries by type" position="bottom">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as CalendarStatusType | 'all')}
                  className="h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors appearance-none"
                >
                  <option value="all">All Types</option>
                  <option value="no_school">No School</option>
                  <option value="early_dismissal">Early Dismissal</option>
                  <option value="instructor_exception">Instructor Exception</option>
                </select>
              </div>
            </Tooltip>
          </div>

          {/* ── Entries Table ───────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <TableSkeleton rows={6} />
            ) : sortedEntries.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                {entries.length === 0
                  ? 'No calendar entries yet. Add one above or import a CSV.'
                  : 'No entries match your filters.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <Tooltip text="Date of the calendar event">
                        <th className="text-left px-4 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider cursor-help">Date</th>
                      </Tooltip>
                      <Tooltip text="Description of the calendar event">
                        <th className="text-left px-4 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider cursor-help">Description</th>
                      </Tooltip>
                      <Tooltip text="Event type: No School, Early Dismissal, or Instructor Exception">
                        <th className="text-left px-4 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider cursor-help">Type</th>
                      </Tooltip>
                      <Tooltip text="Time of early dismissal (if applicable)">
                        <th className="text-left px-4 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell cursor-help">
                          Dismissal Time
                        </th>
                      </Tooltip>
                      <Tooltip text="Instructor affected by this exception">
                        <th className="text-left px-4 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell cursor-help">
                          Instructor
                        </th>
                      </Tooltip>
                      <Tooltip text="Edit or delete calendar entries">
                        <th className="px-4 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider text-right cursor-help">Actions</th>
                      </Tooltip>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry) => {
                      const isEditing = editingId === entry.id;
                      const isDeleting = deletingId === entry.id;

                      if (isEditing) {
                        return (
                          <tr key={entry.id} className="border-b border-slate-200 bg-blue-50/30">
                            <td colSpan={6} className="px-4 py-4">
                              {isEditDirty && (
                                <div className="flex items-center gap-1.5 mb-3">
                                  <Tooltip text="You have unsaved changes to this entry">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                      <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
                                    </span>
                                  </Tooltip>
                                </div>
                              )}
                              {renderFormFields(editForm, setEditForm, handleEdit, cancelEdit, editSaving)}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {entry.description ?? '--'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={entry.status_type} />
                          </td>
                          <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                            {entry.status_type === 'early_dismissal'
                              ? formatTime(entry.early_dismissal_time)
                              : '--'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                            {entry.instructor
                              ? `${entry.instructor.first_name} ${entry.instructor.last_name}`
                              : '--'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isDeleting ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-slate-400">Delete?</span>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDelete(entry.id)}
                                  disabled={deleteLoading}
                                  tooltip="Permanently delete this entry"
                                  icon={deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                                >
                                  {deleteLoading ? 'Deleting…' : 'Confirm'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setDeletingId(null)}
                                  disabled={deleteLoading}
                                  tooltip="Cancel deletion"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip text="Edit this calendar entry">
                                  <button
                                    onClick={() => startEdit(entry)}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                                <Tooltip text="Delete this calendar entry">
                                  <button
                                    onClick={() => setDeletingId(entry.id)}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
            <Tooltip text="Filtered results — adjust search or filter to see more">
              <p className="text-xs text-slate-400 mt-3 cursor-help">
                Showing {sortedEntries.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
              </p>
            </Tooltip>
          )}
        </section>
      </div>

      {/* Toast notifications */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
