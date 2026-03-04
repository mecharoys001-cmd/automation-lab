'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import type { CalendarEvent } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './types';
import { EventPopover } from './EventPopover';
import { useEventPopover } from './useEventPopover';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventChip({
  event,
  onHover,
  onLeave,
  onClick,
}: {
  event: CalendarEvent;
  onHover: (event: CalendarEvent, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = EVENT_COLORS[event.type];
  const chipTooltip = `${event.title} — ${event.time}${event.instructor ? ` · ${event.instructor}` : ''} (${EVENT_TYPE_LABELS[event.type]})`;

  return (
    <Tooltip text={chipTooltip}>
      <div
        ref={ref}
        className="flex flex-col rounded px-1.5 py-1 mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.bg,
          borderLeft: `2px solid ${colors.accent}`,
        }}
        onMouseEnter={() => ref.current && onHover(event, ref.current)}
        onMouseLeave={onLeave}
        onClick={(e) => {
          e.stopPropagation();
          ref.current && onClick(event, ref.current);
        }}
      >
        <span
          className="text-[10px] font-medium truncate"
          style={{ color: colors.text }}
        >
          {event.title}
        </span>
        {event.instructor && (
          <span className="text-[9px] text-slate-500 truncate leading-tight">
            {event.instructor}
          </span>
        )}
        {event.gradeLevel && (
          <span className="text-[9px] text-slate-400 truncate leading-tight">
            {event.gradeLevel}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// MonthView
// ---------------------------------------------------------------------------

export function MonthView({
  events,
  currentDate,
  onDateChange,
  onDayClick,
  onEventClick,
  onCancelSession,
  onReplaceInstructor,
  onReplaceEvent,
  onEditNotes,
  onOpenEditPanel,
}: MonthViewProps) {
  const [viewDate, setViewDate] = useState(
    () => currentDate ?? new Date(),
  );
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Popover state
  const { popoverState, showPopover, hidePopover, pinPopover, closePopover, handleEventClick } = useEventPopover();
  const [eventDetails, setEventDetails] = useState<Record<string, unknown> | null>(null);

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

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayOfWeek = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [events]);

  const todayKey = formatDateKey(new Date());

  const navigate = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setViewDate(next);
    onDateChange?.(next);
  };

  const goToToday = () => {
    const now = new Date();
    setViewDate(now);
    onDateChange?.(now);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
      {/* ------- Month Navigation Sub-bar ------- */}
      <div className="flex items-center gap-3 bg-white px-6 py-3 border-b border-slate-200 shrink-0">
        <Tooltip text="Previous month">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
        </Tooltip>

        <span className="text-lg font-bold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </span>

        <Tooltip text="Next month">
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <Button variant="today" tooltip="Jump to current month" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* ------- Unified Grid (sticky headers + day columns) ------- */}
      <div className="flex-1 overflow-y-auto bg-white" style={{ minWidth: 0 }}>
        <div
          className="grid min-h-full"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'auto',
            gridAutoRows: 'minmax(100px, 1fr)',
          }}
        >
          {/* Row 1: Sticky day headers */}
          {DAY_HEADERS.map((label, idx) => (
            <div
              key={`hdr-${idx}`}
              className={`sticky top-0 z-10 bg-white px-1.5 py-2 border-b border-slate-200 text-center box-border ${
                idx < 6 ? 'border-r border-slate-100' : ''
              }`}
              style={{ gridRow: 1 }}
            >
              <div className="text-[11px] font-semibold tracking-[1px] text-slate-400">{label}</div>
            </div>
          ))}

          {/* Rows 2+: Day cells */}
          {/* ⚠️ 42-CELL GRID — DO NOT change to daysInMonth! See CALENDAR-GRID-WARNING.md */}
          {Array.from({ length: 42 }, (_, cellIndex) => {
            const dayNumber = cellIndex - firstDayOfWeek + 1;

            // Empty cell before month starts or after month ends
            if (dayNumber < 1 || dayNumber > daysInMonth) {
              return <div key={cellIndex} className="border-b border-slate-100 bg-slate-50/30" />;
            }

            const date = new Date(year, month, dayNumber);
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const dayEvents = eventsByDate[dateKey] || [];
            const dayOfWeek = cellIndex % 7;

            return (
              <Tooltip
                key={cellIndex}
                text={`${DAY_HEADERS[dayOfWeek]}, ${MONTH_NAMES[month]} ${dayNumber}${
                  dayEvents.length ? ` — ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''
                }`}
                style={{ gridColumn: 'auto' }}
              >
                <div
                  className={`relative px-1.5 py-2 cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden border-b border-slate-100 box-border ${
                    dayOfWeek < 6 ? 'border-r border-slate-100' : ''
                  } ${isToday ? 'bg-blue-50/30' : ''}`}
                  onClick={() => onDayClick?.(date)}
                >
                  <span
                    className={`inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full mb-0.5 ${
                      isToday ? 'bg-blue-500 text-white' : 'text-slate-900'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        onHover={showPopover}
                        onLeave={hidePopover}
                        onClick={handleEventClick}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <Tooltip text={`${dayEvents.length - 3} more event${dayEvents.length - 3 > 1 ? 's' : ''} — click day to view all`}>
                        <span className="text-[10px] text-slate-400 font-medium pl-1 cursor-pointer hover:text-slate-600 transition-colors">
                          +{dayEvents.length - 3} more
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Tooltip>
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
  );
}
