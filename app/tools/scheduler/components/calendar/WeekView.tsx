'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, GripVertical, Music } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import type { CalendarEvent } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './types';
import { getSubjectColor } from '../../lib/subjectColors';
import { EventPopover } from './EventPopover';
import { useEventPopover } from './useEventPopover';
import { TimeRangeSelector } from './TimeRangeSelector';
import { VenueToggle } from '../ui/VenueToggle';
import type { VenueOption } from '../ui/VenueToggle';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventTemplate {
  id: string;
  name: string | null;
  required_skills: string[] | null;
  instructor_id: string | null;
  venue_id: string | null;
  grade_groups: string[];
  duration_minutes: number;
  venue?: { id: string; name: string } | null;
  instructor?: { id: string; first_name: string; last_name: string } | null;
}

export interface WeekViewProps {
  events: CalendarEvent[];
  /** All venues from database (shows empty venues too). Falls back to deriving from events. */
  venues?: Array<{ id: string; name: string }>;
  /** Active event templates for the sidebar library */
  templates?: EventTemplate[];
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventContextMenu?: (event: CalendarEvent, position: { x: number; y: number }) => void;
  /** Hour to start the grid (0-23). Default 8 (8 AM). */
  dayStartHour?: number;
  /** Hour to end the grid (0-23). Default 15 (3 PM). */
  dayEndHour?: number;
  /** Called when user cancels a session via popover */
  onCancelSession?: (eventId: string) => void;
  /** Called when user wants to replace instructor (with optional substitute ID) */
  onReplaceInstructor?: (eventId: string, substituteId?: string) => void;
  /** Called when user wants to replace event (with optional template ID) */
  onReplaceEvent?: (eventId: string, templateId?: string) => void;
  /** Called when user saves notes */
  onEditNotes?: (eventId: string, notes: string) => void;
  /** Called when user wants to open the full edit panel for an event */
  onOpenEditPanel?: (event: CalendarEvent) => void;
  /** Called when an event is dragged to a new date/time */
  onEventDrop?: (eventId: string, newDate: string, newTime: string, newEndTime: string) => void;
  /** Called when an event is resized (bottom edge dragged) */
  onEventResize?: (eventId: string, newEndTime: string) => void;
  /** Called when an empty time slot is clicked (for creating one-off events) */
  onEmptySlotClick?: (date: string, time: string) => void;
  /** Called when a template is dropped or clicked on the calendar */
  onTemplateSelect?: (template: EventTemplate, date?: string, time?: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 72; // px per hour slot
const TIME_COL_WIDTH = 72; // px for the time gutter
const LANE_BACKGROUNDS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_FULL_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the Monday of the week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse "9:00 AM" → decimal hour (9.0), "1:30 PM" → 13.5 */
function parseTimeToHour(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 8;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours + minutes / 60;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/** Convert a decimal hour (e.g. 13.5) to "1:30 PM" format */
function formatDecimalToTime(decimal: number): string {
  const clamped = Math.max(0, Math.min(23.75, decimal));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/** Snap a decimal hour to the nearest 15-minute increment */
function snapTo15Min(decimal: number): number {
  return Math.round(decimal * 4) / 4;
}

// ---------------------------------------------------------------------------
// Event Block (positioned absolutely within a day column)
// ---------------------------------------------------------------------------

function WeekEventBlock({
  event,
  dayStartHour,
  onHover,
  onLeave,
  onClick,
  onContextMenu,
  onResizeEnd,
  enableDrag,
}: {
  event: CalendarEvent;
  dayStartHour: number;
  onHover: (event: CalendarEvent, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
  onContextMenu?: (event: CalendarEvent, position: { x: number; y: number }) => void;
  onResizeEnd?: (eventId: string, newEndTime: string) => void;
  enableDrag?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const subjectColor = event.subjects?.[0] ? getSubjectColor(event.subjects[0]) : null;
  const colors = subjectColor
    ? { accent: subjectColor.accent, bg: subjectColor.eventBg, text: subjectColor.eventText }
    : EVENT_COLORS[event.type] ?? { accent: '#64748B', bg: '#F8FAFC', text: '#334155' };
  const startHour = parseTimeToHour(event.time);
  const endHour = event.endTime ? parseTimeToHour(event.endTime) : startHour + 1;
  const duration = Math.max(endHour - startHour, 0.25);

  const top = (startHour - dayStartHour) * HOUR_HEIGHT;
  const height = duration * HOUR_HEIGHT - 2;
  const isCompact = height < 36; // ≤30min events: show title only

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(event, { x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const grabOffsetHours = (e.clientY - rect.top) / HOUR_HEIGHT;
    e.dataTransfer.setData(
      'application/x-calendar-event',
      JSON.stringify({ eventId: event.id, grabOffsetHours, duration }),
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  // Resize via mouse drag on bottom edge
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!ref.current || !onResizeEnd) return;

    const startY = e.clientY;
    const startHeight = ref.current.offsetHeight;

    const onMove = (me: MouseEvent) => {
      if (!ref.current) return;
      const deltaY = me.clientY - startY;
      const newHeight = Math.max(HOUR_HEIGHT * 0.25, startHeight + deltaY);
      ref.current.style.height = `${newHeight}px`;
    };

    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!ref.current) return;
      const deltaY = me.clientY - startY;
      const newHeight = Math.max(HOUR_HEIGHT * 0.25, startHeight + deltaY);
      const newDuration = (newHeight + 2) / HOUR_HEIGHT;
      const newEnd = snapTo15Min(startHour + newDuration);
      onResizeEnd(event.id, formatDecimalToTime(newEnd));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const blockTooltip = `${event.title} — ${event.time}${event.endTime ? ` – ${event.endTime}` : ''}${event.instructor ? ` · ${event.instructor}` : ''}${event.venue ? ` · ${event.venue}` : ''} (${EVENT_TYPE_LABELS[event.type]})${enableDrag ? ' · Drag to reschedule' : ''}`;

  return (
    <Tooltip text={blockTooltip}>
      <div
        ref={ref}
        data-event-block
        draggable={!!enableDrag}
        onDragStart={enableDrag ? handleDragStart : undefined}
        className={`absolute left-1 right-1 rounded-md cursor-pointer hover:opacity-90 transition-opacity overflow-hidden group ${isCompact ? 'px-1.5 py-0.5 flex items-center gap-1' : 'px-2 py-1'}`}
        style={{
          top: `${top}px`,
          height: `${Math.max(height, 22)}px`,
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.accent}`,
        }}
        onClick={(e) => { e.stopPropagation(); ref.current && onClick(event, ref.current); }}
        onContextMenu={handleContextMenu}
      >
        {isCompact ? (
          /* Compact: single line with title + time */
          <>
            <p className="text-[9px] font-bold leading-none truncate" style={{ color: colors.text }}>
              {event.title}
            </p>
            <p className="text-[9px] font-bold leading-none shrink-0" style={{ color: colors.accent }}>
              {event.time}
            </p>
          </>
        ) : (
          /* Normal: full details */
          <>
            <p
              className="text-[11px] font-bold leading-snug whitespace-normal"
              style={{ color: colors.text }}
            >
              {event.title}
            </p>
            <p className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: colors.accent }}>
              {event.time}{event.endTime ? ` – ${event.endTime}` : ''}
            </p>
            {height >= 50 && (
              <p className="text-[10px] text-slate-500 leading-snug whitespace-normal mt-0.5">
                {event.instructor}
              </p>
            )}
            {height >= 50 && event.venue && (
              <p className="text-[9px] text-slate-400 leading-snug whitespace-normal mt-0.5 truncate">
                {event.venue}
              </p>
            )}
            {height >= 64 && event.gradeLevel && (
              <p className="text-[10px] text-slate-400 leading-snug whitespace-normal mt-0.5">
                {event.gradeLevel}
              </p>
            )}
          </>
        )}
        {/* Resize handle at bottom edge */}
        {onResizeEnd && !isCompact && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: colors.accent + '40' }}
            onMouseDown={handleResizeStart}
          />
        )}
      </div>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Event Library Sidebar
// ---------------------------------------------------------------------------

function TemplateSidebar({
  templates,
  collapsed,
  onToggle,
  onTemplateClick,
  onDragStart: onDragStartProp,
}: {
  templates: EventTemplate[];
  collapsed: boolean;
  onToggle: () => void;
  onTemplateClick: (template: EventTemplate) => void;
  onDragStart?: (template: EventTemplate) => void;
}) {
  const handleDragStart = (e: React.DragEvent, template: EventTemplate) => {
    e.dataTransfer.setData(
      'application/x-template-item',
      JSON.stringify(template),
    );
    e.dataTransfer.effectAllowed = 'copy';
    onDragStartProp?.(template);
  };

  return (
    <div
      className="shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200"
      style={{ width: collapsed ? 40 : 250 }}
    >
      {/* Header */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-3 border-b border-slate-200`}>
        {!collapsed && (
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Event Library
          </span>
        )}
        <Tooltip text={collapsed ? 'Show event library' : 'Hide event library'}>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-slate-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Event list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {templates.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No active templates</p>
          ) : (
            templates.map((template) => {
              const subject = template.required_skills?.[0];
              const displayName = template.name || subject || 'Untitled';
              const subtitle = subject && template.name ? subject : null;
              const instructorName = template.instructor
                ? `${template.instructor.first_name} ${template.instructor.last_name}`.trim()
                : null;
              const subjectColor = subject ? getSubjectColor(subject) : null;
              return (
                <div
                  key={template.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, template)}
                  onClick={() => onTemplateClick(template)}
                  className="flex items-start gap-2 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors group hover:shadow-sm"
                  style={{
                    backgroundColor: subjectColor ? `${subjectColor.accent}15` : undefined,
                    borderColor: subjectColor ? `${subjectColor.accent}40` : undefined,
                    borderLeft: subjectColor ? `3px solid ${subjectColor.accent}` : undefined,
                  }}
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0 group-hover:text-blue-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-slate-700 truncate leading-snug">
                      {displayName}
                    </p>
                    {subtitle && (
                      <p className="text-[11px] text-slate-400 truncate leading-snug">
                        {subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {instructorName && (
                        <span className="text-[10px] text-slate-400 truncate">{instructorName}</span>
                      )}
                      {template.duration_minutes > 0 && (
                        <span className="text-[10px] text-slate-400">{template.duration_minutes}m</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeekView
// ---------------------------------------------------------------------------

export function WeekView({
  events,
  venues: venuesProp,
  templates,
  currentDate,
  onDateChange,
  onEventClick,
  onEventContextMenu,
  dayStartHour: initialStartHour = 8,
  dayEndHour: initialEndHour = 15,
  onCancelSession,
  onReplaceInstructor,
  onReplaceEvent,
  onEditNotes,
  onOpenEditPanel,
  onEventDrop,
  onEventResize,
  onEmptySlotClick,
  onTemplateSelect,
}: WeekViewProps) {
  const [viewDate, setViewDate] = useState(() => currentDate ?? new Date());
  const [dayStartHour, setDayStartHour] = useState(initialStartHour);
  const [dayEndHour, setDayEndHour] = useState(initialEndHour);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync viewDate when parent changes currentDate externally
  useEffect(() => {
    if (currentDate) setViewDate(currentDate);
  }, [currentDate]);

  // Use DB venues if provided, otherwise derive from event data
  const allVenues: VenueOption[] = useMemo(() => {
    if (venuesProp && venuesProp.length > 0) {
      return venuesProp.map((v) => ({ id: v.name, name: v.name }));
    }
    const seen = new Map<string, string>();
    for (const event of events) {
      if (event.venue && !seen.has(event.venue)) {
        seen.set(event.venue, event.venue);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [venuesProp, events]);

  // Always sync selectedVenues to include all available venues on view/data change
  useEffect(() => {
    if (allVenues.length > 0) {
      setSelectedVenues(allVenues.map((v) => v.id));
    }
  }, [allVenues]);

  const multiLane = selectedVenues.length > 1;

  const { popoverState, showPopover, hidePopover, pinPopover, closePopover, handleEventClick } = useEventPopover();
  const [eventDetails, setEventDetails] = useState<Record<string, unknown> | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [dropPreview, setDropPreview] = useState<{ dayIdx: number; hour: number; venueId?: string; durationHours: number; templateName?: string; color?: string } | null>(null);
  const draggingTemplateRef = useRef<EventTemplate | null>(null);

  // -------------------------------------------------------------------------
  // Fetch additional event details (placeholder API)
  // -------------------------------------------------------------------------
  const fetchEventDetails = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/${eventId}/details`);
      if (res.ok) {
        const data = await res.json();
        setEventDetails(data);
      }
    } catch (err) {
      console.error('Failed to fetch event details:', err);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Popover callbacks (placeholder API calls)
  // -------------------------------------------------------------------------

  /** Save session notes */
  const handleSaveNotes = useCallback(async (eventId: string, notes: string) => {
    try {
      const res = await fetch('/api/session-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: eventId, note: notes }),
      });
      if (res.ok) {
        await fetchEventDetails(eventId);
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
    onEditNotes?.(eventId, notes);
  }, [fetchEventDetails, onEditNotes]);

  /** Cancel a session */
  const handleCancelSession = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      });
      if (res.ok) {
        closePopover();
      }
    } catch (err) {
      console.error('Failed to cancel event:', err);
    }
    onCancelSession?.(eventId);
  }, [closePopover, onCancelSession]);

  /** Replace instructor (with optional substitute ID) */
  const handleReplaceInstructor = useCallback(async (eventId: string, substituteId?: string) => {
    try {
      const res = await fetch(`/api/exceptions/substitute-candidates?session_id=${eventId}`);
      if (res.ok) {
        const { candidates } = await res.json();
        console.log('Substitute candidates:', candidates);
      }
    } catch (err) {
      console.error('Failed to find substitutes:', err);
    }
    onReplaceInstructor?.(eventId, substituteId);
  }, [onReplaceInstructor]);

  /** Replace entire event (with optional template ID) */
  const handleReplaceEvent = useCallback(async (eventId: string, templateId?: string) => {
    try {
      console.log('Find replacement event for:', eventId, templateId);
    } catch (err) {
      console.error('Failed to find replacement:', err);
    }
    onReplaceEvent?.(eventId, templateId);
  }, [onReplaceEvent]);

  const weekStart = useMemo(() => getWeekStart(viewDate), [viewDate]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekDateKeys = useMemo(
    () => weekDates.map(formatDateKey),
    [weekDates],
  );

  const todayKey = formatDateKey(new Date());

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [events, weekDateKeys]);

  const hours = useMemo(
    () => Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i),
    [dayStartHour, dayEndHour],
  );

  const totalHeight = hours.length * HOUR_HEIGHT;

  const navigate = useCallback((delta: number) => {
    const next = new Date(viewDate);
    next.setDate(next.getDate() + delta * 7);
    setViewDate(next);
    onDateChange?.(next);
  }, [viewDate, onDateChange]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setViewDate(now);
    onDateChange?.(now);
  }, [onDateChange]);

  // Format week range for header
  const weekEndDate = weekDates[6];
  const rangeLabel = useMemo(() => {
    const s = weekDates[0];
    const e = weekEndDate;
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }, [weekDates, weekEndDate]);

  // Handle template drop on a day column
  const handleTemplateDrop = useCallback((e: React.DragEvent, dayIdx: number) => {
    const raw = e.dataTransfer.getData('application/x-template-item');
    if (!raw || !onTemplateSelect) return false;
    try {
      const template = JSON.parse(raw) as EventTemplate;
      const rect = e.currentTarget.getBoundingClientRect();
      const dropY = e.clientY - rect.top;
      const rawHour = dayStartHour + dropY / HOUR_HEIGHT;
      const snapped = snapTo15Min(rawHour);
      onTemplateSelect(template, weekDateKeys[dayIdx], formatDecimalToTime(snapped));
      return true;
    } catch {
      return false;
    }
  }, [onTemplateSelect, dayStartHour, weekDateKeys]);

  // Clear drop preview when drag ends (e.g. cancelled with Esc)
  useEffect(() => {
    const handleDragEnd = () => {
      setDropPreview(null);
      setDragOverCol(null);
      draggingTemplateRef.current = null;
    };
    window.addEventListener('dragend', handleDragEnd);
    return () => window.removeEventListener('dragend', handleDragEnd);
  }, []);

  const showSidebar = templates && templates.length > 0;

  return (
    <div className="flex-1 flex overflow-hidden" style={{ minWidth: 0 }}>
      {/* Event Library Sidebar */}
      {showSidebar && (
        <TemplateSidebar
          templates={templates}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((p) => !p)}
          onTemplateClick={(template) => onTemplateSelect?.(template)}
          onDragStart={(t) => { draggingTemplateRef.current = t; }}
        />
      )}

    <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
      {/* ------- Week Navigation Sub-bar ------- */}
      <div className="flex items-center gap-3 bg-white px-6 py-3 border-b border-slate-200 shrink-0">
        <Tooltip text="Previous week">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
        </Tooltip>

        <span className="text-[15px] font-semibold text-slate-900">
          {rangeLabel}
        </span>

        <Tooltip text="Next week">
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <TimeRangeSelector
          startHour={dayStartHour}
          endHour={dayEndHour}
          onStartHourChange={setDayStartHour}
          onEndHourChange={setDayEndHour}
        />

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <Button variant="today" tooltip="Jump to current week" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* ------- Venue Toggle ------- */}
      {allVenues.length > 1 && (
        <div className="bg-white px-6 border-b border-slate-200 shrink-0">
          <VenueToggle
            venues={allVenues}
            selectedVenues={selectedVenues}
            onChange={setSelectedVenues}
          />
        </div>
      )}

      {/* ------- Unified Grid (sticky headers + time gutter + day columns) ------- */}
      <div className="flex-1 overflow-y-auto bg-white" style={{ minWidth: 0 }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, 1fr)`,
            gridTemplateRows: `auto ${totalHeight}px`,
          }}
        >
          {/* Row 1, Col 1: Sticky empty corner above time gutter */}
          <div
            className="sticky top-0 z-10 bg-white border-b border-slate-200 border-r border-slate-200"
            style={{ gridRow: 1 }}
          />

          {/* Row 1, Cols 2-8: Sticky day headers (with optional lane sub-headers) */}
          {weekDates.map((date, idx) => (
            <div
              key={`hdr-${idx}`}
              className={`sticky top-0 z-10 bg-white border-b border-slate-200 text-center box-border ${
                idx < 6 ? 'border-r border-slate-100' : ''
              }`}
              style={{ gridRow: 1 }}
            >
              <div className="px-1.5 py-2">
                <div className="text-[11px] font-semibold tracking-[1px] text-slate-400">{DAY_LABELS[idx]}</div>
                <div className="text-lg font-semibold text-slate-800">{date.getDate()}</div>
              </div>
              {multiLane && (
                <div className="flex border-t border-slate-100">
                  {selectedVenues.map((venueId, laneIdx) => (
                    <div
                      key={venueId}
                      className={`flex-1 text-[10px] font-medium text-slate-400 py-1 truncate px-1 ${
                        laneIdx < selectedVenues.length - 1 ? 'border-r border-slate-100' : ''
                      }`}
                    >
                      {venueId}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Row 2, Col 1: Time gutter */}
          <div
            className="border-r border-slate-200 bg-slate-50"
            style={{ gridRow: 2 }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-3 pt-0"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-[12px] font-semibold text-slate-500 -mt-2 select-none">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Row 2, Cols 2-8: Day columns */}
          {weekDates.map((_, dayIdx) => {
            const dateKey = weekDateKeys[dayIdx];
            const dayEvents = eventsByDate[dateKey] || [];
            const isToday = dateKey === todayKey;
            const isDragOver = dragOverCol === dayIdx;

            // Filter events to only selected venues (or show all if no venue data)
            const filteredEvents = multiLane
              ? dayEvents.filter((e) => !e.venue || selectedVenues.includes(e.venue))
              : dayEvents;

            return (
              <div
                key={dayIdx}
                className={`relative box-border ${dayIdx < 6 ? 'border-r border-slate-100' : ''} ${
                  isToday ? 'bg-blue-50/30' : ''
                } ${isDragOver ? 'bg-blue-50/50' : ''}`}
                style={{ gridRow: 2 }}
                onClick={
                  onEmptySlotClick
                    ? (e) => {
                        // Only fire if clicking the grid background, not an event block
                        if ((e.target as HTMLElement).closest('[data-event-block]')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const rawHour = dayStartHour + clickY / HOUR_HEIGHT;
                        const snapped = snapTo15Min(rawHour);
                        onEmptySlotClick(dateKey, formatDecimalToTime(snapped));
                      }
                    : undefined
                }
                onDragOver={
                  (onEventDrop || onTemplateSelect)
                    ? (e) => {
                        e.preventDefault();
                        const isTemplate = e.dataTransfer.types.includes('application/x-template-item');
                        e.dataTransfer.dropEffect = isTemplate ? 'copy' : 'move';
                        setDragOverCol(dayIdx);

                        if (isTemplate) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const dropY = e.clientY - rect.top;
                          const rawHour = dayStartHour + dropY / HOUR_HEIGHT;
                          const snapped = snapTo15Min(rawHour);
                          const tpl = draggingTemplateRef.current;
                          const durationHours = tpl && tpl.duration_minutes > 0 ? tpl.duration_minutes / 60 : 1;
                          const subject = tpl?.required_skills?.[0];
                          const subjectColor = subject ? getSubjectColor(subject) : null;

                          let venueId: string | undefined;
                          if (multiLane && selectedVenues.length > 1) {
                            const mouseX = e.clientX - rect.left;
                            const laneWidth = rect.width / selectedVenues.length;
                            const laneIdx = Math.min(Math.floor(mouseX / laneWidth), selectedVenues.length - 1);
                            venueId = selectedVenues[laneIdx];
                          }

                          setDropPreview({
                            dayIdx,
                            hour: snapped,
                            venueId,
                            durationHours,
                            templateName: tpl?.name || subject || undefined,
                            color: subjectColor?.accent,
                          });
                        }
                      }
                    : undefined
                }
                onDragLeave={(onEventDrop || onTemplateSelect) ? () => { setDragOverCol(null); setDropPreview(null); } : undefined}
                onDrop={
                  (onEventDrop || onTemplateSelect)
                    ? (e) => {
                        e.preventDefault();
                        setDragOverCol(null);
                        setDropPreview(null);
                        draggingTemplateRef.current = null;

                        // Try template drop first
                        if (handleTemplateDrop(e, dayIdx)) return;

                        // Then try event move
                        const raw = e.dataTransfer.getData('application/x-calendar-event');
                        if (!raw || !onEventDrop) return;
                        try {
                          const { eventId, grabOffsetHours, duration } = JSON.parse(raw) as {
                            eventId: string;
                            grabOffsetHours: number;
                            duration: number;
                          };
                          const rect = e.currentTarget.getBoundingClientRect();
                          const dropY = e.clientY - rect.top;
                          const rawHour = dayStartHour + dropY / HOUR_HEIGHT - grabOffsetHours;
                          const snappedStart = snapTo15Min(Math.max(dayStartHour, rawHour));
                          const snappedEnd = snapTo15Min(snappedStart + duration);
                          const newDate = weekDateKeys[dayIdx];
                          onEventDrop(
                            eventId,
                            newDate,
                            formatDecimalToTime(snappedStart),
                            formatDecimalToTime(snappedEnd),
                          );
                        } catch {
                          // ignore malformed data
                        }
                      }
                    : undefined
                }
              >
                {/* Hour grid lines */}
                {hours.map((hour, hIdx) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-b border-slate-100"
                    style={{
                      top: `${hIdx * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                  />
                ))}

                {/* Half-hour dashed lines */}
                {hours.map((hour, hIdx) => (
                  <div
                    key={`half-${hour}`}
                    className="absolute left-0 right-0 border-b border-dashed border-slate-50"
                    style={{
                      top: `${hIdx * HOUR_HEIGHT + HOUR_HEIGHT / 2}px`,
                    }}
                  />
                ))}

                {multiLane ? (
                  /* Multi-lane rendering: split day column into venue lanes */
                  <div className="absolute inset-0 flex">
                    {selectedVenues.map((venueId, laneIdx) => {
                      const laneEvents = filteredEvents.filter(
                        (e) => e.venue === venueId,
                      );
                      return (
                        <div
                          key={venueId}
                          className={`relative flex-1 ${
                            laneIdx < selectedVenues.length - 1 ? 'border-r border-slate-100' : ''
                          }`}
                          style={{
                            backgroundColor: LANE_BACKGROUNDS[laneIdx % LANE_BACKGROUNDS.length],
                          }}
                        >
                          {laneEvents.map((event) => (
                            <WeekEventBlock
                              key={event.id}
                              event={event}
                              dayStartHour={dayStartHour}
                              onHover={showPopover}
                              onLeave={hidePopover}
                              onClick={handleEventClick}
                              onContextMenu={onEventContextMenu}
                              onResizeEnd={onEventResize}
                              enableDrag={!!onEventDrop}
                            />
                          ))}
                        </div>
                      );
                    })}
                    {/* Drop preview ghost (multi-lane) */}
                    {dropPreview && dropPreview.dayIdx === dayIdx && (() => {
                      const laneIdx = dropPreview.venueId ? selectedVenues.indexOf(dropPreview.venueId) : -1;
                      const laneCount = selectedVenues.length;
                      return (
                        <div
                          className='absolute rounded-md border-2 border-dashed pointer-events-none z-[5] transition-all duration-75'
                          style={{
                            top: (dropPreview.hour - dayStartHour) * HOUR_HEIGHT,
                            height: dropPreview.durationHours * HOUR_HEIGHT,
                            left: laneIdx >= 0 ? `${(laneIdx / laneCount) * 100}%` : '4px',
                            width: laneIdx >= 0 ? `${(1 / laneCount) * 100}%` : 'calc(100% - 8px)',
                            borderColor: dropPreview.color || '#22C55E',
                            backgroundColor: (dropPreview.color || '#22C55E') + '15',
                          }}
                        >
                          <div className='px-1.5 py-1'>
                            <p className='text-[11px] font-bold' style={{ color: dropPreview.color || '#22C55E' }}>
                              {formatDecimalToTime(dropPreview.hour)} – {formatDecimalToTime(dropPreview.hour + dropPreview.durationHours)}
                            </p>
                            {dropPreview.templateName && (
                              <p className='text-[10px] font-medium text-slate-500 truncate'>{dropPreview.templateName}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* Single column rendering (original behavior) */
                  <div className="absolute inset-0 px-1.5">
                    {filteredEvents.map((event) => (
                      <WeekEventBlock
                        key={event.id}
                        event={event}
                        dayStartHour={dayStartHour}
                        onHover={showPopover}
                        onLeave={hidePopover}
                        onClick={handleEventClick}
                        onContextMenu={onEventContextMenu}
                        onResizeEnd={onEventResize}
                        enableDrag={!!onEventDrop}
                      />
                    ))}
                    {/* Drop preview ghost (single column) */}
                    {dropPreview && dropPreview.dayIdx === dayIdx && (
                      <div
                        className='absolute left-1 right-1 rounded-md border-2 border-dashed pointer-events-none z-[5] transition-all duration-75'
                        style={{
                          top: (dropPreview.hour - dayStartHour) * HOUR_HEIGHT,
                          height: dropPreview.durationHours * HOUR_HEIGHT,
                          borderColor: dropPreview.color || '#22C55E',
                          backgroundColor: (dropPreview.color || '#22C55E') + '15',
                        }}
                      >
                        <div className='px-1.5 py-1'>
                          <p className='text-[11px] font-bold' style={{ color: dropPreview.color || '#22C55E' }}>
                            {formatDecimalToTime(dropPreview.hour)} – {formatDecimalToTime(dropPreview.hour + dropPreview.durationHours)}
                          </p>
                          {dropPreview.templateName && (
                            <p className='text-[10px] font-medium text-slate-500 truncate'>{dropPreview.templateName}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Popover */}
      {popoverState.event && popoverState.anchorRect && (
        <EventPopover
          event={popoverState.event}
          anchorRect={popoverState.anchorRect}
          pinned={popoverState.pinned}
          onPin={pinPopover}
          onClose={closePopover}
          onViewDetails={onEventClick}
          onCancel={handleCancelSession}
          onReplaceInstructor={handleReplaceInstructor}
          onReplaceEvent={handleReplaceEvent}
          onEditNotes={handleSaveNotes}
          onOpenEditPanel={onOpenEditPanel}
        />
      )}
    </div>
    </div>
  );
}
