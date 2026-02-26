'use client';

import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
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

// Alternating tints matching the SchoolYearView palette
const WEEK_TINTS = [
  'rgba(249, 115, 22, 0.05)',  // orange
  'rgba(59, 130, 246, 0.05)',  // blue
  'rgba(99, 102, 241, 0.05)',  // indigo
  'rgba(236, 72, 153, 0.05)',  // pink
  'rgba(34, 197, 94, 0.05)',   // green
  'rgba(168, 85, 247, 0.05)',  // purple
  'rgba(234, 179, 8, 0.05)',   // yellow
  'rgba(20, 184, 166, 0.05)',  // teal
];

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSchoolYearWeeks(): { mondayStr: string; label: string }[] {
  const weeks: { mondayStr: string; label: string }[] = [];
  const start = new Date(2025, 10, 1); // Nov 1, 2025
  const end = new Date(2026, 5, 30);   // Jun 30, 2026

  // Find first Monday on or after Nov 1
  const current = new Date(start);
  const day = current.getDay();
  if (day !== 1) {
    current.setDate(current.getDate() + ((8 - day) % 7));
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  while (current <= end) {
    weeks.push({
      mondayStr: formatDateStr(current),
      label: `Week of ${formatter.format(current)}`,
    });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

const SCHOOL_YEAR_WEEKS = getSchoolYearWeeks();

export default function SchoolYearWeekView({ sessions, onDayClick, onEventClick }: { sessions: RawSession[]; onDayClick?: (date: string) => void; onEventClick?: (info: EventClickArg) => void }) {
  const eventsByWeek = useMemo(() => {
    return SCHOOL_YEAR_WEEKS.map(({ mondayStr, label }, idx) => {
      const monday = new Date(
        parseInt(mondayStr.slice(0, 4)),
        parseInt(mondayStr.slice(5, 7)) - 1,
        parseInt(mondayStr.slice(8, 10)),
      );
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const sundayStr = formatDateStr(sunday);

      const filtered = sessions.filter((s) => s.date >= mondayStr && s.date <= sundayStr);
      return {
        key: mondayStr,
        label,
        initialDate: mondayStr,
        tint: WEEK_TINTS[idx % WEEK_TINTS.length],
        events: filtered.map(sessionToCalendarEvent),
      };
    });
  }, [sessions]);

  return (
    <div className="max-h-[75vh] overflow-y-auto space-y-8 pr-1">
      {eventsByWeek.map(({ key, label, tint, initialDate, events }, idx) => (
        <div key={key}>
          {idx > 0 && (
            <div className="border-t border-border/50 mb-6" />
          )}
          <h2 className="text-2xl font-bold text-foreground mb-4 px-1">
            {label}
          </h2>
          <div
            className="fc-dark-theme rounded-lg border border-border overflow-hidden"
            style={{ backgroundColor: tint }}
          >
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              initialDate={initialDate}
              headerToolbar={false}
              slotMinTime="07:00:00"
              slotMaxTime="18:00:00"
              weekends={true}
              height="auto"
              allDaySlot={false}
              events={events}
              dateClick={onDayClick ? (info: DateClickArg) => onDayClick(info.dateStr.slice(0, 10)) : undefined}
              eventClick={onEventClick}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
