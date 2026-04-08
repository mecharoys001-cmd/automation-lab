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
  Download,
  MapPin,
  CircleDot,
  GraduationCap,
  Tag,
  Printer,
  MoreHorizontal,
  Upload,
} from 'lucide-react';
import { showToast } from '../lib/toast';
import { Button } from '../components/ui/Button';
import { ViewToggle } from '../components/ui/ViewToggle';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { FilterBar } from '../components/layout/FilterBar';
import type { ActiveFilters, FilterConfig } from '../components/layout/FilterBar';
import dynamic from 'next/dynamic';
import type { EventTemplate } from '../components/calendar/WeekView';

// Code-split heavy calendar views — only the active view is loaded
const WeekView = dynamic(() => import('../components/calendar/WeekView').then(m => ({ default: m.WeekView })), { ssr: false });
const MonthView = dynamic(() => import('../components/calendar/MonthView').then(m => ({ default: m.MonthView })), { ssr: false });
const DayView = dynamic(() => import('../components/calendar/DayView').then(m => ({ default: m.DayView })), { ssr: false });
const YearView = dynamic(() => import('../components/calendar/YearView').then(m => ({ default: m.YearView })), { ssr: false });
import { EventContextMenu } from '../components/calendar/EventContextMenu';
import type { ContextMenuAction } from '../components/calendar/EventContextMenu';
import { EVENT_COLORS } from '../components/calendar/types';
import type { CalendarEvent, EventType, SchoolCalendarEntry } from '../components/calendar/types';
import { useEventEditPanel } from '../components/calendar/useEventEditPanel';
import { TemplateFormModal } from '../components/modals/TemplateFormModal';
import type { TemplateFormData } from '../components/modals/TemplateFormModal';
import { OneOffEventModal } from '../components/modals/OneOffEventModal';
import type { OneOffEventFormData } from '../components/modals/OneOffEventModal';
import { useProgram } from './ProgramContext';
import type { CalendarView } from '../components/ui/ViewToggle';
import { ReadinessWidget } from '../components/ui/ReadinessWidget';
import { SchedulerResultModal } from '../components/modals/SchedulerResultModal';
import { Modal, ModalButton } from '../components/ui/Modal';
import { requestCache } from '@/lib/requestCache';
import {
  formatGradeDisplay,
  deriveEventType,
  formatTimeDisplay,
  buildSessionTitle,
  sessionToCalendarEvent,
} from '../lib/sessionToCalendarEvent';

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
// Helpers — filter
// ---------------------------------------------------------------------------

/** Normalize filters for fast comparison (memoize this externally) */
function normalizeFilters(filters: ActiveFilters): Map<string, Set<string>> {
  const normalized = new Map<string, Set<string>>();
  for (const [key, values] of Object.entries(filters)) {
    if (values.length > 0) {
      normalized.set(key, new Set(values.map((v) => v.toLowerCase().trim())));
    }
  }
  return normalized;
}

/** Check if an event matches the active filters (optimized with pre-normalized filters) */
function eventMatchesFilters(event: CalendarEvent, normalizedFilters: Map<string, Set<string>>): boolean {
  for (const [key, lowerValues] of normalizedFilters) {
    if (key === 'instructor') {
      if (!lowerValues.has(event.instructor.toLowerCase().trim())) return false;
    } else if (key === 'venue') {
      if (!event.venue || !lowerValues.has(event.venue.toLowerCase().trim())) return false;
    } else if (key === 'status') {
      if (!event.status || !lowerValues.has(event.status.toLowerCase().trim())) return false;
    } else if (key === 'grade') {
      if (!event.gradeLevel || !lowerValues.has(event.gradeLevel.toLowerCase().trim())) return false;
    } else if (key === 'eventType') {
      if (!lowerValues.has(event.type.toLowerCase().trim())) return false;
    } else if (key === 'tags' || key.startsWith('tag_')) {
      // Tag category filter: check if event has ANY of the selected tags
      if (!event.tags || !event.tags.some((t) => lowerValues.has(t.toLowerCase().trim()))) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Print / PDF view
// ---------------------------------------------------------------------------

function openPrintView(
  events: CalendarEvent[],
  title: string,
  subtitle: string,
  filterNote?: string
) {
  // Sort events by date, then time
  const sorted = [...events].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')
  );

  // Group by date
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const evt of sorted) {
    const d = evt.date ?? 'Unknown';
    (grouped[d] ??= []).push(evt);
  }

  const PRINT_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Build HTML
  let html = `<!DOCTYPE html><html><head><title>${title} — Export</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { font-size: 13px; color: #64748b; margin-bottom: 4px; }
  .filter-note { font-size: 12px; color: #b45309; background: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; display: inline-block; }
  .date-header { font-size: 14px; font-weight: 600; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
  th { text-align: left; padding: 4px 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }
  td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .generated { font-size: 10px; color: #94a3b8; margin-top: 24px; }
  @media print { body { margin: 12px; } }
</style></head><body>`;

  html += `<h1>${title}</h1>`;
  html += `<div class="subtitle">${subtitle}</div>`;
  if (filterNote) html += `<div class="filter-note">⚠ ${filterNote}</div>`;

  html += `<div style="font-size:12px;color:#64748b;margin-bottom:12px;">${sorted.length} event${sorted.length !== 1 ? 's' : ''}</div>`;

  for (const [date, dateEvents] of Object.entries(grouped)) {
    const dayName = date !== 'Unknown' ? PRINT_DAY_NAMES[new Date(date + 'T00:00:00').getDay()] : '';
    html += `<div class="date-header">${dayName}, ${date}</div>`;
    html += `<table><thead><tr>
      <th scope="col">Time</th><th scope="col">Event</th><th scope="col">Event Type</th><th scope="col">Staff</th><th scope="col">Venue</th><th scope="col">Grade</th><th scope="col">Status</th>
    </tr></thead><tbody>`;

    for (const evt of dateEvents) {
      html += `<tr>
        <td>${evt.time ?? ''}–${evt.endTime ?? ''}</td>
        <td>${evt.sessionName ?? evt.title ?? ''}</td>
        <td>${(evt.subjects ?? []).join(', ')}</td>
        <td>${evt.instructor ?? ''}</td>
        <td>${evt.venue ?? ''}</td>
        <td>${(evt.gradeGroups ?? []).join(', ')}</td>
        <td>${evt.status ?? ''}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<div class="generated">Generated ${new Date().toLocaleString()}</div>`;
  html += `</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

// ---------------------------------------------------------------------------
// View date-range helper
// ---------------------------------------------------------------------------

/** Returns start/end date strings (YYYY-MM-DD) for the current calendar view */
function getCurrentViewDateRange(
  view: CalendarView,
  anchor: Date,
  program?: { start_date?: string; end_date?: string } | null
): { start: string; end: string; label: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (view) {
    case 'day':
      return { start: fmt(anchor), end: fmt(anchor), label: 'Day' };
    case 'week': {
      const mon = new Date(anchor);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // Monday
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      return { start: fmt(mon), end: fmt(sun), label: 'Week' };
    }
    case 'month': {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start: fmt(first), end: fmt(last), label: 'Month' };
    }
    case 'year':
      return {
        start: program?.start_date ?? fmt(new Date(anchor.getFullYear(), 0, 1)),
        end: program?.end_date ?? fmt(new Date(anchor.getFullYear(), 11, 31)),
        label: 'Year',
      };
  }
}

// ---------------------------------------------------------------------------
// CSV Export helpers
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'Date', 'Day of Week', 'Start Time', 'End Time', 'Duration (min)', 'Event Name',
  'Event Type', 'Staff', 'Venue', 'Grade Group', 'Status', 'Notes',
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
    String(event.durationMinutes ?? ''),
    event.sessionName ?? event.title,
    (event.subjects ?? []).join('; '),
    event.instructor ?? '',
    event.venue ?? '',
    (event.gradeGroups ?? []).join('; '),
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
  const [filterOptions, setFilterOptions] = useState({
    instructors: [] as { id: string; first_name: string; last_name: string }[],
    venues: [] as { id: string; name: string }[],
    tags: [] as { id: string; name: string; category: string | null; emoji?: string | null }[],
  });
  const [contextMenu, setContextMenu] = useState<{
    event: CalendarEvent;
    position: { x: number; y: number };
  } | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [schoolCalendar, setSchoolCalendar] = useState<SchoolCalendarEntry[]>([]);
  const [dbVenues, setDbVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentUserRoleLevel, setCurrentUserRoleLevel] = useState<'master' | 'standard' | 'editor'>('editor');
  const [publishConfirm, setPublishConfirm] = useState<{
    error: string;
    sessions_missing_event_type: number;
    affected_template_names: string[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedulerResult, setSchedulerResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isConfirmingGenerate, setIsConfirmingGenerate] = useState(false);
  // Generate settings modal
  const [showGenerateSettings, setShowGenerateSettings] = useState(false);
  const [dayStartTime, setDayStartTime] = useState('07:00');
  const [dayEndTime, setDayEndTime] = useState('18:00');
  // One-off event creation modal
  const [showOneOffModal, setShowOneOffModal] = useState(false);
  const [oneOffSlot, setOneOffSlot] = useState<{ date: string; time: string; venueId?: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | null>(null);
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
  // Only apply once on mount to avoid resetting user-selected filters when
  // searchParams identity changes on re-render.
  const initialFiltersApplied = useRef(false);
  useEffect(() => {
    if (initialFiltersApplied.current) return;
    initialFiltersApplied.current = true;

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
  // Memoize normalized filters to avoid repeated toLowerCase/trim calls
  const normalizedFilters = useMemo(() => normalizeFilters(activeFilters), [activeFilters]);

  const filteredEvents = useMemo(() => {
    if (normalizedFilters.size === 0) return events;
    return events.filter((event) => eventMatchesFilters(event, normalizedFilters));
  }, [normalizedFilters, events]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    for (const [key, values] of Object.entries(activeFilters)) {
      if (values && values.length > 0) {
        // Capitalize the filter key name
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        parts.push(`${label} (${values.length})`);
      }
    }
    return parts;
  }, [activeFilters]);

  const hasActiveFilters = activeFilterSummary.length > 0;

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

  // Drag-and-drop: optimistic update + immediate persist
  const handleEventDrop = useCallback(
    (eventId: string, newDate: string, newTime: string, newEndTime: string, venueId?: string) => {
      const prevEvents = events;

      // WeekView passes 24-hour format ("09:00:00") but CalendarEvent.time
      // must be display format ("9:00 AM") for parseTimeToHour positioning.
      const displayTime = formatTimeDisplay(newTime);
      const displayEndTime = formatTimeDisplay(newEndTime);

      // Compute duration_minutes from the 24h times
      const [sh, sm] = newTime.split(':').map(Number);
      const [eh, em] = newEndTime.split(':').map(Number);
      const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

      // If the event's template has a fixed venue, don't override it via drag-drop
      const droppedEvent = events.find((ev) => ev.id === eventId);
      const template = droppedEvent?.templateId
        ? eventTemplates.find((t) => t.id === droppedEvent.templateId)
        : undefined;
      const effectiveVenueId = template?.venue_id ? undefined : venueId;

      console.log('[handleEventDrop] Called with:', {
        eventId,
        newDate,
        newTime,
        newEndTime,
        venueId,
        effectiveVenueId,
        templateVenueId: template?.venue_id,
        displayTime,
        displayEndTime,
        durationMinutes,
      });

      // Optimistic update (include venueId only if template allows it)
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const updated = { ...ev, date: newDate, time: displayTime, endTime: displayEndTime, durationMinutes };
          if (effectiveVenueId) { updated.venueId = effectiveVenueId; updated.venue = dbVenues.find((v) => v.id === effectiveVenueId)?.name ?? effectiveVenueId; }
          console.log('[handleEventDrop] Optimistic update:', { old: { date: ev.date, time: ev.time, endTime: ev.endTime, venueId: ev.venueId }, new: { date: updated.date, time: updated.time, endTime: updated.endTime, venueId: updated.venueId } });
          return updated;
        }),
      );
      markRecentlyModified(eventId);

      // Build PATCH body (include venue_id only if template allows it)
      const patchBody: Record<string, unknown> = {
        date: newDate,
        start_time: to24h(displayTime),
        end_time: to24h(displayEndTime),
        duration_minutes: durationMinutes,
      };
      if (effectiveVenueId) patchBody.venue_id = effectiveVenueId;

      console.log('[handleEventDrop] PATCH body:', patchBody);

      // Persist immediately
      fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Failed to save');
          }
          console.log('[handleEventDrop] PATCH success for', eventId);
        })
        .catch((err) => {
          console.error('[handleEventDrop] PATCH failed, reverting:', err);
          setEvents(prevEvents);
          showToast(err instanceof Error ? err.message : 'Failed to move event — reverted', 'error');
        });
    },
    [events, eventTemplates, markRecentlyModified, dbVenues],
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
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Failed to save');
          }
        })
        .catch((err) => {
          setEvents(prevEvents);
          showToast(err instanceof Error ? err.message : 'Failed to resize event — reverted', 'error');
        });
    },
    [events, markRecentlyModified],
  );

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const roleLevel = data?.role_level;
        if (roleLevel === 'master' || roleLevel === 'standard' || roleLevel === 'editor') {
          setCurrentUserRoleLevel(roleLevel);
        }
      })
      .catch(() => {});
  }, []);

  // Publish all draft sessions via the publish API
  const handlePublishSchedule = useCallback(async (skipIncomplete = false) => {
    if (currentUserRoleLevel === 'editor') {
      showToast('Publishing requires Admin or Master Admin access', 'error');
      return;
    }
    if (events.length === 0) {
      showToast('No sessions to publish — generate a schedule first', 'info');
      return;
    }
    const drafts = events.filter((ev) => ev.status === 'draft');
    if (drafts.length === 0) {
      showToast('No draft sessions to publish — all sessions are already published', 'info');
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch('/api/notifications/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: selectedProgramId,
          ...(skipIncomplete ? { skip_incomplete: true } : {}),
        }),
      });

      if (res.status === 422) {
        const data = await res.json();
        setPublishConfirm(data);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Publish failed');
      }

      const result = await res.json();
      const count = result.published ?? drafts.length;

      setEvents((prev) =>
        prev.map((ev) =>
          ev.status === 'draft' ? { ...ev, status: 'published' as const } : ev,
        ),
      );

      showToast(`${count} session${count !== 1 ? 's' : ''} published!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish schedule', 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [currentUserRoleLevel, events, selectedProgramId]);

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
        exclude_status: 'canceled',
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

      // Fetch school calendar data (cached across page navigations)
      const calBody = await requestCache.fetch<{ entries?: typeof schoolCalendar }>(
        `/api/calendar?program_id=${selectedProgramId}`
      );
      if (Array.isArray(calBody.entries)) {
        setSchoolCalendar(calBody.entries);
      }

      // Fetch all venues from DB (cached across page navigations)
      const venueBody = await requestCache.fetch<{ venues?: Array<{ id: string; name: string }> }>(
        `/api/venues?program_id=${selectedProgramId}`
      );
      if (Array.isArray(venueBody.venues)) {
        const mappedVenues = venueBody.venues.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }));
        setDbVenues(mappedVenues);
      }

      // Fetch active event templates for the sidebar (cached across page navigations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tplBody = await requestCache.fetch<{ templates?: any[] }>(
        `/api/templates?program_id=${selectedProgramId}`
      );
      if (Array.isArray(tplBody.templates)) {
        setEventTemplates(
          tplBody.templates
            .filter((t) => t.is_active !== false)
            .map((t) => ({
              id: t.id as string,
              name: t.name as string,
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

  // Fetch dynamic filter options from API with deduplication and caching
  const fetchFilterOptions = useCallback(async () => {
    if (!selectedProgramId) return;
    
    try {
      // Use request cache to prevent duplicate concurrent requests
      const [instData, venueData, tagData] = await Promise.all([
        requestCache.fetch<{ instructors: { id: string; first_name: string; last_name: string }[] }>(`/api/staff?program_id=${selectedProgramId}`, {}, 10000),
        requestCache.fetch<{ venues: { id: string; name: string }[] }>(`/api/venues?program_id=${selectedProgramId}`, {}, 10000),
        requestCache.fetch<{ tags: { id: string; name: string; category: string | null; emoji?: string | null }[] }>(`/api/tags?program_id=${selectedProgramId}`, {}, 10000),
      ]);
      setFilterOptions({
        instructors: instData.instructors || [],
        venues: venueData.venues || [],
        tags: tagData.tags || [],
      });
    } catch (err) {
      console.error('[fetchFilterOptions]', err);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Build dynamic filter configs from fetched data
  const dynamicFilters = useMemo<FilterConfig[]>(() => {
    const staffFilter: FilterConfig = {
      key: 'instructor',
      label: 'Staff',
      icon: UserIcon,
      tooltip: 'Filter by staff member',
      options: filterOptions.instructors.map(i => ({
        value: `${i.first_name} ${i.last_name}`.trim(),
        label: `${i.first_name} ${i.last_name}`.trim(),
      })),
      emptyMessage: 'No staff configured yet',
      emptyHref: '/tools/scheduler/admin/people',
      emptyLinkLabel: 'Go to Staff & Venues',
    };

    const venueFilter: FilterConfig = {
      key: 'venue',
      label: 'Venue',
      icon: MapPin,
      tooltip: 'Filter by venue',
      options: filterOptions.venues.map(v => ({
        value: v.name,
        label: v.name,
      })),
      emptyMessage: 'No venues configured yet',
      emptyHref: '/tools/scheduler/admin/people',
      emptyLinkLabel: 'Go to Staff & Venues',
    };

    const statusFilter: FilterConfig = {
      key: 'status',
      label: 'Status',
      icon: CircleDot,
      tooltip: 'Filter by event status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'canceled', label: 'Canceled' },
        { value: 'completed', label: 'Completed' },
      ],
    };

    // Extract unique grades from events
    const uniqueGrades = new Set<string>();
    events.forEach(event => {
      if (event.gradeLevel) uniqueGrades.add(event.gradeLevel);
    });

    const gradeFilter: FilterConfig = {
      key: 'grade',
      label: 'Grade',
      icon: GraduationCap,
      tooltip: 'Filter by grade',
      options: Array.from(uniqueGrades).sort().map(g => ({
        value: g,
        label: g,
      })),
      emptyMessage: 'No grades in scheduled events',
      emptyHref: '/tools/scheduler/admin/event-templates',
      emptyLinkLabel: 'Go to Event Templates',
    };

    // Tag filters — one filter per category
    const tagsByCategory = filterOptions.tags.reduce((acc, tag) => {
      const cat = tag.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tag);
      return acc;
    }, {} as Record<string, typeof filterOptions.tags>);

    const tagFilters: FilterConfig[] = Object.entries(tagsByCategory).map(([category, tags]) => ({
      key: `tag_${category.toLowerCase().replace(/\s+/g, '-')}`,
      label: category,
      icon: Tag,
      tooltip: `Filter by ${category.toLowerCase()}`,
      options: tags.map(t => ({
        value: t.name,
        label: t.name,
        emoji: t.emoji || undefined,
      })),
      emptyMessage: `No ${category.toLowerCase()} tags configured yet`,
      emptyHref: '/tools/scheduler/admin/tags',
      emptyLinkLabel: 'Go to Tags',
    }));

    return [staffFilter, venueFilter, statusFilter, gradeFilter, ...tagFilters];
  }, [filterOptions, events]);

  const handleSaveEvent = useCallback(async (data: TemplateFormData & { sessionDate?: string; sessionStartTime?: string }) => {
    const editingEvent = panelState.event;
    if (!editingEvent) return;
    const eventId = editingEvent.id;

    // Use session fields if provided, otherwise preserve existing
    const sessionDate = (data as any).sessionDate ?? editingEvent.date;
    const sessionStartTime = (data as any).sessionStartTime ?? '09:00';

    // Calculate end time from start + duration
    const [sH, sM] = sessionStartTime.split(':').map(Number);
    const endMinutes = sH * 60 + sM + data.duration_minutes;
    const endTime24 = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    try {
      const res = await fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          date: sessionDate,
          start_time: sessionStartTime,
          end_time: endTime24,
          duration_minutes: data.duration_minutes,
          instructor_id: data.instructor_id || null,
          venue_id: data.venue_id || null,
          grade_groups: data.grade_groups,
          // Preserve existing subject tag ID (don't change it during edit)
          // If we need to support changing subjects, we'd need to lookup tag IDs by name
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
      showToast('Event updated', 'success');
      await fetchSessions();
      closePanel();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save event', 'error');
    }
  }, [panelState.event, fetchSessions, closePanel]);

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

  const handleCancelEvent = useCallback(async (eventId: string, mode: 'single' | 'future') => {
    try {
      if (mode === 'single') {
        const res = await fetch(`/api/sessions/${eventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'canceled' }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to cancel session');
        }
        showToast('Session canceled', 'success');
      } else {
        const res = await fetch(`/api/sessions/cancel-future?session_id=${eventId}`, { method: 'PATCH' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to cancel future sessions');
        }
        const { canceled } = await res.json();
        showToast(`Canceled ${canceled} session${canceled !== 1 ? 's' : ''}`, 'success');
      }
      await fetchSessions();
      closePanel();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel', 'error');
    }
  }, [fetchSessions, closePanel]);

  // Auto-generate draft schedule — first shows settings modal, then preview, then confirms
  const handleGenerateSchedule = useCallback(() => {
    if (!selectedProgramId) {
      showToast('Select a program first.', 'error');
      return;
    }
    setShowGenerateSettings(true);
  }, [selectedProgramId]);

  // Run preview after settings are confirmed
  const handleRunPreview = useCallback(async () => {
    if (!selectedProgramId) return;
    setShowGenerateSettings(false);
    setIsGenerating(true);
    try {
      const anchor = selectedDate;
      const year = anchor.getFullYear();
      const payload = {
        program_id: selectedProgramId,
        year,
        day_start_time: dayStartTime,
        day_end_time: dayEndTime,
      };

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
  }, [selectedProgramId, selectedDate, dayStartTime, dayEndTime]);

  // Confirm generation after preview
  const handleConfirmGenerate = useCallback(async () => {
    if (!selectedProgramId) return;
    setIsConfirmingGenerate(true);
    try {
      const anchor = selectedDate;
      const year = anchor.getFullYear();
      const payload = {
        program_id: selectedProgramId,
        year,
        day_start_time: dayStartTime,
        day_end_time: dayEndTime,
      };

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
  }, [selectedProgramId, selectedDate, fetchSessions, dayStartTime, dayEndTime]);

  // Export helpers — get events for current view range, CSV download, PDF print
  const getViewEvents = useCallback((scope: 'current' | 'full') => {
    if (scope === 'full') return filteredEvents;
    const range = getCurrentViewDateRange(currentView, selectedDate, selectedProgram);
    return filteredEvents.filter(e => e.date && e.date >= range.start && e.date <= range.end);
  }, [filteredEvents, currentView, selectedDate, selectedProgram]);

  const handleExportCsv = useCallback((scope: 'current' | 'full') => {
    const evts = getViewEvents(scope);
    const range = getCurrentViewDateRange(currentView, selectedDate, selectedProgram);
    const tag = scope === 'full' ? 'full-year' : range.label.toLowerCase();
    const count = exportEventsCsv(evts, tag);
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''} as CSV`);
    setShowExportMenu(false);
  }, [getViewEvents, currentView, selectedDate, selectedProgram]);

  const handleExportPdf = useCallback((scope: 'current' | 'full') => {
    const evts = getViewEvents(scope);
    const range = getCurrentViewDateRange(currentView, selectedDate, selectedProgram);
    const title = selectedProgram?.name ?? 'Schedule';
    const subtitle = scope === 'full'
      ? 'Full Program Year'
      : `${range.label} View: ${range.start} to ${range.end}`;
    const filterNote = hasActiveFilters
      ? `Filtered by: ${activeFilterSummary.join(', ')}`
      : undefined;

    openPrintView(evts, title, subtitle, filterNote);
    setShowExportMenu(false);
  }, [getViewEvents, currentView, selectedDate, selectedProgram, hasActiveFilters, activeFilterSummary]);

  // One-off event: open modal when an empty time slot is clicked
  const handleEmptySlotClick = useCallback((date: string, time: string, venueId?: string) => {
    setOneOffSlot({ date, time, venueId });
    setShowOneOffModal(true);
  }, []);

  // Template sidebar: open one-off modal pre-filled from template
  const handleTemplateSelect = useCallback(async (template: EventTemplate, date?: string, time?: string, venueId?: string) => {
    // If we have a date and time (drag-drop from sidebar), create session directly — no modal
    if (date && time && selectedProgramId) {
      // time comes as "HH:mm:00" from formatDecimalTo24h — already 24h format
      const startTime = time.length === 5 ? `${time}:00` : time; // ensure HH:mm:ss
      const durationMin = template.duration_minutes ?? 45;
      const [hStr, mStr] = startTime.split(':');
      const startMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
      const endMinutes = startMinutes + durationMin;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

      // Use venue from drop lane, fall back to template default.
      let resolvedVenueId: string | null = template.venue_id ?? null;
      if (venueId) {
        resolvedVenueId = venueId;
      }

      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: selectedProgramId,
            template_id: template.id,
            instructor_id: template.instructor_id ?? null,
            venue_id: resolvedVenueId,
            grade_groups: template.grade_groups ?? [],
            date,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: durationMin,
            status: 'draft',
            is_makeup: false,
            name: template.name || template.required_skills?.[0] || 'Event',
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          showToast(body.error || 'Failed to schedule event', 'error');
          return;
        }

        showToast(`Scheduled "${template.name || template.required_skills?.[0] || 'Event'}" on ${date} at ${startTime}`, 'success');
        // Refresh sessions
        await fetchSessions();
      } catch (err) {
        showToast('Failed to schedule event', 'error');
        console.error(err);
      }
      return;
    }

    // No date/time (clicked from sidebar without drag) — fetch full template data and open edit modal
    const fetchAndEditTemplate = async () => {
      try {
        const res = await fetch(`/api/templates/${template.id}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        const { template: fullTemplate } = await res.json();
        setEditingTemplate(fullTemplate);
      } catch (err) {
        showToast('Failed to load template', 'error');
        console.error(err);
      }
    };
    fetchAndEditTemplate();
  }, [selectedProgramId, showToast, fetchSessions, dbVenues]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <h1 className="sr-only">Calendar</h1>
      {/* ================================================================= */}
      {/* TOP BAR                                                            */}
      {/* ================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 lg:gap-4 bg-white px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 border-b border-slate-200 shrink-0">
        {/* View Toggle — left group */}
        <ViewToggle value={currentView} onChange={setCurrentView} />

        {/* Action buttons — right group, wraps to second row at narrow widths */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">

        {/* Recently modified indicator (fades after 5s) */}
        {modifiedCount > 0 && (
          <Tooltip text={`${modifiedCount} event${modifiedCount !== 1 ? 's' : ''} saved in the last few seconds`}>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {modifiedCount} saved
            </span>
          </Tooltip>
        )}

        {/* Export Calendar — hidden below lg, shown in overflow menu instead */}
        <div className="relative hidden lg:block">
          <Tooltip text="Export schedule as CSV or PDF">
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

              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-40">
                {/* Filter warning banner */}
                {hasActiveFilters && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-800">
                    <div className="font-medium">⚠ Filtered: {activeFilterSummary.join(', ')}</div>
                    <div className="text-amber-800">Export includes filtered events only</div>
                  </div>
                )}

                {/* CSV section */}
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">CSV</div>
                <Tooltip text={`Download ${currentView} view events as CSV`}>
                  <button
                    onClick={() => handleExportCsv('current')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-700" />
                    Current View ({currentView.charAt(0).toUpperCase() + currentView.slice(1)})
                  </button>
                </Tooltip>
                <Tooltip text="Download all events for the full program year as CSV">
                  <button
                    onClick={() => handleExportCsv('full')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-700" />
                    Full Program Year
                  </button>
                </Tooltip>

                {/* Divider */}
                <div className="border-t border-slate-100 my-1" />

                {/* PDF / Print section */}
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">PDF / Print</div>
                <Tooltip text={`Open ${currentView} view as printable PDF`}>
                  <button
                    onClick={() => handleExportPdf('current')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-700" />
                    Current View ({currentView.charAt(0).toUpperCase() + currentView.slice(1)})
                  </button>
                </Tooltip>
                <Tooltip text="Open full program year as printable PDF">
                  <button
                    onClick={() => handleExportPdf('full')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-700" />
                    Full Program Year
                  </button>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Overflow menu — visible only below lg breakpoint */}
        <div className="relative lg:hidden">
          <Tooltip text="More actions">
            <button
              onClick={() => setShowOverflowMenu(!showOverflowMenu)}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer ${
                showOverflowMenu
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </Tooltip>

          {showOverflowMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowOverflowMenu(false)} />

              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-40">
                {/* Filter warning banner */}
                {hasActiveFilters && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-800">
                    <div className="font-medium">⚠ Filtered: {activeFilterSummary.join(', ')}</div>
                    <div className="text-amber-800">Export includes filtered events only</div>
                  </div>
                )}

                {/* CSV section */}
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">Export CSV</div>
                <button
                  onClick={() => { handleExportCsv('current'); setShowOverflowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                >
                  <Download className="w-3.5 h-3.5 text-slate-700" />
                  Current View ({currentView.charAt(0).toUpperCase() + currentView.slice(1)})
                </button>
                <button
                  onClick={() => { handleExportCsv('full'); setShowOverflowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                >
                  <Download className="w-3.5 h-3.5 text-slate-700" />
                  Full Program Year
                </button>

                <div className="border-t border-slate-100 my-1" />

                {/* PDF / Print section */}
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">Print / PDF</div>
                <button
                  onClick={() => { handleExportPdf('current'); setShowOverflowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  Current View ({currentView.charAt(0).toUpperCase() + currentView.slice(1)})
                </button>
                <button
                  onClick={() => { handleExportPdf('full'); setShowOverflowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  Full Program Year
                </button>

                <div className="border-t border-slate-100 my-1" />

                {/* Actions section — visible only below lg */}
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">Actions</div>
                <button
                  onClick={() => { handleGenerateSchedule(); setShowOverflowMenu(false); }}
                  disabled={isGenerating}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-700" />
                  {isGenerating ? 'Previewing...' : 'Generate Schedule'}
                </button>
                <button
                  onClick={() => { handlePublishSchedule(); setShowOverflowMenu(false); }}
                  disabled={isPublishing || currentUserRoleLevel === 'editor'}
                  className="flex items-center gap-2 w-full px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-700" />
                  {isPublishing ? 'Publishing...' : 'Publish Sessions'}
                </button>

              </div>
            </>
          )}
        </div>

        {/* Auto-Generate Draft — hidden below lg, shown in overflow menu instead */}
        <div className="hidden lg:block">
          <Button
            variant="secondary"
            tooltip="Generate draft events from your weekly template"
            icon={isGenerating ? <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-slate-600" />}
            onClick={handleGenerateSchedule}
            disabled={isGenerating}
          >
            {isGenerating ? 'Previewing...' : 'Generate Schedule'}
          </Button>
        </div>

        {/* Publish Sessions + Readiness — hidden below lg, shown in overflow menu instead */}
        <div className="hidden lg:flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <ReadinessWidget programId={selectedProgramId} />
          <Button
            variant="primary"
            tooltip={currentUserRoleLevel === 'editor' ? 'Publishing requires Admin or Master Admin access' : 'Change all draft sessions to published'}
            onClick={() => handlePublishSchedule()}
            disabled={isPublishing || currentUserRoleLevel === 'editor'}
          >
            {isPublishing ? 'Publishing...' : 'Publish Sessions'}
          </Button>
        </div>
        </div>{/* end action buttons wrapper */}
      </div>

      {/* ================================================================= */}
      {/* FILTER BAR                                                         */}
      {/* ================================================================= */}
      <FilterBar
        filters={dynamicFilters}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
        totalCount={events.length}
        filteredCount={filteredEvents.length}
      />

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                       */}
      {/* ================================================================= */}
      <h2 className="sr-only">{currentView.charAt(0).toUpperCase() + currentView.slice(1)} View</h2>
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
              onCancelSession={() => fetchSessions()}
              onCancelFutureSessions={async (eventId: string) => {
                try {
                  const res = await fetch(`/api/sessions/cancel-future?session_id=${eventId}`, { method: 'PATCH' });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || 'Failed to cancel future sessions');
                  }
                  const { canceled } = await res.json();
                  showToast(`Canceled ${canceled} future session${canceled !== 1 ? 's' : ''}`, 'success');
                  await fetchSessions();
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Failed to cancel', 'error');
                }
              }}
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
            conflicts={0}
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

      {/* Event Edit Modal */}
      {panelState.event && (
        <TemplateFormModal
          open={panelState.open}
          onClose={closePanel}
          onSave={handleSaveEvent}
          programId={selectedProgramId}
          initialData={{
            name: panelState.event.sessionName ?? panelState.event.title,
            required_skills: panelState.event.subjects ?? [],
            instructor_id: panelState.event.instructorId ?? '',
            venue_id: panelState.event.venueId ?? '',
            grade_groups: panelState.event.gradeGroups ?? [],
            duration_minutes: panelState.event.durationMinutes ?? 60,
            duration_custom: false,
            additional_tags: panelState.event.tags ?? [],
            week_cycle_length: null,
            week_in_cycle: null,
            is_active: true,
            scheduling_mode: 'ongoing',
            starts_on: '',
            ends_on: '',
            duration_weeks: null,
            session_count: null,
            within_weeks: null,
            sessions_per_week: 1,
          }}
          initialDate={panelState.event.date}
          initialTime={panelState.event.time}
          initialVenueId={panelState.event.venueId}
          showSessionFields={true}
          editingSessionId={panelState.event.id}
          title="Edit Event"
          submitLabel="Save Changes"
        />
      )}

      {/* Generate Settings Modal */}
      <Modal
        open={showGenerateSettings}
        onClose={() => setShowGenerateSettings(false)}
        title="Generate Schedule"
        subtitle="Configure time boundaries for auto-scheduled sessions"
        width="440px"
        footer={
          <>
            <ModalButton onClick={() => setShowGenerateSettings(false)}>
              Cancel
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={handleRunPreview}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Preview Schedule
            </ModalButton>
          </>
        }
      >
        <div className="p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <Tooltip text="The earliest time the scheduler will place auto-timed sessions. Templates with an explicit start time are not affected.">
                <label className="block text-sm font-medium text-slate-700 mb-1.5 cursor-help border-b border-dashed border-slate-300 w-fit">
                  Day Start Time
                </label>
              </Tooltip>
              <input
                type="time"
                value={dayStartTime}
                onChange={(e) => setDayStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
              />
              <p className="text-xs text-slate-600 mt-1">Earliest start time for auto-scheduled sessions</p>
            </div>
            <div>
              <Tooltip text="The latest time the scheduler will allow auto-timed sessions to end. Templates with an explicit start time are not affected.">
                <label className="block text-sm font-medium text-slate-700 mb-1.5 cursor-help border-b border-dashed border-slate-300 w-fit">
                  Day End Time
                </label>
              </Tooltip>
              <input
                type="time"
                value={dayEndTime}
                onChange={(e) => setDayEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
              />
              <p className="text-xs text-slate-600 mt-1">Latest end time for auto-scheduled sessions</p>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-600">Note:</span> These settings only affect templates without an explicit start time. Templates placed on the Schedule Builder or with fixed times are not changed.
            </p>
          </div>
        </div>
      </Modal>


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

      {/* Create Event Modal (from clicking an empty time slot) */}
      <OneOffEventModal
        open={showOneOffModal}
        onClose={() => { setShowOneOffModal(false); setSelectedTemplate(null); }}
        onSubmit={async (formData: OneOffEventFormData) => {
          if (!selectedProgramId) throw new Error('Select a program first');

          const startTime = formData.start_time.length === 5
            ? `${formData.start_time}:00`
            : formData.start_time;
          const startMinutes = parseInt(startTime.split(':')[0], 10) * 60 + parseInt(startTime.split(':')[1], 10);
          const endMinutes = startMinutes + formData.duration_minutes;
          const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

          const sessionBody = {
            program_id: selectedProgramId,
            template_id: null,
            instructor_id: formData.instructor_id || null,
            venue_id: formData.venue_id || null,
            grade_groups: formData.grade_groups,
            date: formData.date,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: formData.duration_minutes,
            status: 'draft',
            is_makeup: false,
            name: formData.name || null,
            subject_tag_id: formData.subject_tag_id || null,
            recurrence: formData.recurrence,
            rotation_instructor_ids: formData.rotation_instructor_ids,
          };

          const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionBody),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'Failed to create event');
          }

          showToast(`Event "${formData.name || 'Event'}" created on ${formData.date}`, 'success');
          await fetchSessions();
        }}
        initialDate={oneOffSlot?.date}
        initialTime={oneOffSlot?.time}
        programId={selectedProgramId}
      />

      {/* Edit Template Modal (when clicking template in Event Library) */}
      {editingTemplate && (
        <TemplateFormModal
          open={true}
          onClose={() => setEditingTemplate(null)}
          onSave={async (formData: TemplateFormData) => {
            if (!selectedProgramId || !editingTemplate) return;

            try {
              // Update the template
              const res = await fetch(`/api/templates/${editingTemplate.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: formData.name || null,
                  required_skills: formData.required_skills,
                  instructor_id: formData.instructor_id || null,
                  venue_id: formData.venue_id || null,
                  grade_groups: formData.grade_groups,
                  duration_minutes: formData.duration_minutes,
                  additional_tags: formData.additional_tags,
                  week_cycle_length: formData.week_cycle_length,
                  week_in_cycle: formData.week_in_cycle,
                  is_active: formData.is_active,
                  scheduling_mode: formData.scheduling_mode,
                  starts_on: formData.starts_on || null,
                  ends_on: formData.ends_on || null,
                  duration_weeks: formData.duration_weeks,
                  session_count: formData.session_count,
                  within_weeks: formData.within_weeks,
                  sessions_per_week: formData.sessions_per_week,
                }),
              });

              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to update template');
              }

              showToast('Template updated successfully', 'success');
              setEditingTemplate(null);
              
              // Refresh templates list
              const templatesRes = await fetch(`/api/templates?program_id=${selectedProgramId}`);
              if (templatesRes.ok) {
                const { templates } = await templatesRes.json();
                setEventTemplates(templates || []);
              }
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed to update template', 'error');
              throw err;
            }
          }}
          initialData={{
            name: (editingTemplate as any).name ?? '',
            required_skills: (editingTemplate as any).required_skills ?? [],
            instructor_id: (editingTemplate as any).instructor_id ?? '',
            venue_id: (editingTemplate as any).venue_id ?? '',
            grade_groups: (editingTemplate as any).grade_groups ?? [],
            duration_minutes: (editingTemplate as any).duration_minutes ?? 60,
            duration_custom: false,
            additional_tags: (editingTemplate as any).additional_tags ?? [],
            week_cycle_length: (editingTemplate as any).week_cycle_length ?? null,
            week_in_cycle: (editingTemplate as any).week_in_cycle ?? null,
            is_active: (editingTemplate as any).is_active ?? true,
            scheduling_mode: (editingTemplate as any).scheduling_mode ?? 'ongoing',
            starts_on: (editingTemplate as any).starts_on ?? '',
            ends_on: (editingTemplate as any).ends_on ?? '',
            duration_weeks: (editingTemplate as any).duration_weeks ?? null,
            session_count: (editingTemplate as any).session_count ?? null,
            within_weeks: (editingTemplate as any).within_weeks ?? null,
            sessions_per_week: (editingTemplate as any).sessions_per_week ?? 1,
          }}
          programId={selectedProgramId}
          title="Edit Event Template"
          submitLabel="Save Changes"
        />
      )}

      {/* Publish validation modal — shown when sessions are missing event type */}
      <Modal
        open={!!publishConfirm}
        onClose={() => setPublishConfirm(null)}
        title="Some Sessions Cannot Be Published"
        footer={
          <>
            <ModalButton variant="secondary" onClick={() => setPublishConfirm(null)}>
              Cancel
            </ModalButton>
            <Tooltip text="Publish only sessions that have a valid event type assigned">
              <ModalButton
                variant="primary"
                loading={isPublishing}
                onClick={() => {
                  setPublishConfirm(null);
                  handlePublishSchedule(true);
                }}
              >
                Publish Valid Only
              </ModalButton>
            </Tooltip>
          </>
        }
      >
        <p className="text-sm text-slate-700 mb-3">{publishConfirm?.error}</p>
        {publishConfirm?.affected_template_names && publishConfirm.affected_template_names.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">
              Affected templates ({publishConfirm.sessions_missing_event_type} session{publishConfirm.sessions_missing_event_type !== 1 ? 's' : ''}):
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 space-y-0.5">
              {publishConfirm.affected_template_names.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
