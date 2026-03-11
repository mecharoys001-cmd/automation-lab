'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Clock,
  User as UserIcon,
  Sparkles,
  Loader2,
  Trash2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { showToast } from '../lib/toast';
import { Button } from '../components/ui/Button';
import { ViewToggle } from '../components/ui/ViewToggle';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { FilterBar } from '../components/layout/FilterBar';
import type { ActiveFilters } from '../components/layout/FilterBar';
import { WeekView } from '../components/calendar/WeekView';
import type { EventTemplate } from '../components/calendar/WeekView';
import { MonthView } from '../components/calendar/MonthView';
import { DayView } from '../components/calendar/DayView';
import { YearView } from '../components/calendar/YearView';
import { EventContextMenu } from '../components/calendar/EventContextMenu';
import type { ContextMenuAction } from '../components/calendar/EventContextMenu';
import { EVENT_COLORS } from '../components/calendar/types';
import type { CalendarEvent, EventType } from '../components/calendar/types';
import { EventEditPanel } from '../components/calendar/EventEditPanel';
import type { EventEditPanelData } from '../components/calendar/EventEditPanel';
import { useEventEditPanel } from '../components/calendar/useEventEditPanel';
import { useProgram } from './ProgramContext';
import type { CalendarView } from '../components/ui/ViewToggle';
import { ReadinessWidget } from '../components/ui/ReadinessWidget';
import { SchedulerResultModal } from '../components/modals/SchedulerResultModal';
import { OneOffEventModal } from '../components/modals/OneOffEventModal';
import type { OneOffEventFormData } from '../components/modals/OneOffEventModal';

// ---------------------------------------------------------------------------
// Convert 12-hour display time ('9:00 AM') to 24-hour format ('09:00')
// ---------------------------------------------------------------------------
function to24h(time12: string): string {
  if (!time12) return '';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

import type { SessionWithRelations } from '../../../../types/database';

// ---------------------------------------------------------------------------
// Helpers — map generated sessions to CalendarEvent
// ---------------------------------------------------------------------------

const KNOWN_EVENT_TYPES = ['strings', 'brass', 'piano', 'percussion', 'choral', 'guitar', 'woodwind'] as const;

// Upcoming events for the "Needs Assignment" sidebar
/** Best-effort mapping from a template's required subjects to an EventType. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveEventType(template: any): EventType {
  const skills: string[] = template?.required_skills ?? [];
  const match = KNOWN_EVENT_TYPES.find((t) =>
    skills.some((s: string) => s.toLowerCase().includes(t)),
  );
  return (match ?? 'strings') as EventType;
}

/** Convert 24-hour "HH:MM" to display format "9:00 AM". */
function formatTimeDisplay(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Build a readable title from a generated session's template data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSessionTitle(session: any): string {
  const grades: string[] = session.grade_groups ?? session.template?.grade_groups ?? [];
  const gradeSuffix = grades.length > 0 ? ` - Grade ${grades.join(', ')}` : '';
  
  // Priority 1: Use session name (e.g. one-off events)
  if (session.name) {
    return `${session.name}${gradeSuffix}`;
  }

  // Priority 2: Use template name if it exists
  if (session.template?.name) {
    return `${session.template.name}${gradeSuffix}`;
  }

  // Priority 3: Use subject/skill
  const skills: string[] = session.template?.required_skills ?? [];
  if (skills.length > 0) {
    const skill = skills[0].charAt(0).toUpperCase() + skills[0].slice(1);
    return `${skill} Session${gradeSuffix}`;
  }
  
  // Priority 4: Use instructor name
  const instructorName = session.instructor
    ? `${session.instructor.first_name ?? ''} ${session.instructor.last_name ?? ''}`.trim()
    : '';
  if (instructorName) {
    return `${instructorName} Session${gradeSuffix}`;
  }
  
  // Fallback
  return `Session${gradeSuffix}`;
}

/** Map a raw generated session (with joins) to a CalendarEvent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sessionToCalendarEvent(session: any): CalendarEvent {
  // Instructor name: API returns { first_name, last_name }, not { name }
  const instructorName = session.instructor
    ? `${session.instructor.first_name ?? ''} ${session.instructor.last_name ?? ''}`.trim() || 'Unassigned'
    : 'Unassigned';

  // Tags: API returns tag objects with { id, name, ... }, convert to string[]
  const tagNames: string[] = Array.isArray(session.tags)
    ? session.tags.map((t: { name?: string }) => t.name).filter(Boolean)
    : [];

  // Populate subjects from template skills OR subject-category tags
  const templateSubjects = Array.isArray(session.template?.required_skills) ? session.template.required_skills : [];
  const tagSubjects = Array.isArray(session.tags)
    ? session.tags
        .filter((t: { category?: string }) => t.category?.toLowerCase() === 'subjects' || t.category?.toLowerCase() === 'subject')
        .map((t: { name?: string }) => t.name)
        .filter(Boolean)
    : [];
  const allSubjects = [...templateSubjects, ...tagSubjects];

  const gradeLabel = session.grade_groups?.length
    ? `Grade ${session.grade_groups.join(', ')}`
    : '';

  return {
    id: session.id,
    title: buildSessionTitle(session),
    subtitle: gradeLabel,
    gradeLevel: gradeLabel || undefined,
    instructor: instructorName,
    type: deriveEventType(session.template),
    time: formatTimeDisplay(session.start_time),
    endTime: formatTimeDisplay(session.end_time),
    date: session.date,
    status: session.status ?? 'draft',
    venue: session.venue?.name,
    subjects: allSubjects,
    tags: tagNames,
    notes: session.notes ?? undefined,
    templateId: session.template_id ?? session.template?.id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers — filter
// ---------------------------------------------------------------------------

/** Check if an event matches the active filters */
function eventMatchesFilters(event: CalendarEvent, filters: ActiveFilters): boolean {
  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue;

    switch (key) {
      case 'instructor':
        if (!values.includes(event.instructor)) return false;
        break;
      case 'venue':
        if (event.venue && !values.includes(event.venue)) return false;
        break;
      case 'eventType':
        if (!values.includes(event.type)) return false;
        break;
      case 'grade':
        if (!values.includes(event.subtitle)) return false;
        break;
      case 'status':
        if (event.status && !values.includes(event.status)) return false;
        break;
      case 'tags':
        if (!event.tags || !event.tags.some((t) => values.includes(t))) return false;
        break;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Clear Events Confirmation Modal
// ---------------------------------------------------------------------------

function ClearEventsModal({
  open,
  onClose,
  onConfirm,
  isClearing,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isClearing: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === 'DELETE';

  // Reset input when modal opens/closes
  useEffect(() => {
    if (!open) setConfirmText('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-[70] w-[440px] bg-white rounded-2xl shadow-[0_8px_32px_#00000033] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Clear All Events</h3>
            <p className="text-[12px] text-slate-500">This action is irreversible</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-[13px] text-slate-700 leading-relaxed">
            ⚠️ This will permanently delete <span className="font-semibold">ALL</span> scheduled
            events for this program. This cannot be undone.
          </p>

          <div>
            <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
              Type <span className="font-mono font-semibold text-red-500">DELETE</span> to confirm
            </label>
            <Tooltip text="Type DELETE to confirm permanent deletion">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
              />
            </Tooltip>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <Tooltip text="Cancel and go back">
            <button
              onClick={onClose}
              disabled={isClearing}
              className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </Tooltip>

          <Tooltip text={isConfirmed ? 'Delete all events permanently' : 'Type DELETE to enable this button'}>
            <button
              onClick={onConfirm}
              disabled={!isConfirmed || isClearing}
              className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {isClearing ? 'Clearing...' : 'Clear Events'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export helpers
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'Date', 'Day', 'Start Time', 'End Time', 'Event Name',
  'Staff', 'Venue', 'Grade Groups', 'Status', 'Tags',
] as const;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function eventToCsvRow(event: CalendarEvent): string {
  const date = event.date ?? '';
  const dayOfWeek = date ? DAY_NAMES[new Date(date + 'T00:00:00').getDay()] : '';
  const fields = [
    date,
    dayOfWeek,
    event.time ?? '',
    event.endTime ?? '',
    event.title,
    event.instructor ?? '',
    event.venue ?? '',
    event.subtitle ?? '',
    event.status ?? '',
    (event.tags ?? []).join('; '),
  ];
  return fields.map(escapeCsvField).join(',');
}

function exportEventsCsv(events: CalendarEvent[], filenameTag: string) {
  const header = CSV_COLUMNS.join(',');
  const rows = events
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))
    .map(eventToCsvRow);
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `symphonix-${filenameTag}-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return events.length;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CalendarDashboardPage() {
  return (
    <Suspense>
      <CalendarDashboard />
    </Suspense>
  );
}

function CalendarDashboard() {
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [contextMenu, setContextMenu] = useState<{
    event: CalendarEvent;
    position: { x: number; y: number };
  } | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [schoolCalendar, setSchoolCalendar] = useState<Array<{
    date: string;
    status_type: 'no_school' | 'early_dismissal' | 'instructor_exception';
    description?: string | null;
    early_dismissal_time?: string | null;
  }>>([]);
  const [dbVenues, setDbVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedulerResult, setSchedulerResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isConfirmingGenerate, setIsConfirmingGenerate] = useState(false);
  // One-off event creation modal
  const [showOneOffModal, setShowOneOffModal] = useState(false);
  const [oneOffSlot, setOneOffSlot] = useState<{ date: string; time: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  // Portal container for Month/Year views (escapes flex hierarchy)
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  // Track recently modified event IDs (eventId -> timestamp) for badge display
  const [recentlyModified, setRecentlyModified] = useState<Map<string, number>>(new Map());
  const recentlyModifiedRef = useRef(recentlyModified);
  recentlyModifiedRef.current = recentlyModified;

  // Clean up entries older than 5 seconds
  const hasRecentlyModified = recentlyModified.size > 0;
  useEffect(() => {
    if (!hasRecentlyModified) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const next = new Map<string, number>();
      for (const [id, ts] of recentlyModifiedRef.current) {
        if (now - ts < 5000) next.set(id, ts);
      }
      if (next.size !== recentlyModifiedRef.current.size) {
        setRecentlyModified(next);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [hasRecentlyModified]);

  const markRecentlyModified = useCallback((eventId: string) => {
    setRecentlyModified((prev) => {
      const next = new Map(prev);
      next.set(eventId, Date.now());
      return next;
    });
  }, []);

  const modifiedCount = recentlyModified.size;

  const searchParams = useSearchParams();

  const { programs, selectedProgramId } = useProgram();
  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  // Initialize filters from URL search params (e.g. ?tag=Percussion from People page)
  useEffect(() => {
    const initial: ActiveFilters = {};

    const tag = searchParams.get('tag');
    if (tag) {
      initial.eventType = [tag.toLowerCase()];
    }

    const instructor = searchParams.get('instructor');
    if (instructor) {
      initial.instructor = [instructor];
    }

    const venue = searchParams.get('venue');
    if (venue) {
      initial.venue = [venue];
    }

    if (Object.keys(initial).length > 0) {
      setActiveFilters(initial);
    }
  }, [searchParams]);

  // Filter events based on active selections
  const filteredEvents = useMemo(() => {
    const hasActiveFilters = Object.values(activeFilters).some((v) => v.length > 0);
    if (!hasActiveFilters) return events;
    return events.filter((event) => eventMatchesFilters(event, activeFilters));
  }, [activeFilters, events]);

  // Navigate to day view when a day cell is clicked in month view
  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentView('day');
  }, []);

  // Context menu handlers
  const handleEventContextMenu = useCallback(
    (event: CalendarEvent, position: { x: number; y: number }) => {
      setContextMenu({ event, position });
    },
    [],
  );

  const handleContextMenuAction = useCallback(
    (action: ContextMenuAction, event: CalendarEvent) => {
      // In a real app, these would trigger API calls
      switch (action) {
        case 'cancel':
          // eslint-disable-next-line no-console
          console.log('Cancel event:', event.title);
          break;
        case 'suggest_replacements':
          // eslint-disable-next-line no-console
          console.log('Suggest replacements for:', event.title);
          break;
        case 'duplicate':
          // eslint-disable-next-line no-console
          console.log('Duplicate event:', event.title);
          break;
        case 'delete':
          // eslint-disable-next-line no-console
          console.log('Delete event:', event.title);
          break;
      }
      setContextMenu(null);
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Event edit panel
  const { panelState, openPanel, closePanel } = useEventEditPanel();

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    openPanel(event);
  }, [openPanel]);

  const handleSaveEvent = useCallback(async (eventId: string, data: EventEditPanelData) => {
    // Capture previous state for revert
    const prevEvents = events;

    // Optimistic update
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId
          ? {
              ...ev,
              title: data.title,
              venue: data.venue,
              instructor: data.instructor,
              date: data.date,
              time: data.time,
              endTime: data.endTime,
              tags: data.tags,
              notes: data.notes,
            }
          : ev,
      ),
    );
    markRecentlyModified(eventId);

    // Persist immediately
    try {
      const res = await fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data.date,
          start_time: to24h(data.time),
          end_time: to24h(data.endTime),
          notes: data.notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on failure
      setEvents(prevEvents);
      showToast(err instanceof Error ? err.message : 'Failed to save event', 'error');
    }
  }, [events, markRecentlyModified]);

  // Drag-and-drop: optimistic update + immediate persist
  const handleEventDrop = useCallback(
    (eventId: string, newDate: string, newTime: string, newEndTime: string) => {
      const prevEvents = events;

      // Optimistic update
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, date: newDate, time: newTime, endTime: newEndTime }
            : ev,
        ),
      );
      markRecentlyModified(eventId);

      // Persist immediately
      fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          start_time: to24h(newTime),
          end_time: to24h(newEndTime),
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to save');
        })
        .catch(() => {
          setEvents(prevEvents);
          showToast('Failed to move event — reverted', 'error');
        });
    },
    [events, markRecentlyModified],
  );

  // Event resize: optimistic update + immediate persist
  const handleEventResize = useCallback(
    (eventId: string, newEndTime: string) => {
      const prevEvents = events;

      // Optimistic update
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, endTime: newEndTime } : ev,
        ),
      );
      markRecentlyModified(eventId);

      // Persist immediately
      fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          end_time: to24h(newEndTime),
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to save');
        })
        .catch(() => {
          setEvents(prevEvents);
          showToast('Failed to resize event — reverted', 'error');
        });
    },
    [events, markRecentlyModified],
  );

  // Publish all draft sessions
  const handlePublishSchedule = useCallback(async () => {
    const drafts = events.filter((ev) => ev.status === 'draft');
    if (drafts.length === 0) {
      showToast('No draft sessions to publish', 'info');
      return;
    }

    setIsPublishing(true);
    try {
      const results = await Promise.allSettled(
        drafts.map((ev) =>
          fetch(`/api/sessions/${ev.id}`, {
            method: 'PATCH',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'published' }),
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;

      setEvents((prev) =>
        prev.map((ev) =>
          ev.status === 'draft' ? { ...ev, status: 'published' as const } : ev,
        ),
      );

      showToast(`${succeeded} session${succeeded !== 1 ? 's' : ''} published!`);
    } catch {
      showToast('Failed to publish schedule', 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [events]);

  // Compute the date range to fetch from the API based on the current view.
  // Plain function — not memoized — to avoid creating extra callback identities
  // that trigger redundant fetches.
  function getFetchDateRange(): { start_date: string; end_date: string } {
    const anchor = selectedDate;
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    switch (currentView) {
      case 'day':
      case 'week': {
        // Buffer: ±1 month around the anchor so day/week navigation stays cached
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0); // last day of next month
        return { start_date: fmt(start), end_date: fmt(end) };
      }
      case 'month': {
        // Buffer: ±2 months so the 6-week grid overflow + adjacent navigation is covered
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0);
        return { start_date: fmt(start), end_date: fmt(end) };
      }
      case 'year': {
        const jan1 = new Date(anchor.getFullYear(), 0, 1);
        const dec31 = new Date(anchor.getFullYear(), 11, 31);
        return { start_date: fmt(jan1), end_date: fmt(dec31) };
      }
      default: {
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0);
        return { start_date: fmt(start), end_date: fmt(end) };
      }
    }
  }

  // Fetch sessions for the visible date range (with buffer) instead of the
  // entire year.  This avoids hitting row limits and keeps payloads small.
  // Uses direct deps instead of memoized getFetchDateRange to prevent
  // callback-identity churn from triggering redundant fetches.
  const fetchSessions = useCallback(async (signal?: AbortSignal) => {
    if (!selectedProgramId) return;

    const fetchId = `fetch-${Date.now()}`;
    try {
      const { start_date, end_date } = getFetchDateRange();
      console.log(`[${fetchId}] Starting fetch for`, { currentView, selectedDate, start_date, end_date });
      const params = new URLSearchParams({
        program_id: selectedProgramId,
        start_date,
        end_date,
      });

      const res = await fetch(`/api/sessions?${params.toString()}`, { cache: 'no-store', signal });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        showToast(`Failed to load sessions: ${errBody.error || `HTTP ${res.status}`}`, 'error');
        return;
      }

      const body = await res.json();
      if (Array.isArray(body.sessions)) {
        const mappedEvents = body.sessions.map(sessionToCalendarEvent);
        console.log(`[${fetchId}] Setting ${mappedEvents.length} events, date range:`, {
          firstDate: mappedEvents[0]?.date,
          lastDate: mappedEvents[mappedEvents.length - 1]?.date
        });
        setEvents(mappedEvents);
      }

      // Fetch school calendar data
      const calParams = new URLSearchParams({ program_id: selectedProgramId });
      const calRes = await fetch(`/api/calendar?${calParams.toString()}`, { cache: 'no-store', signal });

      if (calRes.ok) {
        const calBody = await calRes.json();
        if (Array.isArray(calBody.entries)) {
          setSchoolCalendar(calBody.entries);
        }
      }

      // Fetch all venues from DB (includes empty venues with no events).
      // Don't filter by program_id — venues are physical spaces shared across programs.
      const venueRes = await fetch('/api/venues', { cache: 'no-store', signal });

      if (venueRes.ok) {
        const venueBody = await venueRes.json();
        if (Array.isArray(venueBody.venues)) {
          const mappedVenues = venueBody.venues.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }));
          setDbVenues(mappedVenues);
        }
      } else {
        console.warn('[Admin] Failed to fetch venues:', venueRes.status, venueRes.statusText);
      }

      // Fetch active event templates for the sidebar
      const tplParams = new URLSearchParams({ program_id: selectedProgramId });
      const tplRes = await fetch(`/api/templates?${tplParams.toString()}`, { cache: 'no-store', signal });
      if (tplRes.ok) {
        const tplBody = await tplRes.json();
        if (Array.isArray(tplBody.templates)) {
          setEventTemplates(
            tplBody.templates
              .filter((t: { is_active?: boolean }) => t.is_active !== false)
              .map((t: Record<string, unknown>) => ({
                id: t.id,
                name: t.name,
                required_skills: t.required_skills,
                instructor_id: t.instructor_id,
                venue_id: t.venue_id,
                grade_groups: t.grade_groups ?? [],
                duration_minutes: t.duration_minutes ?? 45,
                venue: t.venue,
                instructor: null, // Template API doesn't join instructor
              })),
          );
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log(`[${fetchId}] Aborted`);
        return;
      }
      console.error('[fetchSessions]', err);
      showToast('Failed to load sessions — check console for details', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, currentView, selectedDate]);

  // Fetch sessions from DB on page load and when program/view/date changes.
  // AbortController cancels stale in-flight requests so the last fetch wins.
  useEffect(() => {
    console.log('[useEffect] Triggering fetchSessions due to dependency change');
    const controller = new AbortController();
    fetchSessions(controller.signal);
    return () => {
      console.log('[useEffect] Cleanup: aborting previous fetch');
      controller.abort();
    };
  }, [fetchSessions]);

  const handleDeleteEvent = useCallback(async (eventId: string, mode: 'single' | 'future') => {
    try {
      if (mode === 'single') {
        const res = await fetch(`/api/sessions/${eventId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to delete session');
        }
        setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
        showToast('Session canceled', 'success');
      } else {
        const res = await fetch(`/api/sessions/delete-future?session_id=${eventId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to delete future sessions');
        }
        const { deleted } = await res.json();
        await fetchSessions();
        showToast(`Canceled ${deleted} session${deleted !== 1 ? 's' : ''}`, 'success');
      }
      closePanel();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  }, [fetchSessions, closePanel]);

  // Auto-generate draft schedule — first shows preview, then confirms
  const handleGenerateSchedule = useCallback(async () => {
    if (!selectedProgramId) {
      showToast('Select a program first.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const anchor = selectedDate;
      const year = anchor.getFullYear();
      const payload = { program_id: selectedProgramId, year };

      // Run preview first (no DB mutations)
      const res = await fetch('/api/scheduler/generate?preview=true', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Preview failed');
      }

      // Show preview modal
      setSchedulerResult(body);
      setIsPreviewMode(true);
      setShowResultModal(true);
    } catch (err) {
      console.error('[handleGenerateSchedule]', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to generate preview',
        'error',
      );
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProgramId, selectedDate]);

  // Confirm generation after preview
  const handleConfirmGenerate = useCallback(async () => {
    if (!selectedProgramId) return;
    setIsConfirmingGenerate(true);
    try {
      const anchor = selectedDate;
      const year = anchor.getFullYear();
      const payload = { program_id: selectedProgramId, year };

      // Run for real (clears drafts + inserts sessions)
      const res = await fetch('/api/scheduler/generate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Generation failed');
      }

      // Show results modal
      setSchedulerResult(body);
      setIsPreviewMode(false);
      setShowResultModal(true);

      // Refresh calendar
      await fetchSessions();
    } catch (err) {
      console.error('[handleConfirmGenerate]', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to generate schedule',
        'error',
      );
      setShowResultModal(false);
    } finally {
      setIsConfirmingGenerate(false);
    }
  }, [selectedProgramId, selectedDate, fetchSessions]);

  // Clear all events for the current program
  const handleClearEvents = useCallback(async () => {
    setIsClearing(true);
    try {
      const url = `/api/sessions/bulk?program_id=${encodeURIComponent(selectedProgramId ?? '')}`;
      let totalDeleted = 0;

      // Fire parallel delete requests — each clears one day's drafts.
      // Run 10 concurrent requests for speed. Stop when any returns done=true.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const PARALLEL = 10;
        const results = await Promise.all(
          Array.from({ length: PARALLEL }, () =>
            fetch(url, { method: 'DELETE', cache: 'no-store' })
              .then((r) => r.json())
              .catch(() => ({ done: false, deleted: 0, error: true }))
          )
        );

        let allDone = false;
        for (const body of results) {
          totalDeleted += body.deleted ?? 0;
          if (body.done) allDone = true;
        }

        if (allDone) break;
      }

      setEvents([]);
      setShowClearModal(false);
      showToast(`All events cleared (${totalDeleted} deleted)`);
      await fetchSessions();
    } catch (err) {
      console.error('[handleClearEvents]', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to clear events',
        'error',
      );
    } finally {
      setIsClearing(false);
    }
  }, [selectedProgramId, fetchSessions]);

  // Export helpers — filter events by date range, generate CSV, trigger download
  const handleExportWeekly = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = monday.toISOString().slice(0, 10);
    const end = sunday.toISOString().slice(0, 10);
    const weekEvents = events.filter((ev) => ev.date && ev.date >= start && ev.date <= end);
    const count = exportEventsCsv(weekEvents, 'weekly');
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''}`);
    setShowExportMenu(false);
  }, [events]);

  const handleExportMonthly = useCallback(() => {
    const now = new Date();
    const yearStr = String(now.getFullYear());
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const start = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const monthEvents = events.filter((ev) => ev.date && ev.date >= start && ev.date <= end);
    const count = exportEventsCsv(monthEvents, 'monthly');
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''}`);
    setShowExportMenu(false);
  }, [events]);

  const handleExportYearly = useCallback(() => {
    const count = exportEventsCsv(events, 'yearly');
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''}`);
    setShowExportMenu(false);
  }, [events]);

  // One-off event: open modal when an empty time slot is clicked
  const handleEmptySlotClick = useCallback((date: string, time: string) => {
    setOneOffSlot({ date, time });
    setShowOneOffModal(true);
  }, []);

  // Template sidebar: open one-off modal pre-filled from template
  const handleTemplateSelect = useCallback((template: EventTemplate, date?: string, time?: string) => {
    setOneOffSlot({
      date: date ?? '',
      time: time ?? '',
    });
    // Store template data for the modal to pick up
    setSelectedTemplate(template);
    setShowOneOffModal(true);
  }, []);

  // One-off event: create session via API
  const handleCreateOneOffEvent = useCallback(async (data: OneOffEventFormData) => {
    if (!selectedProgramId) {
      showToast('Select a program first', 'error');
      return;
    }

    // Compute end_time from start_time + duration
    const [hStr, mStr] = data.start_time.split(':');
    const startMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
    const endMinutes = startMinutes + data.duration_minutes;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    const sessionBody: Record<string, unknown> = {
      program_id: selectedProgramId,
      template_id: null,
      instructor_id: data.instructor_id,
      venue_id: data.venue_id,
      grade_groups: data.grade_groups,
      date: data.date,
      start_time: `${data.start_time}:00`,
      end_time: `${endTime}:00`,
      duration_minutes: data.duration_minutes,
      status: 'draft',
      is_makeup: false,
      name: data.name,
    };

    // Pass recurrence options if specified
    if (data.recurrence) {
      sessionBody.recurrence = data.recurrence;
    }

    // Pass instructor rotation IDs if specified
    if (data.rotation_instructor_ids && data.rotation_instructor_ids.length >= 2) {
      sessionBody.rotation_instructor_ids = data.rotation_instructor_ids;
    }

    const res = await fetch('/api/sessions', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionBody),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || 'Failed to create event', 'error');
      throw new Error(body.error || 'Failed to create event');
    }

    const result = await res.json();
    const isRecurring = !!(result.count && result.count > 1);

    // If a subject tag was selected, link it to the session(s)
    if (data.subject_tag_id) {
      const sessionsToTag = isRecurring
        ? (result.sessions ?? [])
        : result.session ? [result.session] : [];

      await Promise.all(
        sessionsToTag
          .filter((s: { id?: string }) => s?.id)
          .map((s: { id: string }) =>
            fetch('/api/session-tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: s.id, tag_id: data.subject_tag_id }),
            }).catch(() => {
              // Non-critical — tag linking can fail silently
            })
          )
      );
    }

    setShowOneOffModal(false);
    if (isRecurring) {
      showToast(`"${data.name}" — ${result.count} sessions created`);
    } else {
      showToast(`"${data.name}" created successfully`);
    }
    await fetchSessions();
  }, [selectedProgramId, fetchSessions]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ================================================================= */}
      {/* TOP BAR                                                            */}
      {/* ================================================================= */}
      <div className="flex items-center gap-4 bg-white px-6 py-4 border-b border-slate-200 shrink-0">
        {/* Program Selector */}
        <Tooltip text="Switch active program">
          <button className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <CalendarIcon className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-slate-900">
              {selectedProgram?.name ?? 'Fall 2026 Program'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>
        </Tooltip>

        {/* View Toggle */}
        <ViewToggle value={currentView} onChange={setCurrentView} />

        {/* Today button (outline) */}
        <Button variant="todayOutline" tooltip="Jump to today's date">
          Today
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Recently modified indicator (fades after 5s) */}
        {modifiedCount > 0 && (
          <Tooltip text={`${modifiedCount} event${modifiedCount !== 1 ? 's' : ''} saved in the last few seconds`}>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {modifiedCount} saved
            </span>
          </Tooltip>
        )}

        {/* Export Calendar */}
        <div className="relative">
          <Tooltip text="Export schedule as CSV">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-lg border transition-colors cursor-pointer ${
                showExportMenu
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {showExportMenu && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />

              <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-40">
                <Tooltip text="Download this week's events as CSV">
                  <button
                    onClick={handleExportWeekly}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Export Weekly Schedule (CSV)
                  </button>
                </Tooltip>
                <Tooltip text="Download this month's events as CSV">
                  <button
                    onClick={handleExportMonthly}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Export Monthly Schedule (CSV)
                  </button>
                </Tooltip>
                <Tooltip text="Download all events for the program year as CSV">
                  <button
                    onClick={handleExportYearly}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Export Yearly Schedule (CSV)
                  </button>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Clear Events */}
        <Button
          variant="danger"
          tooltip="Delete all scheduled events for this program"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => setShowClearModal(true)}
        >
          Clear Events
        </Button>

        {/* Auto-Generate Draft */}
        <Button
          variant="secondary"
          tooltip="Generate draft classes from your weekly template"
          icon={isGenerating ? <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-slate-500" />}
          onClick={handleGenerateSchedule}
          disabled={isGenerating}
        >
          {isGenerating ? 'Previewing...' : 'Generate Classes'}
        </Button>

        {/* Publish Schedule + Readiness */}
        <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <ReadinessWidget programId={selectedProgramId} />
          <Button
            variant="primary"
            tooltip="Publish the current schedule to staff"
            onClick={handlePublishSchedule}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish Schedule'}
          </Button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* FILTER BAR                                                         */}
      {/* ================================================================= */}
      <FilterBar
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                       */}
      {/* ================================================================= */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ---- Week View ---- */}
        {currentView === 'week' && (
          <>
            <WeekView
              events={filteredEvents}
              venues={dbVenues}
              templates={eventTemplates}
              currentDate={selectedDate}
              onDateChange={setSelectedDate}
              onEventClick={handleEditEvent}
              onEventContextMenu={handleEventContextMenu}
              onOpenEditPanel={openPanel}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onEmptySlotClick={handleEmptySlotClick}
              onTemplateSelect={handleTemplateSelect}
            />
          </>
        )}

        {/* ---- Day View ---- */}
        {currentView === 'day' && (
          <DayView
            events={filteredEvents}
            venues={dbVenues}
            currentDate={selectedDate}
            onDateChange={setSelectedDate}
            onBackToMonth={() => setCurrentView('month')}
            conflicts={1}
            onOpenEditPanel={openPanel}
            onEmptySlotClick={handleEmptySlotClick}
          />
        )}

        {/* Portal target for Month/Year views — absolute-positioned to
            fill the calendar area, completely outside the flex flow */}
        <div
          ref={setPortalContainer}
          className="absolute inset-0"
          style={{ display: (currentView === 'month' || currentView === 'year') ? 'flex' : 'none' }}
        />
      </div>

      {/* ---- Month View (portaled) ---- */}
      {currentView === 'month' && portalContainer && createPortal(
        <MonthView
          events={filteredEvents}
          venues={dbVenues}
          currentDate={selectedDate}
          onDateChange={setSelectedDate}
          schoolCalendar={schoolCalendar}
          onDayClick={handleDayClick}
          onOpenEditPanel={openPanel}
        />,
        portalContainer,
      )}

      {/* ---- Year View (portaled) ---- */}
      {currentView === 'year' && portalContainer && createPortal(
        <YearView
          events={filteredEvents}
          venues={dbVenues}
          currentDate={selectedDate}
          onDateChange={setSelectedDate}
          schoolCalendar={schoolCalendar}
          onTodayClick={() => setCurrentView('week')}
          onOpenEditPanel={openPanel}
        />,
        portalContainer,
      )}

      {/* ================================================================= */}
      {/* CONTEXT MENU (portal-like, rendered on top)                        */}
      {/* ================================================================= */}
      {contextMenu && (
        <EventContextMenu
          event={contextMenu.event}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onAction={handleContextMenuAction}
        />
      )}

      {/* Event Edit Side Panel */}
      {panelState.event && (
        <EventEditPanel
          event={panelState.event}
          open={panelState.open}
          onClose={closePanel}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Clear Events Confirmation Modal */}
      <ClearEventsModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearEvents}
        isClearing={isClearing}
      />

      {/* Scheduler Preview / Results Modal */}
      {schedulerResult && (
        <SchedulerResultModal
          open={showResultModal}
          onClose={() => {
            setShowResultModal(false);
            setSchedulerResult(null);
          }}
          result={schedulerResult}
          isPreview={isPreviewMode}
          onConfirm={handleConfirmGenerate}
          isConfirming={isConfirmingGenerate}
          programId={selectedProgramId ?? undefined}
        />
      )}

      {/* One-Off Event Creation Modal */}
      <OneOffEventModal
        open={showOneOffModal}
        onClose={() => { setShowOneOffModal(false); setSelectedTemplate(null); }}
        onSubmit={handleCreateOneOffEvent}
        initialDate={oneOffSlot?.date}
        initialTime={oneOffSlot?.time}
        programId={selectedProgramId}
        initialTemplate={selectedTemplate ?? undefined}
      />
    </div>
  );
}
