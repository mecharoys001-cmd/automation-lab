'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import type { CalendarEvent } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './types';
import { EventPopover } from './EventPopover';
import { useEventPopover } from './useEventPopover';
import { TimeRangeSelector } from './TimeRangeSelector';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DayViewProps {
  events: CalendarEvent[];
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onBackToMonth?: () => void;
  /** Number of scheduling conflicts for this day (shows warning banner). */
  conflicts?: number;
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_START = 8;   // 8 AM
const DEFAULT_END = 15;    // 3 PM
const HOUR_HEIGHT = 64;    // px per hour

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDayTitle(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
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
  if (!match) return DEFAULT_START;
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DayEventBlock({
  event,
  gridStartHour,
  onHover,
  onLeave,
  onClick,
}: {
  event: CalendarEvent;
  gridStartHour: number;
  onHover: (event: CalendarEvent, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (event: CalendarEvent, el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = EVENT_COLORS[event.type];
  const startHour = parseTimeToHour(event.time);
  const endHour = event.endTime ? parseTimeToHour(event.endTime) : startHour + 1;
  const duration = Math.max(endHour - startHour, 0.5);

  const top = (startHour - gridStartHour) * HOUR_HEIGHT;
  const height = duration * HOUR_HEIGHT - 4;

  const blockTooltip = `${event.title} — ${event.time}${event.endTime ? ` – ${event.endTime}` : ''}${event.instructor ? ` · ${event.instructor}` : ''} (${EVENT_TYPE_LABELS[event.type]})`;

  return (
    <Tooltip text={blockTooltip}>
      <div
        ref={ref}
        className="absolute left-1 right-2 rounded-md px-2.5 py-1.5 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
        style={{
          top: `${top}px`,
          height: `${Math.max(height, 28)}px`,
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.accent}`,
        }}
        onMouseEnter={() => ref.current && onHover(event, ref.current)}
        onMouseLeave={onLeave}
        onClick={(e) => { e.stopPropagation(); ref.current && onClick(event, ref.current); }}
      >
        <p
          className="text-[11px] font-semibold leading-tight truncate"
          style={{ color: colors.text }}
        >
          {event.title}
        </p>
        <p className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
          {event.instructor}
          {event.venue ? ` · ${event.venue}` : ''}
        </p>
        {height > 40 && (
          <p className="text-[10px] text-slate-400 leading-tight truncate mt-0.5">
            {event.time}
            {event.endTime ? ` – ${event.endTime}` : ''}
          </p>
        )}
      </div>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// DayView
// ---------------------------------------------------------------------------

export function DayView({
  events,
  currentDate,
  onDateChange,
  onEventClick,
  onBackToMonth,
  conflicts = 0,
  dayStartHour: initialStartHour = DEFAULT_START,
  dayEndHour: initialEndHour = DEFAULT_END,
  onCancelSession,
  onReplaceInstructor,
  onReplaceEvent,
  onEditNotes,
  onOpenEditPanel,
}: DayViewProps) {
  const [viewDate, setViewDate] = useState(
    () => currentDate ?? new Date(),
  );
  const [dayStartHour, setDayStartHour] = useState(initialStartHour);
  const [dayEndHour, setDayEndHour] = useState(initialEndHour);

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

  const dateKey = formatDateKey(viewDate);

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === dateKey),
    [events, dateKey],
  );

  const hours = Array.from(
    { length: dayEndHour - dayStartHour + 1 },
    (_, i) => dayStartHour + i,
  );

  const navigate = (delta: number) => {
    const next = new Date(viewDate);
    next.setDate(next.getDate() + delta);
    setViewDate(next);
    onDateChange?.(next);
  };

  const goToToday = () => {
    const now = new Date();
    setViewDate(now);
    onDateChange?.(now);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ------- Day Navigation Sub-bar ------- */}
      <div className="flex items-center gap-3 bg-white px-6 py-3 border-b border-slate-200 shrink-0">
        <Tooltip text="Previous day">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
        </Tooltip>

        <span className="text-lg font-bold text-slate-900">
          {formatDayTitle(viewDate)}
        </span>

        <Tooltip text="Next day">
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip text="Adjust visible time range">
          <TimeRangeSelector
            startHour={dayStartHour}
            endHour={dayEndHour}
            onStartHourChange={setDayStartHour}
            onEndHourChange={setDayEndHour}
          />
        </Tooltip>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {onBackToMonth && (
          <Tooltip text="Return to month view">
            <button
              onClick={onBackToMonth}
              className="text-[13px] font-medium text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              ← Month View
            </button>
          </Tooltip>
        )}

        <Button variant="today" tooltip="Jump to today" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* ------- Warning Banner ------- */}
      {conflicts > 0 && (
        <Tooltip text={`${conflicts} scheduling conflict${conflicts !== 1 ? 's' : ''} on this day`}>
          <div className="flex items-center gap-2 bg-amber-100 px-6 py-2.5 shrink-0">
            <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-[13px] font-medium text-amber-800">
              Needs Attention: {conflicts} conflict{conflicts !== 1 ? 's' : ''} found
            </span>
          </div>
        </Tooltip>
      )}

      {/* ------- Day Content (Time Column + Event Grid) ------- */}
      <div className="flex flex-1 bg-white overflow-y-auto">
        {/* Time Column */}
        <div className="w-[60px] shrink-0 border-r border-slate-200">
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex items-start justify-end pr-2 text-[11px] font-medium text-slate-400"
              style={{ height: `${HOUR_HEIGHT}px` }}
            >
              <span className="-mt-1.5">{formatHourLabel(hour)}</span>
            </div>
          ))}
        </div>

        {/* Event Grid */}
        <div className="flex-1 relative">
          {/* Hour grid lines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="border-b border-slate-100"
              style={{ height: `${HOUR_HEIGHT}px` }}
            />
          ))}

          {/* Event blocks (absolute-positioned) */}
          {dayEvents.map((event) => (
            <DayEventBlock
              key={event.id}
              event={event}
              gridStartHour={dayStartHour}
              onHover={showPopover}
              onLeave={hidePopover}
              onClick={handleEventClick}
            />
          ))}
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
