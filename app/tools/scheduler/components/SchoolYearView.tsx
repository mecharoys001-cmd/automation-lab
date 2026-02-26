'use client';

import { useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';
import { sessionToCalendarEvent } from './SessionCalendar';

interface RawSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  grade_groups: string[];
  tags?: { id: string; name: string; color?: string | null }[];
  instructor?: { id: string; first_name: string; last_name: string } | null;
  venue?: { id: string; name: string; space_type: string } | null;
}

const SCHOOL_YEAR_MONTHS: { year: number; month: number; label: string; tint: string }[] = [
  { year: 2025, month: 10, label: 'November',  tint: 'rgba(249, 115, 22, 0.05)' },  // orange
  { year: 2025, month: 11, label: 'December',  tint: 'rgba(59, 130, 246, 0.05)' },   // blue
  { year: 2026, month: 0,  label: 'January',   tint: 'rgba(99, 102, 241, 0.05)' },   // indigo
  { year: 2026, month: 1,  label: 'February',  tint: 'rgba(236, 72, 153, 0.05)' },   // pink
  { year: 2026, month: 2,  label: 'March',     tint: 'rgba(34, 197, 94, 0.05)' },    // green
  { year: 2026, month: 3,  label: 'April',     tint: 'rgba(168, 85, 247, 0.05)' },   // purple
  { year: 2026, month: 4,  label: 'May',       tint: 'rgba(234, 179, 8, 0.05)' },    // yellow
  { year: 2026, month: 5,  label: 'June',      tint: 'rgba(20, 184, 166, 0.05)' },   // teal
];

export default function SchoolYearView({ sessions, onDayClick, onEventClick }: { sessions: RawSession[]; onDayClick?: (date: string) => void; onEventClick?: (info: EventClickArg) => void }) {
  const currentMonthRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  useEffect(() => {
    if (currentMonthRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = currentMonthRef.current;
      const offset = element.offsetTop - container.offsetTop;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, []);

  const eventsByMonth = useMemo(() => {
    return SCHOOL_YEAR_MONTHS.map(({ year, month, label, tint }) => {
      const monthStr = String(month + 1).padStart(2, '0');
      const prefix = `${year}-${monthStr}`;
      const filtered = sessions.filter((s) => s.date.startsWith(prefix));
      return {
        year,
        month,
        label,
        tint,
        initialDate: `${year}-${monthStr}-01`,
        events: filtered.map(sessionToCalendarEvent),
      };
    });
  }, [sessions]);

  return (
    <div ref={scrollContainerRef} className="max-h-[75vh] overflow-y-auto space-y-8 pr-1">
      {eventsByMonth.map(({ year, month, label, tint, initialDate, events }, idx) => {
        const isCurrentMonth = year === currentYear && month === currentMonth;
        return (
        <div key={`${year}-${month}`} ref={isCurrentMonth ? currentMonthRef : undefined}>
          {idx > 0 && (
            <div className="border-t border-border/50 mb-6" />
          )}
          <h2 className="text-2xl font-bold text-foreground mb-4 px-1">
            {label} {year}
          </h2>
          <div
            className="fc-dark-theme rounded-lg border border-border overflow-hidden"
            style={{ backgroundColor: tint }}
          >
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate={initialDate}
              headerToolbar={false}
              fixedWeekCount={false}
              height="auto"
              events={events}
              dateClick={onDayClick ? (info: DateClickArg) => onDayClick(info.dateStr.slice(0, 10)) : undefined}
              eventClick={onEventClick}
            />
          </div>
        </div>
        );
      })}
    </div>
  );
}
