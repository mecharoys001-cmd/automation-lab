'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, X, RefreshCw } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  subtitle: string;
  instructor: string;
  venue?: string;
  type: 'strings' | 'brass' | 'piano' | 'percussion' | 'choral';
  startTime: string; // HH:MM format (24h)
  endTime: string;   // HH:MM format (24h)
  dayIndex: number;  // 0=Mon … 6=Sun
}

interface WeekViewSpreadsheetProps {
  events: CalendarEvent[];
  weekDays: Array<{ label: string; num: number; fullDate?: string }>;
  startHour?: number; // default 8
  endHour?: number;   // default 15 (3 PM)
  onEventClick?: (event: CalendarEvent) => void;
  onEventCancel?: (event: CalendarEvent) => void;
  onEventSuggestReplacements?: (event: CalendarEvent) => void;
}

const EVENT_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  strings:    { accent: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' },
  brass:      { accent: '#F59E0B', bg: '#FFFBEB', text: '#92400E' },
  piano:      { accent: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  percussion: { accent: '#EF4444', bg: '#FEF2F2', text: '#991B1B' },
  choral:     { accent: '#10B981', bg: '#ECFDF5', text: '#065F46' },
};

// ---------------------------------------------------------------------------
// Helper: Convert HH:MM to decimal hours
// ---------------------------------------------------------------------------

function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

// ---------------------------------------------------------------------------
// Helper: Format time for display
// ---------------------------------------------------------------------------

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

// ---------------------------------------------------------------------------
// Event block component with context menu
// ---------------------------------------------------------------------------

function EventBlock({
  event,
  startHour,
  endHour,
  onEventClick,
  onEventCancel,
  onEventSuggestReplacements,
}: {
  event: CalendarEvent;
  startHour: number;
  endHour: number;
  onEventClick?: (event: CalendarEvent) => void;
  onEventCancel?: (event: CalendarEvent) => void;
  onEventSuggestReplacements?: (event: CalendarEvent) => void;
}) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.strings;

  const eventStart = timeToHours(event.startTime);
  const eventEnd = timeToHours(event.endTime);
  const duration = eventEnd - eventStart;

  // Calculate position in grid (grid spans startHour to endHour)
  const gridDuration = endHour - startHour;
  const topPercent = ((eventStart - startHour) / gridDuration) * 100;
  const heightPercent = (duration / gridDuration) * 100;

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const handleOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenuPos({ x: rect.left, y: rect.bottom + 4 });
    setContextMenuOpen(true);
  };

  return (
    <>
      <div
        className="absolute left-0 right-0 px-1.5 cursor-pointer group"
        style={{
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
        }}
        onClick={() => onEventClick?.(event)}
        onContextMenu={handleContextMenu}
      >
        <Tooltip text={`${event.title} — ${formatTime(event.startTime)}–${formatTime(event.endTime)}`} className="h-full w-full">
        <div
          className="relative h-full rounded-md p-2 shadow-sm hover:shadow-md transition-shadow flex flex-col"
          style={{
            backgroundColor: colors.bg,
            borderLeft: `3px solid ${colors.accent}`,
          }}
        >
          {/* Time badge at top */}
          <div className="text-[10px] font-semibold mb-1" style={{ color: colors.text }}>
            {formatTime(event.startTime)} - {formatTime(event.endTime)}
          </div>

          {/* Title */}
          <p className="text-[11px] font-bold leading-tight truncate" style={{ color: colors.text }}>
            {event.title}
          </p>

          {/* Subtitle */}
          <p className="text-[10px] text-slate-600 leading-tight truncate mt-0.5">
            {event.subtitle}
          </p>

          {/* Instructor */}
          <p className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
            {event.instructor}
          </p>

          {/* Venue (if available) */}
          {event.venue && (
            <p className="text-[9px] text-slate-400 leading-tight truncate mt-0.5">
              📍 {event.venue}
            </p>
          )}

          {/* Options button (visible on hover) */}
          <Tooltip text="More options" position="left">
            <button
              onClick={handleOptionsClick}
              className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/50 transition-opacity"
            >
              <MoreVertical className="w-3.5 h-3.5" style={{ color: colors.text }} />
            </button>
          </Tooltip>
        </div>
        </Tooltip>
      </div>

      {/* Context menu */}
      {contextMenuOpen && (
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-[9999] min-w-[180px]"
          style={{
            left: contextMenuPos.x,
            top: contextMenuPos.y,
          }}
        >
          <Tooltip text="Open event details" position="right">
            <button
              onClick={() => {
                setContextMenuOpen(false);
                onEventClick?.(event);
              }}
              className="w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <span>View Details</span>
            </button>
          </Tooltip>
          <Tooltip text="Find replacement instructors" position="right">
            <button
              onClick={() => {
                setContextMenuOpen(false);
                onEventSuggestReplacements?.(event);
              }}
              className="w-full px-3 py-2 text-left text-[13px] text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Suggest Replacements</span>
            </button>
          </Tooltip>
          <div className="border-t border-slate-200 my-1" />
          <Tooltip text="Cancel this event" position="right">
            <button
              onClick={() => {
                setContextMenuOpen(false);
                onEventCancel?.(event);
              }}
              className="w-full px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Event</span>
            </button>
          </Tooltip>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main WeekViewSpreadsheet
// ---------------------------------------------------------------------------

export function WeekViewSpreadsheet({
  events,
  weekDays,
  startHour = 8,
  endHour = 15,
  onEventClick,
  onEventCancel,
  onEventSuggestReplacements,
}: WeekViewSpreadsheetProps) {
  // Generate hourly rows
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }

  // Group events by day
  const eventsByDay: CalendarEvent[][] = Array.from({ length: 7 }, (_, i) =>
    events.filter((e) => e.dayIndex === i)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] bg-white border-b border-slate-200 shrink-0">
        {/* Empty corner cell */}
        <div className="border-r border-slate-200" />

        {/* Day columns */}
        {weekDays.map((day, idx) => (
          <Tooltip key={day.label} text={day.fullDate || `${day.label} ${day.num}`}>
            <div
              className={`flex flex-col items-center py-2 ${
                idx < 6 ? 'border-r border-slate-100' : ''
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-400 tracking-[1px]">
                {day.label}
              </span>
              <span className="text-xl font-semibold text-slate-900 leading-tight mt-0.5">
                {day.num}
              </span>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="grid grid-cols-[80px_repeat(7,1fr)]">
          {/* Time rows */}
          {hours.map((hour) => {
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const period = hour >= 12 ? 'PM' : 'AM';
            const timeLabel = `${displayHour}:00 ${period}`;

            return (
              <div key={hour} className="contents">
                {/* Time label cell */}
                <div className="border-r border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 bg-slate-50 flex items-start sticky left-0 z-10">
                  {timeLabel}
                </div>

                {/* Day cells for this hour */}
                {weekDays.map((_, dayIdx) => (
                  <div
                    key={`${hour}-${dayIdx}`}
                    className={`border-b border-slate-100 min-h-[60px] ${
                      dayIdx < 6 ? 'border-r border-slate-100' : ''
                    } relative`}
                  />
                ))}
              </div>
            );
          })}

          {/* Positioned events overlay */}
          {eventsByDay.map((dayEvents, dayIdx) => (
            <div
              key={`events-${dayIdx}`}
              className="absolute"
              style={{
                left: `calc(80px + ${dayIdx * (100 / 7)}%)`,
                top: 0,
                bottom: 0,
                width: `calc(${100 / 7}%)`,
                pointerEvents: 'none',
              }}
            >
              <div className="relative h-full" style={{ pointerEvents: 'auto' }}>
                {dayEvents.map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    startHour={startHour}
                    endHour={endHour}
                    onEventClick={onEventClick}
                    onEventCancel={onEventCancel}
                    onEventSuggestReplacements={onEventSuggestReplacements}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
