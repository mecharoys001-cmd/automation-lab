'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Calendar, ChevronUp, Loader2, Ban, Clock } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import type { CalendarEvent, EventType } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './types';
import { getSubjectColor } from '../../lib/subjectColors';
import { EventPopover } from './EventPopover';
import { useEventPopover } from './useEventPopover';
import { VenueToggle } from '../ui/VenueToggle';
import type { VenueOption } from '../ui/VenueToggle';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface YearViewProps {
  events: CalendarEvent[];
  /** All venues from database (shows empty venues too). Falls back to deriving from events. */
  venues?: Array<{ id: string; name: string }>;
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  onTodayClick?: () => void;
  /** School calendar entries (no school, early dismissal, etc.) */
  schoolCalendar?: Array<{
    date: string; // YYYY-MM-DD
    status_type: 'no_school' | 'early_dismissal' | 'instructor_exception';
    description?: string | null;
    early_dismissal_time?: string | null;
  }>;
  /** Called when user cancels a session via popover */
  onCancelSession?: (eventId: string) => void;
  /** Called when user wants to replace instructor */
  onReplaceInstructor?: (eventId: string, substituteId?: string) => void;
  /** Called when user wants to replace event */
  onReplaceEvent?: (eventId: string, templateId?: string) => void;
  /** Called when user saves notes */
  onEditNotes?: (eventId: string, notes: string) => void;
  /** Called when user wants to open the full edit panel for an event */
  onOpenEditPanel?: (event: CalendarEvent) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LANE_BACKGROUNDS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

/** Abbreviate a venue name for compact display (e.g. "Auditorium" → "Aud") */
function venueAbbrev(name: string): string {
  if (name.length <= 4) return name;
  return name.slice(0, 3);
}

/** How many months to initially show before and after the current month */
const INITIAL_RANGE = 6;

/** How many months to load when scrolling near top/bottom */
const LOAD_INCREMENT = 3;

/** Brief delay (ms) to show loading indicator for perceived smoothness */
const LOAD_DELAY = 150;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialMonths(): { year: number; month: number }[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  const months: { year: number; month: number }[] = [];

  for (let offset = -INITIAL_RANGE; offset <= INITIAL_RANGE; offset++) {
    const m = addMonths({ year: currentYear, month: currentMonth }, offset);
    months.push(m);
  }

  return months;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function addMonths(
  base: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  let y = base.year;
  let m = base.month + delta;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return { year: y, month: m };
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

function LegendItem({ type }: { type: EventType }) {
  const colors = EVENT_COLORS[type] ?? { accent: '#64748B', bg: '#F8FAFC', text: '#334155' };

  return (
    <Tooltip text={`${EVENT_TYPE_LABELS[type]} events`}>
      <div className="flex items-center gap-1.5">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: colors.accent }}
        />
        <span className="text-xs font-medium text-slate-600">
          {EVENT_TYPE_LABELS[type]}
        </span>
      </div>
    </Tooltip>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-6 gap-2 text-slate-700">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-xs font-medium">Loading more months…</span>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  eventsByDate,
  todayKey,
  schoolCalendarByDate,
  selectedVenues,
  multiLane,
  onEventHover,
  onEventLeave,
  onEventClick,
  onDayClick,
}: {
  year: number;
  month: number; // 1-based
  eventsByDate: Record<string, CalendarEvent[]>;
  todayKey: string;
  schoolCalendarByDate: Record<string, { date: string; status_type: string; description?: string | null; early_dismissal_time?: string | null }>;
  selectedVenues: string[];
  multiLane: boolean;
  onEventHover: (event: CalendarEvent, el: HTMLElement) => void;
  onEventLeave: () => void;
  onEventClick: (event: CalendarEvent, el: HTMLElement) => void;
  onDayClick?: (date: Date) => void;
}) {
  const jsMonth = month - 1;
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const firstDayOfWeek = useMemo(() => new Date(year, jsMonth, 1).getDay(), [year, jsMonth]);
  const monthKey = formatMonthKey(year, month);
  const eventCount = Object.keys(eventsByDate).reduce((sum, key) => {
    if (key.startsWith(monthKey)) return sum + eventsByDate[key].length;
    return sum;
  }, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Month Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/50">
        <h3 className="text-[15px] font-bold text-slate-900">
          {MONTH_NAMES[jsMonth]} {year}
        </h3>
        {eventCount > 0 && (
          <Tooltip text={`${eventCount} total event${eventCount !== 1 ? 's' : ''} in ${MONTH_NAMES[jsMonth]}`}>
            <span className="text-xs font-medium text-slate-700">
              {eventCount} event{eventCount !== 1 ? 's' : ''}
            </span>
          </Tooltip>
        )}
      </div>

      {/* Day Headers + Day Cells — single flat grid */}
      <div className="grid grid-cols-7" style={{ width: '100%', minWidth: 0 }}>
        {/* Day Headers — pinned to grid-row 1 */}
        {DAY_HEADERS.map((label, idx) => (
          <div
            key={label}
            style={{ gridRow: 1 }}
            className={`px-1.5 py-2 text-center text-[11px] font-semibold text-slate-700 tracking-[1px] uppercase border-b border-slate-200 bg-white sticky top-0 z-10 box-border ${
              idx < 6 ? 'border-r border-slate-200' : ''
            }`}
          >
            {label}
          </div>
        ))}
        {/* Day Cells — auto-flow into rows 2+, first day uses grid-column-start */}
        {/* ⚠️ 42-CELL GRID — DO NOT change to daysInMonth! See CALENDAR-GRID-WARNING.md */}
        {Array.from({ length: 42 }, (_, cellIndex) => {
          const dayNumber = cellIndex - firstDayOfWeek + 1;

          // Empty cell before month starts or after month ends
          if (dayNumber < 1 || dayNumber > daysInMonth) {
            return <div key={cellIndex} className="border-b border-slate-200 bg-slate-50/30" />;
          }

          const date = new Date(year, jsMonth, dayNumber);
          const dateKey = formatDateKey(date);
          const isToday = dateKey === todayKey;
          const dayEvents = eventsByDate[dateKey] || [];
          const schoolEntry = schoolCalendarByDate[dateKey];
          const dayOfWeek = cellIndex % 7;

          return (
            <Tooltip
              key={cellIndex}
              text={`${DAY_HEADERS[dayOfWeek]}, ${MONTH_NAMES[jsMonth]} ${dayNumber}${
                dayEvents.length ? ` — ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''
              }`}
              style={{ gridColumn: 'auto' }}
            >
              <div
                className={`px-1.5 py-2 cursor-pointer hover:bg-slate-50 transition-colors min-h-[100px] border-b border-slate-200 bg-white box-border ${
                  dayOfWeek < 6 ? 'border-r border-slate-200' : ''
                }`}
                onClick={() => onDayClick?.(date)}
              >
                <span
                  className={`inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full mb-0.5 ${
                    isToday ? 'bg-blue-500 text-white' : 'text-slate-900'
                  }`}
                >
                  {dayNumber}
                </span>

                {schoolEntry && (
                  <div className="mb-1 flex justify-center">
                    {schoolEntry.status_type === 'no_school' && (
                      <Tooltip text={`No School${schoolEntry.description ? ': ' + schoolEntry.description : ''}`}>
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 border border-amber-300">
                          <Ban className="w-3 h-3 text-amber-800" />
                        </div>
                      </Tooltip>
                    )}
                    {schoolEntry.status_type === 'early_dismissal' && (
                      <Tooltip text={`Early Dismissal${schoolEntry.early_dismissal_time ? ' at ' + schoolEntry.early_dismissal_time.slice(0, 5) : ''}`}>
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 border border-blue-300">
                          <Clock className="w-3 h-3 text-blue-700" />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                )}

                {multiLane ? (
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
                            {laneEvents.slice(0, 1).map((event) => (
                              <EventChip
                                key={event.id}
                                event={event}
                                onHover={onEventHover}
                                onLeave={onEventLeave}
                                onClick={onEventClick}
                              />
                            ))}
                            {laneEvents.length > 1 && (
                              <div className="text-[7px] text-slate-700 text-center">
                                +{laneEvents.length - 1}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        onHover={onEventHover}
                        onLeave={onEventLeave}
                        onClick={onEventClick}
                      />
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[8px] text-slate-700 text-center leading-tight">
                        +{dayEvents.length - 2}
                      </div>
                    )}
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

// ---------------------------------------------------------------------------
// YearView (Infinite-Scroll Monthly View)
// ---------------------------------------------------------------------------

export function YearView({
  events,
  venues: venuesProp,
  currentDate,
  onDateChange,
  onEventClick,
  onDayClick,
  onTodayClick,
  schoolCalendar = [],
  onCancelSession,
  onReplaceInstructor,
  onReplaceEvent,
  onEditNotes,
  onOpenEditPanel,
}: YearViewProps) {
  const [visibleMonths, setVisibleMonths] = useState(buildInitialMonths);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingBottom, setLoadingBottom] = useState(false);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Track whether we should preserve scroll position after prepending months
  const scrollHeightBeforeLoad = useRef<number>(0);

  // Popover state
  const { popoverState, showPopover, hidePopover, pinPopover, closePopover, handleEventClick } = useEventPopover();

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [events]);

  const todayKey = formatDateKey(new Date());

  const schoolCalendarByDate = useMemo(() => {
    const map: Record<string, typeof schoolCalendar[0]> = {};
    schoolCalendar.forEach(entry => {
      map[entry.date] = entry;
    });
    return map;
  }, [schoolCalendar]);

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

  // Unique event types for legend
  const activeTypes = useMemo(() => {
    const types = new Set<EventType>();
    for (const event of events) types.add(event.type);
    return Array.from(types);
  }, [events]);

  // Find which month contains today for scroll-to-today
  const todayMonth = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, []);

  // -------------------------------------------------------------------------
  // Popover callbacks (placeholder API calls)
  // -------------------------------------------------------------------------

  const handleSaveNotes = useCallback(async (eventId: string, notes: string) => {
    try {
      await fetch('/api/session-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: eventId, note: notes }),
      });
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
    onEditNotes?.(eventId, notes);
  }, [onEditNotes]);

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

  const handleReplaceEvent = useCallback(async (eventId: string, templateId?: string) => {
    try {
      console.log('Find replacement event for:', eventId, templateId);
    } catch (err) {
      console.error('Failed to find replacement:', err);
    }
    onReplaceEvent?.(eventId, templateId);
  }, [onReplaceEvent]);

  // -------------------------------------------------------------------------
  // Infinite scroll: load more months
  // -------------------------------------------------------------------------

  const loadMoreTop = useCallback(() => {
    if (loadingTop) return;
    setLoadingTop(true);

    // Capture scroll height before adding months so we can preserve position
    if (scrollRef.current) {
      scrollHeightBeforeLoad.current = scrollRef.current.scrollHeight;
    }

    setTimeout(() => {
      setVisibleMonths((prev) => {
        const first = prev[0];
        const newMonths: { year: number; month: number }[] = [];
        for (let i = LOAD_INCREMENT; i >= 1; i--) {
          newMonths.push(addMonths(first, -i));
        }
        return [...newMonths, ...prev];
      });
      setLoadingTop(false);
    }, LOAD_DELAY);
  }, [loadingTop]);

  const loadMoreBottom = useCallback(() => {
    if (loadingBottom) return;
    setLoadingBottom(true);

    setTimeout(() => {
      setVisibleMonths((prev) => {
        const last = prev[prev.length - 1];
        const newMonths: { year: number; month: number }[] = [];
        for (let i = 1; i <= LOAD_INCREMENT; i++) {
          newMonths.push(addMonths(last, i));
        }
        return [...prev, ...newMonths];
      });
      setLoadingBottom(false);
    }, LOAD_DELAY);
  }, [loadingBottom]);

  // Preserve scroll position after prepending months at the top
  useEffect(() => {
    if (!loadingTop && scrollHeightBeforeLoad.current > 0 && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      const delta = newScrollHeight - scrollHeightBeforeLoad.current;
      if (delta > 0) {
        scrollRef.current.scrollTop += delta;
      }
      scrollHeightBeforeLoad.current = 0;
    }
  }, [loadingTop, visibleMonths]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (entry.target === topSentinelRef.current) {
              loadMoreTop();
            } else if (entry.target === bottomSentinelRef.current) {
              loadMoreBottom();
            }
          }
        }
      },
      { root: scrollEl, rootMargin: '200px' },
    );

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);

    return () => observer.disconnect();
  }, [loadMoreTop, loadMoreBottom]);

  // Show/hide back-to-top based on scroll
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      setShowBackToTop(scrollEl.scrollTop > 600);
    };
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to today's month on initial mount
  useEffect(() => {
    // Small delay to let the DOM settle
    const timer = setTimeout(() => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    onDateChange?.(date);
    onDayClick?.(date);
  }, [onDateChange, onDayClick]);

  const scrollToToday = useCallback(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onTodayClick?.();
  }, [onTodayClick]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
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

      {/* ------- Scrollable Months ------- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#F8FAFC] px-6 py-4">
        {/* Top sentinel for loading earlier months */}
        <div ref={topSentinelRef} className="h-1" />

        {/* Top loading indicator */}
        {loadingTop && <LoadingIndicator />}

        <div className="max-w-5xl mx-auto space-y-6">
          {visibleMonths.map(({ year, month }) => {
            const key = formatMonthKey(year, month);
            const isTodayMonth =
              year === todayMonth.year && month === todayMonth.month;

            return (
              <div key={key} ref={isTodayMonth ? todayRef : undefined}>
                <MonthGrid
                  year={year}
                  month={month}
                  eventsByDate={eventsByDate}
                  todayKey={todayKey}
                  schoolCalendarByDate={schoolCalendarByDate}
                  selectedVenues={selectedVenues}
                  multiLane={multiLane}
                  onEventHover={showPopover}
                  onEventLeave={hidePopover}
                  onEventClick={handleEventClick}
                  onDayClick={handleDayClick}
                />
              </div>
            );
          })}

          {/* Event Legend */}
          {activeTypes.length > 0 && (
            <div className="flex items-center gap-4 pt-2 pb-4">
              {activeTypes.map((type) => (
                <LegendItem key={type} type={type} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom loading indicator */}
        {loadingBottom && <LoadingIndicator />}

        {/* Bottom sentinel for loading later months */}
        <div ref={bottomSentinelRef} className="h-1" />
      </div>

      {/* ------- Floating Buttons ------- */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        {showBackToTop && (
          <Tooltip text="Scroll to top">
            <button
              onClick={scrollToTop}
              className="inline-flex items-center justify-center w-10 h-10 bg-white text-slate-600 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              aria-label="Scroll to top"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </Tooltip>
        )}
        <Tooltip text="Jump to today">
          <button
            onClick={scrollToToday}
            className="inline-flex items-center gap-1.5 bg-blue-500 text-white px-5 py-2.5 rounded-full shadow-lg hover:bg-blue-600 transition-colors cursor-pointer text-[13px] font-semibold"
          >
            <Calendar className="w-4 h-4" />
            Today
          </button>
        </Tooltip>
      </div>

      {/* ------- Event Popover ------- */}
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
