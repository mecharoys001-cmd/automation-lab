'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, GripVertical, Music, CalendarDays } from 'lucide-react';
import Link from 'next/link';
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
  onCancelFutureSessions?: (eventId: string) => void;
  /** Called when user wants to replace instructor (with optional substitute ID) */
  onReplaceInstructor?: (eventId: string, substituteId?: string) => void;
  /** Called when user wants to replace event (with optional template ID) */
  onReplaceEvent?: (eventId: string, templateId?: string) => void;
  /** Called when user saves notes */
  onEditNotes?: (eventId: string, notes: string) => void;
  /** Called when user wants to open the full edit panel for an event */
  onOpenEditPanel?: (event: CalendarEvent) => void;
  /** Called when an event is dragged to a new date/time/venue */
  onEventDrop?: (eventId: string, newDate: string, newTime: string, newEndTime: string, venueId?: string) => void;
  /** Called when an event is resized (bottom edge dragged) */
  onEventResize?: (eventId: string, newEndTime: string) => void;
  /** Called when an empty time slot is clicked (for creating one-off events) */
  onEmptySlotClick?: (date: string, time: string, venueId?: string) => void;
  /** Called when a template is dropped or clicked on the calendar */
  onTemplateSelect?: (template: EventTemplate, date?: string, time?: string, venueId?: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 72; // px per hour slot
const TIME_COL_WIDTH = 72; // px for the time gutter
const LANE_BACKGROUNDS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_FULL_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Responsive breakpoints based on actual container width (not viewport)
// so that admin sidebar + template sidebar are accounted for.
function getVisibleDayCount(containerWidth: number): number {
  // At 768px (tablet), show weekdays only (5); full 7-day view at ≥1024px
  return containerWidth < 480 ? 1 : containerWidth < 768 ? 3 : containerWidth < 1024 ? 5 : 7;
}

function useVisibleDayCount(containerRef: React.RefObject<HTMLElement | null>): number {
  const [count, setCount] = useState(7);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = (width: number) => setCount(getVisibleDayCount(width));
    // Set correct count on mount
    update(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return count;
}
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
  if (!match) {
    console.warn('[parseTimeToHour] NO MATCH for input:', JSON.stringify(time), '→ defaulting to 8');
    return 8;
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  const result = hours + minutes / 60;
  console.log('[parseTimeToHour]', JSON.stringify(time), '→', result);
  return result;
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

/** Format decimal hour to 24-hour HH:mm:ss string for data storage */
function formatDecimalTo24h(decimal: number): string {
  const clamped = Math.max(0, Math.min(23.75, decimal));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
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
  onDragStartNotify,
  onDragEndNotify,
  isDragging,
}: {
  event: CalendarEvent;
  dayStartHour: number;
  onHover: (event: CalendarEvent, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
  onContextMenu?: (event: CalendarEvent, position: { x: number; y: number }) => void;
  onResizeEnd?: (eventId: string, newEndTime: string) => void;
  enableDrag?: boolean;
  onDragStartNotify?: (eventId: string, grabOffsetHours: number, duration: number, title: string, color: string, templateId?: string, venueId?: string) => void;
  onDragEndNotify?: () => void;
  isDragging?: boolean;
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
    const dragData = { eventId: event.id, grabOffsetHours, duration };
    console.log('[DRAG START]', {
      ...dragData,
      eventTitle: event.title,
      eventTime: event.time,
      eventEndTime: event.endTime,
      eventVenueId: event.venueId,
      startHour,
      rectTop: rect.top,
      clientY: e.clientY,
    });
    e.dataTransfer.setData(
      'application/x-calendar-event',
      JSON.stringify(dragData),
    );
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent drag image so we show our own ghost preview
    const emptyImg = document.createElement('img');
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(emptyImg, 0, 0);
    onDragStartNotify?.(event.id, grabOffsetHours, duration, event.title, colors.accent, event.templateId, event.venueId);
  };

  const handleDragEnd = () => {
    onDragEndNotify?.();
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
      onResizeEnd(event.id, formatDecimalTo24h(newEnd));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
      <div
        ref={ref}
        data-event-block
        draggable={!!enableDrag}
        onDragStart={enableDrag ? handleDragStart : undefined}
        onDragEnd={enableDrag ? handleDragEnd : undefined}
        className={`absolute left-1 right-1 rounded-md cursor-pointer overflow-hidden group transition-all ${isCompact ? 'px-1.5 py-0.5 flex items-center gap-1' : 'px-2 py-1'} hover:right-auto hover:min-w-full hover:z-[10] hover:shadow-lg hover:pr-4`}
        data-dragging={isDragging ? 'true' : undefined}
        style={{
          top: `${top}px`,
          height: `${Math.max(height, 22)}px`,
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.accent}`,
          opacity: isDragging ? 0.3 : undefined,
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
              className="text-[11px] font-bold leading-snug truncate group-hover:whitespace-normal"
              style={{ color: colors.text }}
            >
              {event.title}
            </p>
            <p className="text-[10px] font-bold leading-tight mt-0.5 truncate group-hover:whitespace-normal" style={{ color: colors.accent }}>
              {event.time}{event.endTime ? ` – ${event.endTime}` : ''}
            </p>
            {height >= 50 && (
              <p className="text-[10px] text-slate-600 leading-snug truncate group-hover:whitespace-normal mt-0.5">
                {event.instructor}
              </p>
            )}
            {height >= 50 && event.venue && (
              <p className="text-[9px] text-slate-600 leading-snug truncate group-hover:whitespace-normal mt-0.5">
                {event.venue}
              </p>
            )}
            {height >= 64 && event.gradeLevel && (
              <p className="text-[10px] text-slate-600 leading-snug truncate group-hover:whitespace-normal mt-0.5">
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
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Event Library
          </span>
        )}
        <Tooltip text={collapsed ? 'Show event library' : 'Hide event library'}>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-slate-700" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Event list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {templates.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No active templates</p>
          ) : (
            templates.map((template) => {
              const subject = template.required_skills?.[0];
              const hasName = !!template.name;
              const displayName = hasName ? template.name : (subject || '(No name \u2013 edit to add)');
              const subtitle = subject && hasName ? subject : null;
              const instructorName = template.instructor
                ? `${template.instructor.first_name} ${template.instructor.last_name}`.trim()
                : null;
              const venueName = template.venue?.name || null;
              const subjectColor = subject ? getSubjectColor(subject) : null;

              // Build tooltip lines
              const tipLines: string[] = ['Event Template'];
              if (template.name) tipLines.push(`Name: ${template.name}`);
              if (subject) tipLines.push(`Subject: ${subject}`);
              if (instructorName) tipLines.push(`Staff: ${instructorName}`);
              if (venueName) tipLines.push(`Venue: ${venueName}`);
              if (template.duration_minutes > 0) tipLines.push(`Duration: ${template.duration_minutes} min`);
              if (template.grade_groups?.length) tipLines.push(`Grades: ${template.grade_groups.join(', ')}`);
              if (!hasName) tipLines.push('\nClick to edit and add a name');
              const tooltipText = tipLines.join('\n');

              return (
                <Tooltip key={template.id} text={tooltipText} position="right">
                <div
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
                  <GripVertical className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0 group-hover:text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-medium truncate leading-snug ${hasName ? 'text-slate-700' : 'text-slate-600 italic'}`}>
                      {displayName}
                    </p>
                    {subtitle && (
                      <p className="text-[11px] text-slate-600 truncate leading-snug">
                        {subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {instructorName && (
                        <span className="text-[10px] text-slate-600 truncate">{instructorName}</span>
                      )}
                      {venueName && (
                        <span className="text-[10px] text-slate-600 truncate">{venueName}</span>
                      )}
                      {template.duration_minutes > 0 && (
                        <span className="text-[10px] text-slate-600">{template.duration_minutes}m</span>
                      )}
                    </div>
                  </div>
                </div>
                </Tooltip>
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
  onCancelFutureSessions,
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
  const calendarContentRef = useRef<HTMLDivElement>(null);
  const [dayOffset, setDayOffset] = useState(0); // offset within the week for sub-week views
  const visibleDayCount = useVisibleDayCount(calendarContentRef);

  // Auto-collapse template sidebar on narrow screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    handler(mq); // check on mount
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync viewDate when parent changes currentDate externally
  useEffect(() => {
    if (currentDate) setViewDate(currentDate);
  }, [currentDate]);

  // Use DB venues if provided, otherwise derive from event data
  const allVenues: VenueOption[] = useMemo(() => {
    if (venuesProp && venuesProp.length > 0) {
      return venuesProp.map((v) => ({ id: v.id, name: v.name }));
    }
    const seen = new Map<string, string>();
    for (const event of events) {
      if (event.venueId && !seen.has(event.venueId)) {
        seen.set(event.venueId, event.venue || event.venueId);
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
  const [dropPreview, setDropPreview] = useState<{ dayIdx: number; hour: number; venueId?: string; durationHours: number; templateName?: string; eventTitle?: string; color?: string } | null>(null);
  const draggingTemplateRef = useRef<EventTemplate | null>(null);
  const draggingEventRef = useRef<{ eventId: string; grabOffsetHours: number; duration: number; title: string; color: string; templateId?: string; venueId?: string } | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Hover state for click-to-create: lane highlight + time tooltip
  // -------------------------------------------------------------------------
  const [hoverState, setHoverState] = useState<{
    dayIdx: number;
    venueId?: string;
    time: string;       // display format e.g. "9:15 AM"
    cursorY: number;    // px relative to day column
  } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleGridMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, dayIdx: number) => {
    if (!onEmptySlotClick) return;
    // Don't show hover when over an event block
    if ((e.target as HTMLElement).closest('[data-event-block]')) {
      setHoverState(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorY = e.clientY - rect.top;
    const rawHour = dayStartHour + cursorY / HOUR_HEIGHT;
    const snapped = snapTo15Min(rawHour);
    const time = formatDecimalToTime(snapped);

    // Determine venue lane if multi-lane
    let venueId: string | undefined;
    if (multiLane && selectedVenues.length > 1) {
      const mouseX = e.clientX - rect.left;
      const laneWidth = rect.width / selectedVenues.length;
      const laneIdx = Math.min(Math.floor(mouseX / laneWidth), selectedVenues.length - 1);
      venueId = selectedVenues[laneIdx];
    }

    console.log('Hover move', { dayIdx, venueId, time, multiLane, selectedVenues });
    setHoverState({ dayIdx, venueId, time, cursorY });
  }, [onEmptySlotClick, dayStartHour, multiLane, selectedVenues]);

  const handleGridMouseLeave = useCallback(() => {
    console.log('Hover leave');
    setHoverState(null);
  }, []);

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
      const res = await fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'canceled' }),
      });
      if (res.ok) {
        closePopover();
        onCancelSession?.(eventId);
      }
    } catch (err) {
      console.error('Failed to cancel event:', err);
    }
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

  // Reset dayOffset when visibleDayCount changes or when navigating to a new week
  useEffect(() => {
    setDayOffset(0);
  }, [visibleDayCount, weekStart]);

  // Visible subset of the week based on responsive breakpoint
  const visibleDates = useMemo(
    () => weekDates.slice(dayOffset, dayOffset + visibleDayCount),
    [weekDates, dayOffset, visibleDayCount],
  );
  const visibleDateKeys = useMemo(
    () => visibleDates.map(formatDateKey),
    [visibleDates],
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
    if (visibleDayCount < 7) {
      // Sub-week view: navigate within the week first, then jump weeks
      const newOffset = dayOffset + delta * visibleDayCount;
      if (newOffset >= 0 && newOffset + visibleDayCount <= 7) {
        setDayOffset(newOffset);
        return;
      }
      // Jump to next/prev week
      const next = new Date(viewDate);
      next.setDate(next.getDate() + delta * 7);
      setViewDate(next);
      onDateChange?.(next);
      setDayOffset(delta > 0 ? 0 : Math.max(0, 7 - visibleDayCount));
    } else {
      const next = new Date(viewDate);
      next.setDate(next.getDate() + delta * 7);
      setViewDate(next);
      onDateChange?.(next);
    }
  }, [viewDate, onDateChange, visibleDayCount, dayOffset]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setViewDate(now);
    onDateChange?.(now);
  }, [onDateChange]);

  // Format range label for visible dates
  const rangeLabel = useMemo(() => {
    const s = visibleDates[0];
    const e = visibleDates[visibleDates.length - 1];
    if (visibleDayCount === 1) {
      return `${DAY_FULL_LABELS[dayOffset]} ${MONTH_NAMES[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
    }
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }, [visibleDates, visibleDayCount, dayOffset]);

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

      // Detect venue lane from horizontal drop position in multi-lane mode
      let droppedVenueId: string | undefined;
      if (selectedVenues.length > 1) {
        const dropX = e.clientX - rect.left;
        const laneWidth = rect.width / selectedVenues.length;
        const laneIdx = Math.min(Math.floor(dropX / laneWidth), selectedVenues.length - 1);
        droppedVenueId = selectedVenues[laneIdx];
      } else if (selectedVenues.length === 1) {
        droppedVenueId = selectedVenues[0];
      }

      onTemplateSelect(template, visibleDateKeys[dayIdx], formatDecimalTo24h(snapped), droppedVenueId);
      return true;
    } catch {
      return false;
    }
  }, [onTemplateSelect, dayStartHour, visibleDateKeys, selectedVenues]);

  // Callbacks for event block drag notifications
  const handleEventDragStart = useCallback((eventId: string, grabOffsetHours: number, duration: number, title: string, color: string, templateId?: string, venueId?: string) => {
    draggingEventRef.current = { eventId, grabOffsetHours, duration, title, color, templateId, venueId };
    setDraggingEventId(eventId);
  }, []);

  const handleEventDragEnd = useCallback(() => {
    draggingEventRef.current = null;
    setDraggingEventId(null);
    setDropPreview(null);
    setDragOverCol(null);
  }, []);

  // Clear drop preview when drag ends (e.g. cancelled with Esc)
  useEffect(() => {
    const handleDragEnd = () => {
      setDropPreview(null);
      setDragOverCol(null);
      draggingTemplateRef.current = null;
      draggingEventRef.current = null;
      setDraggingEventId(null);
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

    <div ref={calendarContentRef} className="flex-1 flex flex-col overflow-y-hidden overflow-x-auto" style={{ minWidth: 0 }}>
      {/* ------- Week Navigation Sub-bar ------- */}
      <div className="flex flex-wrap items-center gap-3 bg-white px-4 sm:px-6 py-3 border-b border-slate-200 shrink-0">
        <Tooltip text="Previous week">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        </Tooltip>

        <span className="text-[15px] font-semibold text-slate-900">
          {rangeLabel}
        </span>

        <Tooltip text="Next week">
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
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
      <div className="flex-1 overflow-auto bg-white relative" style={{ minWidth: 0 }}>
        {events.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 pointer-events-auto">
              <CalendarDays className="w-8 h-8 text-slate-600" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No sessions scheduled yet</p>
                <p className="text-sm text-slate-700 mt-1">Set up templates and staff to start generating your schedule.</p>
              </div>
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <Link href="/tools/scheduler/admin/event-templates" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-blue-700 transition-colors">
                  Set up Event Templates
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link href="/tools/scheduler/admin/people" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-blue-700 transition-colors">
                  Add Staff &amp; Venues
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${visibleDayCount}, minmax(100px, 1fr))`,
            gridTemplateRows: `auto ${totalHeight}px`,
            minWidth: `${TIME_COL_WIDTH + visibleDayCount * 100}px`,
          }}
        >
          {/* Row 1, Col 1: Sticky empty corner above time gutter (sticky both axes) */}
          <div
            className="sticky top-0 left-0 z-20 bg-white border-b border-slate-200 border-r border-slate-200"
            style={{ gridRow: 1 }}
          />

          {/* Row 1, Cols 2+: Sticky day headers (with optional lane sub-headers) */}
          {visibleDates.map((date, idx) => (
            <div
              key={`hdr-${idx}`}
              className={`sticky top-0 z-10 bg-white border-b border-slate-200 text-center box-border ${
                idx < visibleDayCount - 1 ? 'border-r border-slate-100' : ''
              }`}
              style={{ gridRow: 1 }}
            >
              <div className="px-1.5 py-2">
                <div className="text-[11px] font-semibold tracking-[1px] text-slate-700">{DAY_LABELS[dayOffset + idx]}</div>
                <div className="text-lg font-semibold text-slate-800">{date.getDate()}</div>
              </div>
              {multiLane && (
                <div className="flex border-t border-slate-100">
                  {selectedVenues.map((venueId, laneIdx) => (
                    <div
                      key={venueId}
                      className={`flex-1 text-[10px] font-medium text-slate-700 py-1 truncate px-1 ${
                        laneIdx < selectedVenues.length - 1 ? 'border-r border-slate-100' : ''
                      }`}
                    >
                      {allVenues.find((v) => v.id === venueId)?.name ?? venueId}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Row 2, Col 1: Time gutter (sticky left for horizontal scroll) */}
          <div
            className="sticky left-0 z-[5] border-r border-slate-200 bg-slate-50"
            style={{ gridRow: 2 }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-3 pt-0"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-[12px] font-semibold text-slate-600 -mt-2 select-none">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Row 2, Cols 2+: Day columns */}
          {visibleDates.map((_, dayIdx) => {
            const dateKey = visibleDateKeys[dayIdx];
            const dayEvents = eventsByDate[dateKey] || [];
            const isToday = dateKey === todayKey;
            const isDragOver = dragOverCol === dayIdx;

            // Filter events to only selected venues (or show all if no venue data)
            const filteredEvents = multiLane
              ? dayEvents.filter((e) => !e.venueId || selectedVenues.includes(e.venueId))
              : dayEvents;

            return (
              <div
                key={dayIdx}
                className={`relative box-border ${dayIdx < visibleDayCount - 1 ? 'border-r border-slate-100' : ''} ${
                  isToday ? 'bg-blue-50/30' : ''
                } ${isDragOver ? 'bg-blue-50/50' : ''}`}
                style={{ gridRow: 2, cursor: onEmptySlotClick ? 'crosshair' : undefined }}
                onClick={
                  onEmptySlotClick
                    ? (e) => {
                        // Only fire if clicking the grid background, not an event block
                        if ((e.target as HTMLElement).closest('[data-event-block]')) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const rawHour = dayStartHour + clickY / HOUR_HEIGHT;
                        const snapped = snapTo15Min(rawHour);
                        // Determine venue lane if multi-lane
                        let clickedVenueId: string | undefined;
                        if (multiLane && selectedVenues.length > 1) {
                          const mouseX = e.clientX - rect.left;
                          const laneWidth = rect.width / selectedVenues.length;
                          const laneIdx = Math.min(Math.floor(mouseX / laneWidth), selectedVenues.length - 1);
                          clickedVenueId = selectedVenues[laneIdx];
                        }
                        onEmptySlotClick(dateKey, formatDecimalTo24h(snapped), clickedVenueId);
                      }
                    : undefined
                }
                onMouseMove={(e) => handleGridMouseMove(e, dayIdx)}
                onMouseLeave={handleGridMouseLeave}
                onDragOver={
                  (onEventDrop || onTemplateSelect)
                    ? (e) => {
                        e.preventDefault();
                        const isTemplate = e.dataTransfer.types.includes('application/x-template-item');
                        e.dataTransfer.dropEffect = isTemplate ? 'copy' : 'move';
                        setDragOverCol(dayIdx);

                        const rect = e.currentTarget.getBoundingClientRect();
                        const dropY = e.clientY - rect.top;

                        if (isTemplate) {
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
                        } else if (draggingEventRef.current) {
                          // Event drag preview – same math as the drop handler
                          const evData = draggingEventRef.current;
                          const rawHour = dayStartHour + dropY / HOUR_HEIGHT - evData.grabOffsetHours;
                          const snappedStart = snapTo15Min(Math.max(dayStartHour, rawHour));

                          // Check if event's template has a fixed venue
                          const evTemplate = evData.templateId && templates
                            ? templates.find((t) => t.id === evData.templateId)
                            : undefined;
                          const hasFixedVenue = !!evTemplate?.venue_id;

                          let venueId: string | undefined;
                          if (hasFixedVenue) {
                            // Keep original venue — don't follow cursor lane
                            venueId = evData.venueId;
                          } else if (multiLane && selectedVenues.length > 1) {
                            const mouseX = e.clientX - rect.left;
                            const laneWidth = rect.width / selectedVenues.length;
                            const laneIdx = Math.min(Math.floor(mouseX / laneWidth), selectedVenues.length - 1);
                            venueId = selectedVenues[laneIdx];
                          }

                          setDropPreview({
                            dayIdx,
                            hour: snappedStart,
                            venueId,
                            durationHours: evData.duration,
                            eventTitle: evData.title,
                            color: evData.color,
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
                        draggingEventRef.current = null;
                        setDraggingEventId(null);

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
                          const newDate = visibleDateKeys[dayIdx];

                          // Check if event's template has a fixed venue
                          const droppedEvent = events.find((ev) => ev.id === eventId);
                          const dropTemplate = droppedEvent?.templateId && templates
                            ? templates.find((t) => t.id === droppedEvent.templateId)
                            : undefined;
                          const dropHasFixedVenue = !!dropTemplate?.venue_id;

                          // Calculate venue lane from horizontal drop position (same logic as onDragOver)
                          let droppedVenueId: string | undefined;
                          if (dropHasFixedVenue) {
                            // Template has fixed venue — don't override
                            droppedVenueId = undefined;
                          } else if (multiLane && selectedVenues.length > 1) {
                            const dropX = e.clientX - rect.left;
                            const laneWidth = rect.width / selectedVenues.length;
                            const laneIdx = Math.min(Math.floor(dropX / laneWidth), selectedVenues.length - 1);
                            droppedVenueId = selectedVenues[laneIdx];
                          } else if (selectedVenues.length === 1) {
                            droppedVenueId = selectedVenues[0];
                          }

                          console.log('[DROP] Event drop:', {
                            eventId,
                            dayIdx,
                            newDate,
                            dropY,
                            rawHour,
                            snappedStart,
                            snappedEnd,
                            formattedStart: formatDecimalTo24h(snappedStart),
                            formattedEnd: formatDecimalTo24h(snappedEnd),
                            grabOffsetHours,
                            duration,
                            dayStartHour,
                            HOUR_HEIGHT,
                            droppedVenueId,
                            multiLane,
                            selectedVenues,
                          });

                          onEventDrop(
                            eventId,
                            newDate,
                            formatDecimalTo24h(snappedStart),
                            formatDecimalTo24h(snappedEnd),
                            droppedVenueId,
                          );
                        } catch (err) {
                          console.error('[DROP] Error processing event drop:', err);
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

                {/* Hover lane highlight */}
                {hoverState && hoverState.dayIdx === dayIdx && multiLane && hoverState.venueId && (() => {
                  console.log('Render hover state', hoverState);
                  const laneIdx = selectedVenues.indexOf(hoverState.venueId!);
                  const laneCount = selectedVenues.length;
                  if (laneIdx < 0) return null;
                  return (
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none z-[1] transition-opacity duration-100"
                      style={{
                        left: `${(laneIdx / laneCount) * 100}%`,
                        width: `${(1 / laneCount) * 100}%`,
                        backgroundColor: 'rgba(59, 130, 246, 0.06)',
                      }}
                    />
                  );
                })()}

                {/* Full-column highlight for single-lane mode */}
                {hoverState && hoverState.dayIdx === dayIdx && !multiLane && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[1] transition-opacity duration-100"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.04)' }}
                  />
                )}

                {/* Time tooltip at cursor */}
                {hoverState && hoverState.dayIdx === dayIdx && (
                  <div
                    className="absolute pointer-events-none z-[20] flex items-center gap-1"
                    style={{
                      top: `${hoverState.cursorY}px`,
                      left: '50%',
                      transform: 'translate(-50%, -100%) translateY(-8px)',
                    }}
                  >
                    <div className="px-2 py-1 rounded-md bg-slate-800 text-white text-[11px] font-medium shadow-lg whitespace-nowrap">
                      {hoverState.time}
                    </div>
                  </div>
                )}

                {/* Snap-line indicator at hovered time */}
                {hoverState && hoverState.dayIdx === dayIdx && (() => {
                  const snappedHour = parseTimeToHour(hoverState.time);
                  const lineY = (snappedHour - dayStartHour) * HOUR_HEIGHT;
                  return (
                    <div
                      className="absolute left-0 right-0 pointer-events-none z-[2]"
                      style={{ top: `${lineY}px` }}
                    >
                      <div className="w-full border-t-2 border-blue-400/40 border-dashed" />
                    </div>
                  );
                })()}

                {multiLane ? (
                  /* Multi-lane rendering: split day column into venue lanes */
                  <div className="absolute inset-0 flex">
                    {selectedVenues.map((venueId, laneIdx) => {
                      const laneEvents = filteredEvents.filter(
                        (e) => e.venueId === venueId,
                      );
                      return (
                        <div
                          key={venueId}
                          className={`relative flex-1 overflow-hidden ${
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
                              onDragStartNotify={handleEventDragStart}
                              onDragEndNotify={handleEventDragEnd}
                              isDragging={draggingEventId === event.id}
                            />
                          ))}
                        </div>
                      );
                    })}
                    {/* Venue-less events: place in first lane instead of spanning all */}
                    {/* (Venueless sessions should not exist — generator assigns venues) */}
                    {/* Drop preview ghost (multi-lane) */}
                    {dropPreview && dropPreview.dayIdx === dayIdx && (() => {
                      const laneIdx = dropPreview.venueId ? selectedVenues.indexOf(dropPreview.venueId) : -1;
                      const laneCount = selectedVenues.length;
                      const isEventDrag = !!dropPreview.eventTitle;
                      const ghostColor = dropPreview.color || '#22C55E';
                      return (
                        <div
                          className={`absolute rounded-md border-2 pointer-events-none z-[5] transition-all duration-75 ${isEventDrag ? '' : 'border-dashed'}`}
                          style={{
                            top: (dropPreview.hour - dayStartHour) * HOUR_HEIGHT,
                            height: dropPreview.durationHours * HOUR_HEIGHT,
                            left: laneIdx >= 0 ? `${(laneIdx / laneCount) * 100}%` : '4px',
                            width: laneIdx >= 0 ? `${(1 / laneCount) * 100}%` : 'calc(100% - 8px)',
                            borderColor: ghostColor,
                            backgroundColor: ghostColor + (isEventDrag ? '25' : '15'),
                            borderLeft: isEventDrag ? `3px solid ${ghostColor}` : undefined,
                          }}
                        >
                          <div className='px-1.5 py-1'>
                            {isEventDrag && (
                              <p className='text-[11px] font-bold truncate' style={{ color: ghostColor }}>
                                {dropPreview.eventTitle}
                              </p>
                            )}
                            <p className={`text-[11px] font-bold ${isEventDrag ? 'text-[10px]' : ''}`} style={{ color: ghostColor }}>
                              {formatDecimalToTime(dropPreview.hour)} – {formatDecimalToTime(snapTo15Min(dropPreview.hour + dropPreview.durationHours))}
                            </p>
                            {dropPreview.templateName && (
                              <p className='text-[10px] font-medium text-slate-600 truncate'>{dropPreview.templateName}</p>
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
                        onDragStartNotify={handleEventDragStart}
                        onDragEndNotify={handleEventDragEnd}
                        isDragging={draggingEventId === event.id}
                      />
                    ))}
                    {/* Drop preview ghost (single column) */}
                    {dropPreview && dropPreview.dayIdx === dayIdx && (() => {
                      const isEventDrag = !!dropPreview.eventTitle;
                      const ghostColor = dropPreview.color || '#22C55E';
                      return (
                        <div
                          className={`absolute left-1 right-1 rounded-md border-2 pointer-events-none z-[5] transition-all duration-75 ${isEventDrag ? '' : 'border-dashed'}`}
                          style={{
                            top: (dropPreview.hour - dayStartHour) * HOUR_HEIGHT,
                            height: dropPreview.durationHours * HOUR_HEIGHT,
                            borderColor: ghostColor,
                            backgroundColor: ghostColor + (isEventDrag ? '25' : '15'),
                            borderLeft: isEventDrag ? `3px solid ${ghostColor}` : undefined,
                          }}
                        >
                          <div className='px-1.5 py-1'>
                            {isEventDrag && (
                              <p className='text-[11px] font-bold truncate' style={{ color: ghostColor }}>
                                {dropPreview.eventTitle}
                              </p>
                            )}
                            <p className={`text-[11px] font-bold ${isEventDrag ? 'text-[10px]' : ''}`} style={{ color: ghostColor }}>
                              {formatDecimalToTime(dropPreview.hour)} – {formatDecimalToTime(snapTo15Min(dropPreview.hour + dropPreview.durationHours))}
                            </p>
                            {dropPreview.templateName && (
                              <p className='text-[10px] font-medium text-slate-600 truncate'>{dropPreview.templateName}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
          onCancelFuture={(eventId: string) => {
            closePopover();
            onCancelFutureSessions?.(eventId);
          }}
          onReplaceInstructor={handleReplaceInstructor}
          onReplaceEvent={handleReplaceEvent}
          onEditNotes={handleSaveNotes}
          onOpenEditPanel={onOpenEditPanel ? (ev) => { closePopover(); onOpenEditPanel(ev); } : undefined}
        />
      )}
    </div>
    </div>
  );
}
