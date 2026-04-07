'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Ban, Clock, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import type { CalendarEvent, SchoolCalendarEntry } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS, buildStatusTooltip } from './types';
import { getSubjectColor } from '../../lib/subjectColors';
import { EventPopover } from './EventPopover';
import { useEventPopover } from './useEventPopover';
import { VenueToggle } from '../ui/VenueToggle';
import type { VenueOption } from '../ui/VenueToggle';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonthViewProps {
  events: CalendarEvent[];
  /** All venues from database (shows empty venues too). Falls back to deriving from events. */
  venues?: Array<{ id: string; name: string }>;
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  /** School calendar entries (no school, early dismissal, etc.) */
  schoolCalendar?: SchoolCalendarEntry[];
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

const LANE_BACKGROUNDS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

/** Abbreviate a venue name for mini-lane headers (e.g. "Auditorium" → "Aud") */
function venueAbbrev(name: string): string {
  if (name.length <= 4) return name;
  // Use first 3 chars
  return name.slice(0, 3);
}

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
  const subjectColor = event.subjects?.[0] ? getSubjectColor(event.subjects[0]) : null;
  const colors = subjectColor
    ? { accent: subjectColor.accent, bg: subjectColor.eventBg, text: subjectColor.eventText }
    : EVENT_COLORS[event.type] ?? { accent: '#64748B', bg: '#F8FAFC', text: '#334155' };
  const chipTooltip = `${event.title} — ${event.time}${event.instructor ? ` · ${event.instructor}` : ''}${event.venue ? ` · ${event.venue}` : ''} (${EVENT_TYPE_LABELS[event.type]})`;

  return (
    <Tooltip text={chipTooltip}>
      <div
        ref={ref}
        className="flex flex-col rounded px-1.5 py-1 mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.bg,
          borderLeft: `2px solid ${colors.accent}`,
        }}
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
          <span className="text-[9px] text-slate-600 truncate leading-tight">
            {event.instructor}
          </span>
        )}
        {event.venue && (
          <span className="text-[9px] text-slate-700 truncate leading-tight">
            {event.venue}
          </span>
        )}
        {event.gradeLevel && (
          <span className="text-[9px] text-slate-700 truncate leading-tight">
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
  venues: venuesProp,
  currentDate,
  onDateChange,
  onDayClick,
  onEventClick,
  schoolCalendar = [],
  onCancelSession,
  onReplaceInstructor,
  onReplaceEvent,
  onEditNotes,
  onOpenEditPanel,
}: MonthViewProps) {
  const [viewDate, setViewDate] = useState(
    () => currentDate ?? new Date(),
  );
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

  // Sync viewDate when parent changes currentDate externally
  useEffect(() => {
    if (currentDate) setViewDate(currentDate);
  }, [currentDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

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
  const numLanes = selectedVenues.length;

  // Column width scales with venue count: 1 lane = equal 1fr, 2+ lanes = wider columns
  const gridTemplateColumns = useMemo(() => {
    if (numLanes <= 1) return 'repeat(7, minmax(0, 1fr))';
    const minWidth = 120 + numLanes * 60; // e.g. 2 lanes = 240px, 3 = 300px, 4 = 360px
    return `repeat(7, minmax(${minWidth}px, 1fr))`;
  }, [numLanes]);

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

  // Build school calendar map by date
  const schoolCalendarByDate = useMemo(() => {
    const map: Record<string, typeof schoolCalendar[0]> = {};
    schoolCalendar.forEach(entry => {
      map[entry.date] = entry;
    });
    return map;
  }, [schoolCalendar]);

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
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        </Tooltip>

        <span className="text-lg font-bold text-slate-900">
          {MONTH_NAMES[month]} {year}
        </span>

        <Tooltip text="Next month">
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <Button variant="today" tooltip="Jump to current month" onClick={goToToday}>
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

      {/* ------- Unified Grid (sticky headers + day columns) ------- */}
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
          className="grid min-h-full"
          style={{
            gridTemplateColumns,
            gridTemplateRows: 'auto',
            gridAutoRows: 'auto',
          }}
        >
          {/* Row 1: Sticky day headers */}
          {DAY_HEADERS.map((label, idx) => (
            <div
              key={`hdr-${idx}`}
              className={`sticky top-0 z-10 bg-white px-1.5 py-2 border-b border-slate-300 text-center box-border ${
                idx < 6 ? 'border-r border-slate-200' : ''
              }`}
              style={{ gridRow: 1 }}
            >
              <div className="text-[11px] font-semibold tracking-[1px] text-slate-700">{label}</div>
            </div>
          ))}

          {/* Rows 2+: Day cells */}
          {/* ⚠️ 42-CELL GRID — DO NOT change to daysInMonth! See CALENDAR-GRID-WARNING.md */}
          {Array.from({ length: 42 }, (_, cellIndex) => {
            const dayNumber = cellIndex - firstDayOfWeek + 1;

            // Empty cell before month starts or after month ends
            if (dayNumber < 1 || dayNumber > daysInMonth) {
              return <div key={cellIndex} className="border-b border-slate-200 bg-slate-50/30" />;
            }

            const date = new Date(year, month, dayNumber);
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const dayEvents = eventsByDate[dateKey] || [];
            const schoolEntry = schoolCalendarByDate[dateKey];
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
                  className={`relative px-1.5 py-2 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-200 box-border min-h-[100px] overflow-hidden ${
                    dayOfWeek < 6 ? 'border-r border-slate-200' : ''
                  } ${isToday ? 'bg-blue-50/30' : ''}`}
                  style={{ minWidth: 0 }}
                  onClick={() => onDayClick?.(date)}
                >
                  <span
                    className={`inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full mb-0.5 ${
                      isToday ? 'bg-blue-600 text-white' : 'text-slate-900'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  {schoolEntry && (
                    <div className="mb-2 flex justify-center">
                      {schoolEntry.status_type === 'no_school' && (
                        <Tooltip text={buildStatusTooltip(schoolEntry)}>
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 border border-amber-300">
                            <Ban className="w-3.5 h-3.5 text-amber-800" />
                          </div>
                        </Tooltip>
                      )}
                      {schoolEntry.status_type === 'early_dismissal' && (
                        <Tooltip text={buildStatusTooltip(schoolEntry)}>
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 border border-blue-300">
                            <Clock className="w-3.5 h-3.5 text-blue-700" />
                          </div>
                        </Tooltip>
                      )}
                      {schoolEntry.status_type === 'instructor_exception' && (
                        <Tooltip text={buildStatusTooltip(schoolEntry)}>
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 border border-purple-300">
                            <CalendarDays className="w-3.5 h-3.5 text-purple-700" />
                          </div>
                        </Tooltip>
                      )}
                    </div>
                  )}

                  {multiLane ? (
                    /* Mini-lane rendering per day cell */
                    <div className="flex gap-px">
                      {selectedVenues.map((venueId, laneIdx) => {
                        const laneEvents = dayEvents.filter(
                          (e) => e.venue === venueId,
                        );
                        return (
                          <div
                            key={venueId}
                            className="flex-1 min-w-0"
                            style={{
                              backgroundColor: LANE_BACKGROUNDS[laneIdx % LANE_BACKGROUNDS.length],
                              borderRadius: '3px',
                              padding: '1px',
                            }}
                          >
                            <div className="text-[8px] font-bold text-slate-700 text-center leading-tight mb-0.5 truncate">
                              {venueAbbrev(venueId)}
                            </div>
                            <div className="space-y-0.5">
                              {laneEvents.slice(0, 2).map((event) => (
                                <EventChip
                                  key={event.id}
                                  event={event}
                                  onHover={showPopover}
                                  onLeave={hidePopover}
                                  onClick={handleEventClick}
                                />
                              ))}
                              {laneEvents.length > 2 && (
                                <div className="text-[8px] text-slate-700 text-center">
                                  +{laneEvents.length - 2}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
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
                        <button
                          className="w-full text-[10px] font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded px-1 py-0.5 transition-colors cursor-pointer text-left"
                          onClick={(e) => { e.stopPropagation(); onDayClick?.(date); }}
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                    </div>
                  )}
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
          onOpenEditPanel={onOpenEditPanel ? (ev) => { closePopover(); onOpenEditPanel(ev); } : undefined}
        />
      )}
    </div>
  );
}
