'use client';

import { useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventDropArg, EventInput, DatesSetArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';

import { getSubjectColor } from '../lib/subjectColors';

/**
 * Tag-to-emoji mapping for calendar event prefixes.
 * Subject emojis are pulled from the unified color system; non-subject tags are mapped here.
 */
const EXTRA_TAG_EMOJI_MAP: { patterns: string[]; emoji: string }[] = [
  { patterns: ['field trip', 'guest artist'],             emoji: '\u{1F3AD}' },
  { patterns: ['showcase'],                              emoji: '\u{1F31F}' },
  { patterns: ['ta check-in', 'ta check-ins'],           emoji: '\u{1F4CB}' },
  { patterns: ['lead tas away'],                         emoji: '\u{1F465}' },
];

const DEFAULT_EMOJI = '\u{1F3B5}';

function getEmojiForTags(tags?: { name: string }[]): string {
  if (!tags || tags.length === 0) return DEFAULT_EMOJI;
  for (const tag of tags) {
    const lower = tag.name.toLowerCase();
    // Check unified subject colors first
    const subjectColor = getSubjectColor(tag.name);
    if (subjectColor.emoji !== DEFAULT_EMOJI) return subjectColor.emoji;
    // Fall back to extra non-subject patterns
    for (const entry of EXTRA_TAG_EMOJI_MAP) {
      if (entry.patterns.some((p) => lower.includes(p))) {
        return entry.emoji;
      }
    }
  }
  return DEFAULT_EMOJI;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  draft:     { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
  published: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  canceled:  { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
  completed: { bg: '#22c55e', border: '#16a34a', text: '#ffffff' },
};

interface SessionCalendarProps {
  events?: EventInput[];
  onEventClick?: (info: EventClickArg) => void;
  onDateSelect?: (info: DateSelectArg) => void;
  onDateClick?: (info: DateClickArg) => void;
  onEventDrop?: (info: EventDropArg) => void;
}

export interface SessionCalendarHandle {
  goToDay: (date: string) => void;
}

const NARROW_BREAKPOINT = 768;

const SessionCalendar = forwardRef<SessionCalendarHandle, SessionCalendarProps>(function SessionCalendar({
  events = [],
  onEventClick,
  onDateSelect,
  onDateClick,
  onEventDrop,
}, ref) {
  const calendarRef = useRef<FullCalendar>(null);
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < NARROW_BREAKPOINT : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => {
      setIsNarrow(e.matches);
      const api = calendarRef.current?.getApi();
      if (api) {
        api.changeView(e.matches ? 'timeGridDay' : 'timeGridWeek');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /**
   * Auto-scroll logic: finds the earliest event on the given date and scrolls
   * the time-grid to ~30 minutes before it so the user sees context above the
   * first event. Falls back to 09:00 if no events exist for the day, or to the
   * current time if viewing today with no events.
   */
  const autoScrollToFirstEvent = useCallback((api: ReturnType<FullCalendar['getApi']>, targetDate?: Date) => {
    // Only scroll in time-grid views (week/day) — month view has no time axis
    const viewType = api.view.type;
    if (!viewType.startsWith('timeGrid')) return;

    const refDate = targetDate ?? api.view.currentStart;
    const refDateStr = refDate.toISOString().slice(0, 10); // YYYY-MM-DD

    // Collect start times for events falling on the reference date
    const dayEvents = api.getEvents().filter((ev) => {
      const start = ev.start;
      return start && start.toISOString().slice(0, 10) === refDateStr;
    });

    let scrollHour: number;
    let scrollMinute: number;

    if (dayEvents.length > 0) {
      // Find the earliest event start on this day
      const earliest = dayEvents.reduce((a, b) =>
        (a.start!.getTime() < b.start!.getTime() ? a : b)
      );
      // Scroll to 30 minutes before the earliest event for context
      const earlyStart = new Date(earliest.start!.getTime() - 30 * 60_000);
      scrollHour = earlyStart.getHours();
      scrollMinute = earlyStart.getMinutes();
    } else {
      // No events — use current time if viewing today, otherwise default to 9 AM
      const today = new Date().toISOString().slice(0, 10);
      if (refDateStr === today) {
        const now = new Date();
        scrollHour = now.getHours();
        scrollMinute = now.getMinutes();
      } else {
        scrollHour = 9;
        scrollMinute = 0;
      }
    }

    // Format as HH:MM:SS for the FullCalendar scrollToTime API
    const hh = String(scrollHour).padStart(2, '0');
    const mm = String(scrollMinute).padStart(2, '0');
    api.scrollToTime(`${hh}:${mm}:00`);
  }, []);

  useImperativeHandle(ref, () => ({
    goToDay(date: string) {
      const api = calendarRef.current?.getApi();
      if (api) {
        api.changeView('timeGridDay', date);
        // After switching to day view, auto-scroll to the first event
        autoScrollToFirstEvent(api, new Date(date));
      }
    },
  }));

  /**
   * datesSet fires whenever the visible date range changes (navigation, view
   * switch). We use it to auto-scroll so the first relevant event is in view.
   */
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    autoScrollToFirstEvent(arg.view.calendar);
  }, [autoScrollToFirstEvent]);

  return (
    <div className="fc-dark-theme overflow-x-auto">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={isNarrow ? 'timeGridDay' : 'timeGridWeek'}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: isNarrow ? 'timeGridDay,dayGridMonth' : 'timeGridWeek,timeGridDay,dayGridMonth',
        }}
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        slotMinTime="07:00:00"
        slotMaxTime="18:00:00"
        slotDuration="00:15:00"
        allDaySlot={false}
        height="auto"
        events={events}
        eventClick={onEventClick}
        select={onDateSelect}
        dateClick={onDateClick}
        eventDrop={onEventDrop}
        datesSet={handleDatesSet}
        nowIndicator={true}
        expandRows={true}
      />
    </div>
  );
});

export default SessionCalendar;

/**
 * Converts a session (with relations) from the API into a FullCalendar EventInput.
 * Applies status-based color-coding.
 */
export function sessionToCalendarEvent(session: {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  grade_groups: string[];
  tags?: { id: string; name: string; color?: string | null; description?: string | null; emoji?: string | null }[];
  instructor?: { first_name: string; last_name: string } | null;
  venue?: { name: string; space_type: string } | null;
}): EventInput {
  const colors = STATUS_COLORS[session.status] ?? STATUS_COLORS.draft;
  const emoji = getEmojiForTags(session.tags);
  const instructorName = session.instructor
    ? `${session.instructor.first_name} ${session.instructor.last_name}`
    : 'Unassigned';
  const grades = session.grade_groups?.join(', ') ?? '';

  // Build tag descriptions for tooltip
  const tagDescriptions = (session.tags ?? [])
    .filter((t) => t.description)
    .map((t) => `${t.name}: ${t.description}`)
    .join('\n');

  return {
    id: session.id,
    title: `${emoji} ${grades} — ${instructorName}`,
    start: `${session.date}T${session.start_time}`,
    end: `${session.date}T${session.end_time}`,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    extendedProps: {
      status: session.status,
      venue: session.venue ? `${session.venue.name} - ${session.venue.space_type}` : '',
      instructorName,
      grades,
      tags: session.tags ?? [],
      tagDescriptions,
    },
  };
}
