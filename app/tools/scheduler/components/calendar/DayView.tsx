'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import type { CalendarEvent } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './types';
import { getSubjectColor } from '../../lib/subjectColors';
import { EventPopover } from './EventPopover';
import { useEventPopover } from './useEventPopover';
import { TimeRangeSelector } from './TimeRangeSelector';
import { usePersistedTimeRange } from '../../hooks/usePersistedTimeRange';
import { VenueToggle } from '../ui/VenueToggle';
import type { VenueOption } from '../ui/VenueToggle';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DayViewProps {
  events: CalendarEvent[];
  /** All venues from database (shows empty venues too). Falls back to deriving from events. */
  venues?: Array<{ id: string; name: string }>;
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
  /** Called when an empty time slot is clicked (for creating one-off events) */
  onEmptySlotClick?: (date: string, time: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_START = 8;   // 8 AM
const DEFAULT_END = 15;    // 3 PM
const HOUR_HEIGHT = 64;    // px per hour
const GRID_TOP_PAD = Math.round(HOUR_HEIGHT * 0.25); // 15-min breathing room so the first time label isn't clipped
const LANE_BACKGROUNDS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

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
  const subjectColor = event.subjects?.[0] ? getSubjectColor(event.subjects[0]) : null;
  const colors = subjectColor
    ? { accent: subjectColor.accent, bg: subjectColor.eventBg, text: subjectColor.eventText }
    : EVENT_COLORS[event.type] ?? { accent: '#64748B', bg: '#F8FAFC', text: '#334155' };
  const startHour = parseTimeToHour(event.time);
  const endHour = event.endTime ? parseTimeToHour(event.endTime) : startHour + 1;
  const duration = Math.max(endHour - startHour, 0.5);

  const top = GRID_TOP_PAD + (startHour - gridStartHour) * HOUR_HEIGHT;
  const height = duration * HOUR_HEIGHT - 4;
  const isCompact = height < 32; // ≤30min events: single-line display

  const blockTooltip = `${event.title} — ${event.time}${event.endTime ? ` – ${event.endTime}` : ''}${event.instructor ? ` · ${event.instructor}` : ''}${event.venue ? ` · ${event.venue}` : ''} (${EVENT_TYPE_LABELS[event.type]})`;

  return (
    <Tooltip text={blockTooltip}>
      <div
        ref={ref}
        data-event-block
        className={`absolute left-1 right-2 rounded-md cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ${isCompact ? 'px-2 py-0.5 flex items-center gap-1.5' : 'px-2.5 py-1.5'}`}
        style={{
          top: `${top}px`,
          height: `${Math.max(height, 22)}px`,
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.accent}`,
        }}
        onClick={(e) => { e.stopPropagation(); ref.current && onClick(event, ref.current); }}
      >
        {isCompact ? (
          <>
            <p className="text-[10px] font-semibold leading-none truncate" style={{ color: colors.text }}>
              {event.title}
            </p>
            <p className="text-[9px] text-slate-600 leading-none shrink-0">
              {event.time}
            </p>
          </>
        ) : (
          <>
            <p
              className="text-[11px] font-semibold leading-tight truncate"
              style={{ color: colors.text }}
            >
              {event.title}
            </p>
            <p className="text-[10px] text-slate-600 leading-tight truncate mt-0.5">
              {event.instructor}
              {event.venue ? ` · ${event.venue}` : ''}
            </p>
            {height > 40 && (
              <p className="text-[10px] text-slate-700 leading-tight truncate mt-0.5">
                {event.time}
                {event.endTime ? ` – ${event.endTime}` : ''}
              </p>
            )}
          </>
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
  venues: venuesProp,
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
  onEmptySlotClick,
}: DayViewProps) {
  const [viewDate, setViewDate] = useState(
    () => currentDate ?? new Date(),
  );
  const { startHour: dayStartHour, endHour: dayEndHour, setStartHour: setDayStartHour, setEndHour: setDayEndHour } = usePersistedTimeRange(initialStartHour, initialEndHour);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

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
      const allVenueIds = allVenues.map((v) => v.id);
      setSelectedVenues(allVenueIds);
    }
  }, [allVenues]);

  const multiLane = selectedVenues.length > 1;

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

  // Filter events to only selected venues
  const filteredEvents = useMemo(
    () => multiLane
      ? dayEvents.filter((e) => !e.venue || selectedVenues.includes(e.venue))
      : dayEvents,
    [dayEvents, multiLane, selectedVenues],
  );

  // Render grid starting 15 minutes (0.25 hours) before the visible start time
  // so the top time label has breathing room and isn't clipped
  const gridStartHour = dayStartHour - 0.25;
  const hours = Array.from(
    { length: dayEndHour - dayStartHour + 1 },
    (_, i) => dayStartHour + i,
  );

  const totalHeight = hours.length * HOUR_HEIGHT + GRID_TOP_PAD;

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
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        </Tooltip>

        <span className="text-lg font-bold text-slate-900">
          {formatDayTitle(viewDate)}
        </span>

        <Tooltip text="Next day">
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Next day"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
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
              className="text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              ← Month View
            </button>
          </Tooltip>
        )}

        <Button variant="today" tooltip="Jump to today" onClick={goToToday}>
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

      {/* ------- Conflict Icon ------- */}
      {conflicts > 0 && (
        <div className="px-6 py-1.5 shrink-0 flex items-center">
          <Tooltip text={`Needs Attention: ${conflicts} scheduling conflict${conflicts !== 1 ? 's' : ''} on this day`}>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
              <TriangleAlert className="w-3.5 h-3.5 text-amber-800" />
            </div>
          </Tooltip>
        </div>
      )}

      {/* ------- Day Content (Time Column + Lane Headers + Event Grid) ------- */}
      <div className="flex-1 overflow-y-auto bg-white relative" style={{ minWidth: 0 }}>
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
          className="grid min-h-full"
          style={{
            gridTemplateColumns: `60px 1fr`,
            gridTemplateRows: multiLane ? 'auto 1fr' : '1fr',
          }}
        >
          {/* Lane sub-headers (only when multi-lane) */}
          {multiLane && (
            <>
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200" style={{ gridRow: 1 }} />
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex" style={{ gridRow: 1 }}>
                {selectedVenues.map((venueId, laneIdx) => (
                  <div
                    key={venueId}
                    className={`flex-1 text-[11px] font-semibold text-slate-600 py-2 text-center truncate px-1 ${
                      laneIdx < selectedVenues.length - 1 ? 'border-r border-slate-100' : ''
                    }`}
                  >
                    {venueId}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Time gutter */}
          <div
            className="border-r border-slate-200 bg-slate-50"
            style={{ gridRow: multiLane ? 2 : 1 }}
          >
            <div style={{ height: `${GRID_TOP_PAD}px` }} />
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-2 text-[11px] font-medium text-slate-700"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="-mt-1.5">{formatHourLabel(hour)}</span>
              </div>
            ))}
          </div>

          {/* Event grid area */}
          <div
            className="relative"
            style={{ gridRow: multiLane ? 2 : 1, minHeight: `${totalHeight}px` }}
            onClick={
              onEmptySlotClick
                ? (e) => {
                    if ((e.target as HTMLElement).closest('[data-event-block]')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const rawHour = dayStartHour + (clickY - GRID_TOP_PAD) / HOUR_HEIGHT;
                    const snapped = snapTo15Min(rawHour);
                    onEmptySlotClick(formatDateKey(viewDate), formatDecimalTo24h(snapped));
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
                  top: `${GRID_TOP_PAD + hIdx * HOUR_HEIGHT}px`,
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
                  top: `${GRID_TOP_PAD + hIdx * HOUR_HEIGHT + HOUR_HEIGHT / 2}px`,
                }}
              />
            ))}

            {multiLane ? (
              /* Multi-lane rendering: split into venue lanes */
              <div className="absolute inset-0 flex">
                {selectedVenues.map((venueId, laneIdx) => {
                  const laneEvents = filteredEvents.filter(
                    (e) => e.venue === venueId,
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
                  );
                })}
              </div>
            ) : (
              /* Single column rendering */
              <div className="absolute inset-0 px-1.5">
                {filteredEvents.map((event) => (
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
            )}
          </div>
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
          onOpenEditPanel={onOpenEditPanel ? (ev) => { closePopover(); onOpenEditPanel(ev); } : undefined}
        />
      )}
    </div>
  );
}
