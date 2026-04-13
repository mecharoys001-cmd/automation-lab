'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useProgram } from '../ProgramContext';
import type { SchoolCalendar, CalendarStatusType, Instructor } from '@/types/database';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { Modal, ModalButton } from '../../components/ui/Modal';
import { CsvImportDialog, type CsvColumnDef, type ValidationError } from '../../components/ui/CsvImportDialog';
import type { CsvRow } from '@/lib/csvDedup';
import { requestCache } from '@/lib/requestCache';
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
  Ban,
  Clock,
  UserX,
  Eraser,
  XCircle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────

const STATUS_LABELS: Record<CalendarStatusType, string> = {
  no_school: 'No School',
  early_dismissal: 'Early Dismissal',
  instructor_exception: 'Staff Exception',
  asap_exception: 'ASAP! Exception',
};

const STATUS_COLORS: Record<CalendarStatusType, { badge: string; dot: string; cell: string }> = {
  no_school: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
    cell: 'bg-red-50 text-red-700 border border-red-200',
  },
  early_dismissal: {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    cell: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  instructor_exception: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
    cell: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  asap_exception: {
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-600',
    cell: 'bg-green-50 text-green-700 border border-green-200',
  },
};

const STATUS_TOOLTIPS: Record<CalendarStatusType, string> = {
  no_school: 'No events on this date',
  early_dismissal: 'Events end earlier than usual',
  instructor_exception: 'Schedule exception for a specific staff member',
  asap_exception: 'ASAP! program exception',
};

const CALENDAR_CSV_COLUMNS: CsvColumnDef[] = [
  { csvHeader: 'date', label: 'Date (YYYY-MM-DD)', required: true },
  { csvHeader: 'description', label: 'Description' },
  { csvHeader: 'status_type', label: 'Status Type', required: true },
  { csvHeader: 'early_dismissal_time', label: 'Early Dismissal Time' },
  { csvHeader: 'target_instructor_id', label: 'Target Staff ID' },
];

const CALENDAR_CSV_EXAMPLE = `date,description,status_type,early_dismissal_time,target_instructor_id
2026-09-01,Labor Day,no_school,,
2026-11-26,Thanksgiving Break,no_school,,
2026-12-23,Winter Break,no_school,,
2026-10-15,Parent-Teacher Conferences,early_dismissal,13:00,
2026-03-10,Staff PD - Mr. Smith,instructor_exception,,abc-123`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS_SET = new Set(['no_school', 'early_dismissal', 'instructor_exception', 'asap_exception']);

function validateCalendarCsvRow(row: CsvRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!row.date?.trim()) {
    errors.push({ row: rowIndex, column: 'date', message: 'Date is required' });
  } else if (!DATE_RE.test(row.date.trim())) {
    errors.push({ row: rowIndex, column: 'date', message: 'Date must be YYYY-MM-DD format' });
  }
  if (!row.status_type?.trim()) {
    errors.push({ row: rowIndex, column: 'status_type', message: 'Status type is required' });
  } else if (!VALID_STATUS_SET.has(row.status_type.trim())) {
    errors.push({ row: rowIndex, column: 'status_type', message: 'Must be no_school, early_dismissal, or instructor_exception' });
  }
  return errors;
}

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
      role="alert"
      aria-live="assertive"
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
  selectedDates,
  isDragging,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  year: number;
  month: number;
  calendarMap: Map<string, CalendarMapEntry[]>;
  today: Date;
  selectedDates: Set<string>;
  isDragging: boolean;
  onDayMouseDown: (dateStr: string, e: React.MouseEvent) => void;
  onDayMouseEnter: (dateStr: string) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Month header */}
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </h3>
        {isCurrentMonth && (
          <Tooltip text="This is the current calendar month">
            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full cursor-help">
              Current Month
            </span>
          </Tooltip>
        )}
      </div>

      {/* Day Headers + Day Cells — single flat grid */}
      <div className="grid grid-cols-7" style={{ width: '100%', minWidth: 0 }}>
        {/* Day Headers — pinned to grid-row 1 */}
        {DAY_HEADERS.map((d, idx) => (
          <div
            key={d}
            style={{ gridRow: 1 }}
            className={`px-0.5 sm:px-1.5 py-1.5 sm:py-2 text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider border-b border-slate-200 bg-white sticky top-0 z-10 box-border ${
              idx === 0 || idx === 6 ? 'text-slate-700' : 'text-slate-600'
            } ${idx < 6 ? 'border-r border-slate-200' : ''}`}
          >
            {d}
          </div>
        ))}
        {/* Day Cells — 42-cell grid */}
        {Array.from({ length: 42 }, (_, cellIndex) => {
          const day = cellIndex - firstDay + 1;

          // Empty cell before month starts or after month ends
          if (day < 1 || day > daysInMonth) {
            return <div key={cellIndex} className={`h-14 sm:h-16 border-b border-slate-200 bg-slate-50/40 ${cellIndex % 7 < 6 ? 'border-r border-slate-200' : ''}`} />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEntries = calendarMap.get(dateStr) ?? [];
          const dayOfWeek = cellIndex % 7;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

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

          const isSelected = selectedDates.has(dateStr);

          return (
            <Tooltip key={cellIndex} text={tooltipText} style={{ gridColumn: 'auto' }}>
              <div
                onMouseDown={(e) => onDayMouseDown(dateStr, e)}
                onMouseEnter={() => onDayMouseEnter(dateStr)}
                className={`h-14 sm:h-16 border-b border-slate-200 flex flex-col items-center justify-start pt-1 transition-colors cursor-pointer select-none box-border ${
                  dayOfWeek < 6 ? 'border-r border-slate-200' : ''
                } ${
                  isSelected
                    ? 'bg-blue-100 ring-2 ring-inset ring-blue-500'
                    : primaryStatus
                    ? STATUS_COLORS[primaryStatus].cell
                    : isToday
                    ? 'bg-blue-50'
                    : isWeekend
                    ? 'bg-slate-50/60'
                    : 'bg-white'
                } ${!isSelected && !primaryStatus ? 'hover:bg-slate-100' : ''}`}
              >
                {/* Day number */}
                <span
                  className={`text-xs font-medium leading-none inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : isSelected
                      ? 'text-blue-800 font-semibold'
                      : isWeekend
                      ? 'text-slate-700'
                      : 'text-slate-700'
                  }`}
                >
                  {day}
                </span>

                {/* Status details */}
                {dayEntries.length > 0 && (
                  <div className="flex flex-col items-center gap-0.5 mt-0.5 w-full px-1 overflow-hidden">
                    {dayEntries.slice(0, 2).map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-0.5 max-w-full">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_COLORS[entry.status_type].dot}`} />
                        <span className="text-[9px] leading-tight truncate">
                          {entry.status_type === 'early_dismissal' && entry.early_dismissal_time
                            ? formatTime(entry.early_dismissal_time)
                            : entry.description
                            ? entry.description
                            : STATUS_LABELS[entry.status_type]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tooltip>
          );
        })}
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
  exception_start_time: string;
  exception_end_time: string;
}

const EMPTY_FORM: EntryForm = {
  date: '',
  description: '',
  status_type: 'no_school',
  early_dismissal_time: '',
  target_instructor_id: '',
  exception_start_time: '',
  exception_end_time: '',
};

// ── Main page ────────────────────────────────────────────────

export default function CalendarPage() {
  const { selectedProgramId, selectedProgram } = useProgram();

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
  const [addDateError, setAddDateError] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({ ...EMPTY_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const editOriginalRef = useRef<EntryForm>({ ...EMPTY_FORM });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV import
  const [importOpen, setImportOpen] = useState(false);

  // Save / Publish / Generate state
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ action: 'draft' | 'published'; oldestVersion: number } | null>(null);

  // ── Batch selection state ────────────────────────────────────
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Batch action confirmation modal
  const [batchModal, setBatchModal] = useState<{
    action: CalendarStatusType | 'clear';
    dates: string[];
  } | null>(null);
  const [batchTime, setBatchTime] = useState('13:00');
  const [batchInstructorId, setBatchInstructorId] = useState('');
  const [batchInstructors, setBatchInstructors] = useState<Instructor[]>([]);
  const [batchApplying, setBatchApplying] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // Infinite scroll calendar
  const today = new Date();
  const [monthRange, setMonthRange] = useState(() => {
    // Fallback: start 2 months before current, show 8 months
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

  // When a program is selected, reset calendar to span program start→end dates
  useEffect(() => {
    if (!selectedProgram?.start_date) return;
    const [sY, sM] = selectedProgram.start_date.split('-').map(Number);
    const startYear = sY;
    const startMonth = sM - 1; // 0-indexed

    let count = 8; // default
    if (selectedProgram.end_date) {
      const [eY, eM] = selectedProgram.end_date.split('-').map(Number);
      // months from start to end, inclusive, plus 1 buffer month
      count = (eY - sY) * 12 + (eM - sM) + 2;
    }

    setMonthRange({ startYear, startMonth, count });
  }, [selectedProgram?.start_date, selectedProgram?.end_date]);

  // ── Fetch entries ────────────────────────────────────────────

  const fetchEntries = useCallback(async (invalidate = false) => {
    if (!selectedProgramId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    if (invalidate) requestCache.invalidate(/\/api\/calendar/);
    setLoading(true);
    setError(null);
    try {
      const data = await requestCache.fetch<{ entries?: SchoolCalendar[] }>(
        `/api/calendar?program_id=${selectedProgramId}`
      );
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

  // Reset cached instructors when program changes so they're re-fetched
  useEffect(() => {
    setBatchInstructors([]);
  }, [selectedProgramId]);

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

  const handleSaveVersion = async (status: 'draft' | 'published', allowOverwrite = false) => {
    const isDraft = status === 'draft';
    if (isDraft) setIsSaving(true); else setIsPublishing(true);
    try {
      const year = new Date().getFullYear();
      const url = `/api/versions/save?year=${year}${allowOverwrite ? '&allow_overwrite=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'SLOTS_FULL') {
          setConfirmOverwrite({ action: status, oldestVersion: body.oldest_version_number });
          return;
        }
        throw new Error(body.error || `Failed to ${isDraft ? 'save draft' : 'publish'}`);
      }
      await fetchEntries(true);
      setIsDirty(false);
      setToast({
        message: isDraft
          ? `Full-year schedule saved as draft (${year})`
          : `Full-year schedule published (${year})`,
        type: 'success',
        id: Date.now(),
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : `Failed to ${isDraft ? 'save draft' : 'publish'}. Please try again.`,
        type: 'error',
        id: Date.now(),
      });
    } finally {
      if (isDraft) setIsSaving(false); else setIsPublishing(false);
    }
  };

  const handleSaveDraft = () => handleSaveVersion('draft');
  const handlePublish = () => handleSaveVersion('published');

  const handleConfirmOverwrite = async () => {
    if (!confirmOverwrite) return;
    const { action } = confirmOverwrite;
    setConfirmOverwrite(null);
    await handleSaveVersion(action, true);
  };

  const handleGenerateSchedule = async () => {
    if (!selectedProgramId) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/scheduler/generate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: selectedProgramId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Generation failed');
      }
      await fetchEntries(true);
      setIsDirty(true);
      const count = body.sessions_created ?? 0;
      const unassigned = body.unassigned_count ?? 0;
      setToast({
        message: count > 0
          ? `${count} draft session${count !== 1 ? 's' : ''} generated${unassigned > 0 ? ` (${unassigned} unassigned)` : ''}`
          : 'No new sessions generated — check template dates and settings.',
        type: count > 0 ? 'success' : 'error',
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
    const priority: Record<CalendarStatusType, number> = { no_school: 0, early_dismissal: 1, instructor_exception: 2, asap_exception: 3 };
    for (const [, arr] of map) {
      arr.sort((a, b) => priority[a.status_type] - priority[b.status_type]);
    }
    return map;
  }, [entries]);

  // ── Add entry ────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.date) {
      setAddDateError(true);
      return;
    }
    setAddDateError(false);
    if (!selectedProgramId) return;
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
      await fetchEntries(true);
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
      exception_start_time: entry.exception_start_time ?? '',
      exception_end_time: entry.exception_end_time ?? '',
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
      await fetchEntries(true);
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
      await fetchEntries(true);
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

  // ── Scroll to today ──────────────────────────────────────────

  const scrollToToday = () => {
    const el = document.getElementById(`month-${today.getFullYear()}-${today.getMonth()}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── Auto-scroll to current month on mount ────────────────────
  const hasAutoScrolled = useRef(false);
  useEffect(() => {
    if (hasAutoScrolled.current || loading) return;
    const el = document.getElementById(`month-${today.getFullYear()}-${today.getMonth()}`);
    if (el) {
      // Use instant scroll on initial load so user sees current month immediately
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      hasAutoScrolled.current = true;
    }
  }, [loading, today]);

  // ── Day selection handlers (drag-to-select) ────────────────

  const handleDayMouseDown = useCallback((dateStr: string, e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    e.preventDefault();

    if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+click: toggle individual without clearing others
      setSelectedDates((prev) => {
        const next = new Set(prev);
        if (next.has(dateStr)) {
          next.delete(dateStr);
        } else {
          next.add(dateStr);
        }
        return next;
      });
    } else {
      // Plain click / start drag: clear others and select this day
      setSelectedDates(new Set([dateStr]));
    }

    // Start drag mode
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handleDayMouseEnter = useCallback((dateStr: string) => {
    if (!isDraggingRef.current) return;
    setSelectedDates((prev) => {
      if (prev.has(dateStr)) return prev;
      const next = new Set(prev);
      next.add(dateStr);
      return next;
    });
  }, []);

  // End drag on mouseup anywhere
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedDates(new Set());
  }, []);

  /** Select all visible days across all rendered months */
  const selectAllVisible = useCallback(() => {
    const allDates = new Set<string>();
    for (const { year, month } of months) {
      const days = getDaysInMonth(year, month);
      for (let d = 1; d <= days; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        allDates.add(dateStr);
      }
    }
    setSelectedDates(allDates);
  }, [months]);

  // ── Batch action handlers ──────────────────────────────────

  const openBatchModal = useCallback(async (action: CalendarStatusType | 'clear') => {
    const dates = Array.from(selectedDates).sort();
    setBatchModal({ action, dates });
    setBatchTime('13:00');
    setBatchInstructorId('');
    setBatchProgress(null);

    // Fetch instructors if needed for staff exception
    if (action === 'instructor_exception' && batchInstructors.length === 0 && selectedProgramId) {
      try {
        const data = await requestCache.fetch<{ instructors?: Instructor[] }>(
          `/api/staff?program_id=${selectedProgramId}&is_active=true`
        );
        setBatchInstructors(data.instructors ?? []);
      } catch {
        // Non-critical — user can still type an ID
      }
    }
  }, [selectedDates, batchInstructors.length, selectedProgramId]);

  const closeBatchModal = useCallback(() => {
    setBatchModal(null);
    setBatchApplying(false);
    setBatchProgress(null);
  }, []);

  const applyBatchAction = useCallback(async () => {
    if (!batchModal || !selectedProgramId) return;
    const { action, dates } = batchModal;
    setBatchApplying(true);

    try {
      if (action === 'clear') {
        // Delete existing entries for selected dates
        const entriesToDelete = entries.filter((e) => dates.includes(e.date));
        const total = entriesToDelete.length;
        if (total === 0) {
          setToast({ message: 'No entries to clear on selected dates', type: 'error', id: Date.now() });
          closeBatchModal();
          return;
        }
        setBatchProgress({ done: 0, total });
        let done = 0;
        for (const entry of entriesToDelete) {
          const res = await fetch(`/api/calendar/${entry.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`Failed to delete entry for ${entry.date}`);
          done++;
          if (total > 10) setBatchProgress({ done, total });
        }
        await fetchEntries(true);
        setIsDirty(true);
        setToast({ message: `${done} calendar entr${done !== 1 ? 'ies' : 'y'} cleared`, type: 'success', id: Date.now() });
      } else {
        // Create/update entries for selected dates
        const total = dates.length;
        setBatchProgress({ done: 0, total });
        let done = 0;

        for (const date of dates) {
          // Check if entry already exists for this date with same status
          const existing = entries.find((e) => e.date === date && e.status_type === action);
          const body: Record<string, unknown> = {
            program_id: selectedProgramId,
            date,
            description: null,
            status_type: action,
            early_dismissal_time: action === 'early_dismissal' ? batchTime || null : null,
            target_instructor_id: action === 'instructor_exception' ? batchInstructorId || null : null,
          };

          if (existing) {
            // Update existing
            const res = await fetch(`/api/calendar/${existing.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Failed to update entry for ${date}`);
          } else {
            // Create new
            const res = await fetch('/api/calendar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Failed to create entry for ${date}`);
          }
          done++;
          if (total > 10) setBatchProgress({ done, total });
        }
        await fetchEntries(true);
        setIsDirty(true);
        setToast({ message: `${done} calendar entr${done !== 1 ? 'ies' : 'y'} updated`, type: 'success', id: Date.now() });
      }

      clearSelection();
      closeBatchModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Batch operation failed';
      setToast({ message: msg, type: 'error', id: Date.now() });
      setBatchApplying(false);
      setBatchProgress(null);
    }
  }, [batchModal, selectedProgramId, entries, batchTime, batchInstructorId, fetchEntries, clearSelection, closeBatchModal]);

  // ── Keyboard shortcuts ─────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: clear selection
      if (e.key === 'Escape' && selectedDates.size > 0) {
        e.preventDefault();
        clearSelection();
      }
      // Cmd/Ctrl+A: select all visible days (only when not in an input)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        selectAllVisible();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedDates.size, clearSelection, selectAllVisible]);

  // Prevent text selection while dragging
  useEffect(() => {
    if (!isDragging) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [isDragging]);

  // ── Batch modal computed values ────────────────────────────

  const batchExistingCount = useMemo(() => {
    if (!batchModal) return 0;
    return batchModal.dates.filter((d) => entries.some((e) => e.date === d)).length;
  }, [batchModal, entries]);

  const BATCH_ACTION_LABELS: Record<CalendarStatusType | 'clear', string> = {
    no_school: 'No School',
    early_dismissal: 'Early Dismissal',
    instructor_exception: 'Staff Exception',
    asap_exception: 'ASAP! Exception',
    clear: 'Clear Status',
  };

  // ── No program selected ──────────────────────────────────────

  if (!selectedProgramId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center max-w-md">
          <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Program Calendar</h1>
          <p className="text-sm text-slate-600">
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
    dateError?: boolean,
    onDateErrorClear?: () => void,
  ) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Date <span className="text-red-700 ml-0.5">*</span>
            </label>
            <Tooltip text="Select the calendar entry date">
              <input
                type="date"
                value={form.date}
                onChange={(e) => {
                  setForm({ ...form, date: e.target.value });
                  if (e.target.value && dateError && onDateErrorClear) onDateErrorClear();
                }}
                className={`w-full h-10 rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 transition-colors ${
                  dateError
                    ? 'border-red-300 focus:ring-red-500/30 focus-visible:border-red-500'
                    : 'border-slate-200 focus-visible:ring-blue-500 focus-visible:border-blue-500'
                }`}
              />
            </Tooltip>
            {dateError && (
              <p className="text-xs text-red-700 font-medium">Date is required</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</label>
            <Tooltip text="Enter a description for this calendar event">
              <input
                type="text"
                placeholder="e.g. Winter Break"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
              />
            </Tooltip>
          </div>

          {/* Status type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</label>
            <Tooltip text="Choose the calendar event type">
              <select
                value={form.status_type}
                onChange={(e) => setForm({ ...form, status_type: e.target.value as CalendarStatusType })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
              >
                <option value="no_school">No School</option>
                <option value="early_dismissal">Early Dismissal</option>
                <option value="instructor_exception">Staff Exception</option>
              </select>
            </Tooltip>
          </div>

          {/* Early dismissal time (conditional) */}
          {form.status_type === 'early_dismissal' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Dismissal Time</label>
              <Tooltip text="Set the early dismissal time">
                <input
                  type="time"
                  value={form.early_dismissal_time}
                  onChange={(e) => setForm({ ...form, early_dismissal_time: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
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
            disabled={isSaving}
            tooltip={!form.date ? 'Date is required before saving' : 'Save school calendar date'}
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
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Program Calendar</h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage blackout dates, early dismissals, and staff exceptions.
              </p>
            </div>
            {isDirty && (
              <Tooltip text="You have unsaved changes">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  <span className="text-xs font-medium text-amber-800">Unsaved</span>
                </span>
              </Tooltip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              tooltip="Save calendar changes without publishing"
              onClick={handleSaveDraft}
              disabled={!isDirty || isSaving || isPublishing}
            >
              <span className="hidden md:inline">{isSaving ? 'Saving…' : 'Save as Draft'}</span>
              <span className="md:hidden">{isSaving ? '…' : 'Save'}</span>
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              tooltip="Save a published version of the school calendar"
              onClick={handlePublish}
              disabled={isDirty || isPublishing || isSaving || entries.length === 0}
            >
              <span className="hidden md:inline">{isPublishing ? 'Publishing…' : 'Publish Calendar'}</span>
              <span className="md:hidden">{isPublishing ? '…' : 'Publish'}</span>
            </Button>
            <div className="hidden sm:block w-px h-8 bg-slate-200" />
            <Button
              variant="secondary"
              size="md"
              icon={<Upload className="w-4 h-4" />}
              tooltip="Import calendar entries from a CSV file"
              onClick={() => setImportOpen(true)}
              disabled={isSaving || isPublishing}
            >
              <span className="hidden md:inline">Import CSV</span>
              <span className="md:hidden">Import</span>
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              tooltip="Add a blackout date, early dismissal, or staff exception"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setAddForm({ ...EMPTY_FORM });
                setAddDateError(false);
              }}
            >
              <span className="hidden md:inline">{showAddForm ? 'Cancel' : 'Add Entry'}</span>
              <span className="md:hidden">{showAddForm ? 'Cancel' : 'Add'}</span>
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <Tooltip text="Dismiss this error">
              <button onClick={() => setError(null)} className="text-red-700 hover:text-red-700 ml-4 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* ── Inline add form ────────────────────────────────── */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">New Calendar Entry</h2>
            {renderFormFields(
              addForm,
              setAddForm,
              handleAdd,
              () => {
                setShowAddForm(false);
                setAddForm({ ...EMPTY_FORM });
                setAddDateError(false);
              },
              saving,
              addDateError,
              () => setAddDateError(false),
            )}
          </div>
        )}

        {/* ── Scrollable Month Calendar (Infinite Scroll) ──── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Calendar Overview</h2>
              <Tooltip text="Months load automatically as you scroll up or down">
                <span className="hidden sm:inline text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full font-medium cursor-help">
                  Scroll for more
                </span>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip text="Jump to a specific month">
                <select
                  value=""
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    // Ensure the target month is in our rendered range
                    const targetDate = new Date(y, m, 1);
                    const rangeStart = new Date(monthRange.startYear, monthRange.startMonth, 1);
                    const rangeEnd = new Date(monthRange.startYear, monthRange.startMonth + monthRange.count, 1);
                    if (targetDate < rangeStart || targetDate >= rangeEnd) {
                      // Expand range to include target month centered
                      setMonthRange({
                        startYear: new Date(y, m - 4, 1).getFullYear(),
                        startMonth: new Date(y, m - 4, 1).getMonth(),
                        count: 12,
                      });
                    }
                    // Scroll to the month after a brief delay for DOM update
                    setTimeout(() => {
                      const el = document.getElementById(`month-${y}-${m}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-8 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors cursor-pointer appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="" disabled>Jump to month…</option>
                  {(() => {
                    const options = [];
                    const now = new Date();
                    for (let offset = -12; offset <= 12; offset++) {
                      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                      const y = d.getFullYear();
                      const m = d.getMonth();
                      options.push(
                        <option key={`${y}-${m}`} value={`${y}-${m}`}>
                          {MONTH_NAMES[m]} {y}
                        </option>
                      );
                    }
                    return options;
                  })()}
                </select>
              </Tooltip>
              <Tooltip text="Scroll to today's date in the calendar">
                <button
                  onClick={scrollToToday}
                  className="text-[13px] font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Today
                </button>
              </Tooltip>
            </div>
          </div>

          {loading ? (
            <CalendarSkeleton />
          ) : (
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
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
                    Staff Exception
                  </span>
                </Tooltip>
                <Tooltip text="Weekend days are subtly shaded">
                  <span className="flex items-center gap-1.5 cursor-help">
                    <span className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-200" />
                    Weekend
                  </span>
                </Tooltip>
              </div>

              {/* ── Batch actions toolbar (fixed at bottom so calendar doesn't shift) ── */}
              {selectedDates.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center gap-1.5 sm:gap-2 bg-blue-50 border border-blue-200 rounded-xl px-2.5 sm:px-4 py-2.5 sm:py-3 shadow-lg max-w-[calc(100vw-2rem)]">
                  <span className="text-xs sm:text-sm font-semibold text-blue-700 mr-0.5 sm:mr-1">
                    {selectedDates.size} day{selectedDates.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="w-px h-5 sm:h-6 bg-blue-200 mx-0.5 sm:mx-1" />
                  <Tooltip text="Mark selected days as No School — no events will be scheduled">
                    <button
                      onClick={() => openBatchModal('no_school')}
                      className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Mark as No School</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Mark selected days as Early Dismissal — events end earlier than usual">
                    <button
                      onClick={() => openBatchModal('early_dismissal')}
                      className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Mark as Early Dismissal</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Mark selected days as Staff Exception — schedule exception for a specific staff member">
                    <button
                      onClick={() => openBatchModal('instructor_exception')}
                      className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Mark as Staff Exception</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Remove all status entries from selected days">
                    <button
                      onClick={() => openBatchModal('clear')}
                      className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      <Eraser className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Clear Status</span>
                    </button>
                  </Tooltip>
                  <div className="w-px h-5 sm:h-6 bg-blue-200 mx-0.5 sm:mx-1" />
                  <Tooltip text="Deselect all days">
                    <button
                      onClick={clearSelection}
                      className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Deselect All</span>
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* Scrollable month grid */}
              <div
                ref={scrollContainerRef}
                className="max-h-[600px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 sm:p-4 space-y-4 sm:space-y-5 scroll-smooth"
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
                      selectedDates={selectedDates}
                      isDragging={isDragging}
                      onDayMouseDown={handleDayMouseDown}
                      onDayMouseEnter={handleDayMouseEnter}
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
            <Tooltip text="Manage holidays, closures, early dismissals, and special events">
              <span className="cursor-help">Special Dates</span>
            </Tooltip>
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Tooltip text="Search entries by description or date">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Search calendar entries"
                  placeholder="Search by description or date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
                />
              </div>
            </Tooltip>
            <Tooltip text="Filter entries by type" position="bottom">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 pointer-events-none" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as CalendarStatusType | 'all')}
                  className="h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="all">All Types</option>
                  <option value="no_school">No School</option>
                  <option value="early_dismissal">Early Dismissal</option>
                  <option value="instructor_exception">Staff Exception</option>
                </select>
              </div>
            </Tooltip>
          </div>

          {/* ── Entries Table ───────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <TableSkeleton rows={6} />
            ) : sortedEntries.length === 0 ? (
              <div className="p-12 text-center text-slate-700">
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
                        <th scope="col" className="text-left px-4 py-3 text-[12px] font-semibold text-slate-600 uppercase tracking-wider cursor-help">Date</th>
                      </Tooltip>
                      <Tooltip text="Description of the calendar event">
                        <th scope="col" className="text-left px-4 py-3 text-[12px] font-semibold text-slate-600 uppercase tracking-wider cursor-help">Description</th>
                      </Tooltip>
                      <Tooltip text="Event type: No School, Early Dismissal, or Staff Exception">
                        <th scope="col" className="text-left px-4 py-3 text-[12px] font-semibold text-slate-600 uppercase tracking-wider cursor-help">Type</th>
                      </Tooltip>
                      <Tooltip text="Time of early dismissal (if applicable)">
                        <th scope="col" className="text-left px-4 py-3 text-[12px] font-semibold text-slate-600 uppercase tracking-wider hidden sm:table-cell cursor-help">
                          Dismissal Time
                        </th>
                      </Tooltip>
                      <Tooltip text="Staff member affected by this exception">
                        <th scope="col" className="text-left px-4 py-3 text-[12px] font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell cursor-help">
                          Staff
                        </th>
                      </Tooltip>
                      <Tooltip text="Edit or delete calendar entries">
                        <th scope="col" className="px-4 py-3 text-[12px] font-semibold text-slate-600 uppercase tracking-wider text-right cursor-help">Actions</th>
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
                                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                                      <span className="text-xs font-medium text-amber-800">Unsaved changes</span>
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
                          <td className="px-4 py-3 text-slate-600">
                            {entry.description ?? '--'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={entry.status_type} />
                          </td>
                          <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                            {entry.status_type === 'early_dismissal'
                              ? formatTime(entry.early_dismissal_time)
                              : '--'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                            {entry.instructor
                              ? `${entry.instructor.first_name} ${entry.instructor.last_name}`
                              : '--'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isDeleting ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-slate-700">Delete?</span>
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
                                    className="p-1.5 rounded-md text-slate-700 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                                    aria-label="Edit this calendar entry"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                                <Tooltip text="Delete this calendar entry">
                                  <button
                                    onClick={() => setDeletingId(entry.id)}
                                    className="p-1.5 rounded-md text-slate-700 hover:text-red-700 hover:bg-red-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                                    aria-label="Delete this calendar entry"
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
              <p className="text-xs text-slate-700 mt-3 cursor-help">
                Showing {sortedEntries.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
              </p>
            </Tooltip>
          )}
        </section>
      </div>

      {/* ── Batch Confirmation Modal ──────────────────────── */}
      <Modal
        open={!!batchModal}
        onClose={closeBatchModal}
        title={batchModal ? `Apply ${BATCH_ACTION_LABELS[batchModal.action]} to ${batchModal.dates.length} day${batchModal.dates.length !== 1 ? 's' : ''}?` : ''}
        width="520px"
        disableBackdropClose={batchApplying}
        footer={
          <>
            <ModalButton variant="secondary" onClick={closeBatchModal} disabled={batchApplying}>
              Cancel
            </ModalButton>
            <ModalButton
              variant={batchModal?.action === 'clear' ? 'danger' : 'primary'}
              onClick={applyBatchAction}
              loading={batchApplying}
              disabled={batchApplying || (batchModal?.action === 'instructor_exception' && !batchInstructorId)}
            >
              {batchApplying
                ? batchProgress
                  ? `Applying (${batchProgress.done}/${batchProgress.total})…`
                  : 'Applying…'
                : `Apply to ${batchModal?.dates.length ?? 0} selected day${(batchModal?.dates.length ?? 0) !== 1 ? 's' : ''}`}
            </ModalButton>
          </>
        }
      >
        <div className="px-6 py-5 space-y-4">
          {/* Warning for existing statuses */}
          {batchExistingCount > 0 && batchModal?.action !== 'clear' && (
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {batchExistingCount} of {batchModal?.dates.length} day{(batchModal?.dates.length ?? 0) !== 1 ? 's' : ''} already
                {batchExistingCount === 1 ? ' has' : ' have'} a status. Existing entries will be updated.
              </p>
            </div>
          )}

          {/* Early dismissal time input */}
          {batchModal?.action === 'early_dismissal' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Dismissal Time <span className="text-red-700 ml-0.5">*</span>
              </label>
              <p className="text-xs text-slate-700">This time will be applied to all selected days.</p>
              <input
                type="time"
                value={batchTime}
                onChange={(e) => setBatchTime(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
              />
            </div>
          )}

          {/* Instructor selection */}
          {batchModal?.action === 'instructor_exception' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Staff Member <span className="text-red-700 ml-0.5">*</span>
              </label>
              <p className="text-xs text-slate-700">Select the staff member for this exception.</p>
              <select
                value={batchInstructorId}
                onChange={(e) => setBatchInstructorId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
              >
                <option value="">
                  {batchInstructors.length === 0 ? 'Loading staff…' : 'Select staff member…'}
                </option>
                {batchInstructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.first_name} {inst.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dates list */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Affected Dates
            </label>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
              {batchModal?.dates.map((d) => {
                const existing = entries.filter((e) => e.date === d);
                return (
                  <div
                    key={d}
                    className="flex items-center justify-between px-3 py-2 border-b border-slate-100 last:border-0 text-sm"
                  >
                    <span className="font-medium text-slate-700">{formatDate(d)}</span>
                    {existing.length > 0 && (
                      <span className="text-xs text-slate-700">
                        {existing.map((e) => STATUS_LABELS[e.status_type]).join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress bar for large batches */}
          {batchApplying && batchProgress && batchProgress.total > 10 && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((batchProgress.done / batchProgress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-700 text-center">
                {batchProgress.done} of {batchProgress.total} processed
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Program Calendar from CSV"
        columns={CALENDAR_CSV_COLUMNS}
        validateRow={validateCalendarCsvRow}
        onImport={async (csvRows: CsvRow[]) => {
          const mapped = csvRows.map((r) => ({
            date: r.date?.trim() || '',
            description: r.description?.trim() || '',
            status_type: r.status_type?.trim() || '',
            early_dismissal_time: r.early_dismissal_time?.trim() || '',
            target_instructor_id: r.target_instructor_id?.trim() || '',
          }));
          const res = await fetch('/api/calendar/import', {
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
            await fetchEntries(true);
            setIsDirty(true);
            setToast({ message: `Imported ${result.imported} calendar entries`, type: 'success', id: Date.now() });
          }
          return result;
        }}
        exampleCsv={CALENDAR_CSV_EXAMPLE}
        templateFilename="school-calendar.csv"
        dateRangeStart={selectedProgram?.start_date}
        dateRangeEnd={selectedProgram?.end_date}
        dateColumnName="date"
      />

      {/* Toast notifications */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Version Slot Overwrite Confirmation Modal */}
      <Modal
        open={!!confirmOverwrite}
        onClose={() => setConfirmOverwrite(null)}
        title="All version slots are full"
        width={480}
        footer={
          confirmOverwrite ? (
            <>
              <ModalButton variant="secondary" onClick={() => setConfirmOverwrite(null)}>
                Cancel
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleConfirmOverwrite}
              >
                Overwrite Oldest Version
              </ModalButton>
            </>
          ) : undefined
        }
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            All 5 version slots for {new Date().getFullYear()} are in use. Saving will <strong>permanently overwrite</strong> the
            oldest version (v{confirmOverwrite?.oldestVersion}).
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>This cannot be undone.</strong> If you need to keep all existing versions, consider
              deleting one first from the Versions page.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
