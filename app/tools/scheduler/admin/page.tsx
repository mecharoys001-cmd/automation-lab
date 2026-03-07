'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  Music,
  ChevronDown,
  Clock,
  User as UserIcon,
  Sparkles,
  Loader2,
  Trash2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { showToast } from '../lib/toast';
import { Button } from '../components/ui/Button';
import { ViewToggle } from '../components/ui/ViewToggle';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { FilterBar } from '../components/layout/FilterBar';
import type { ActiveFilters } from '../components/layout/FilterBar';
import { WeekView } from '../components/calendar/WeekView';
import { MonthView } from '../components/calendar/MonthView';
import { DayView } from '../components/calendar/DayView';
import { YearView } from '../components/calendar/YearView';
import { EventContextMenu } from '../components/calendar/EventContextMenu';
import type { ContextMenuAction } from '../components/calendar/EventContextMenu';
import { EVENT_COLORS } from '../components/calendar/types';
import type { CalendarEvent, EventType } from '../components/calendar/types';
import { EventEditPanel } from '../components/calendar/EventEditPanel';
import type { EventEditPanelData } from '../components/calendar/EventEditPanel';
import { useEventEditPanel } from '../components/calendar/useEventEditPanel';
import { useProgram } from './ProgramContext';
import type { CalendarView } from '../components/ui/ViewToggle';
import { ReadinessWidget } from '../components/ui/ReadinessWidget';
import { SchedulerResultModal } from '../components/modals/SchedulerResultModal';

// ---------------------------------------------------------------------------
// Convert 12-hour display time ('9:00 AM') to 24-hour format ('09:00')
// ---------------------------------------------------------------------------
function to24h(time12: string): string {
  if (!time12) return '';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

// ---------------------------------------------------------------------------
// Mock session data — full SessionWithRelations objects through the real
// sessionToCalendarEvent pipeline (same shape the API returns).
// ---------------------------------------------------------------------------

import type { SessionWithRelations, Venue, SessionTemplate } from '../../../../types/database';

const MOCK_PROGRAM_ID = 'mock-program-001';

const VENUES: Record<string, Venue> = {
  musicRoom: {
    id: 'v-music-room', name: 'Music Room A', space_type: 'classroom',
    max_capacity: 30, availability_json: null, is_virtual: false, notes: null,
    min_booking_duration_minutes: 30, max_booking_duration_minutes: 120,
    buffer_minutes: 10, advance_booking_days: 30, cancellation_window_hours: 24,
    address: '100 School Ave', amenities: ['piano', 'whiteboard'], cost_per_hour: null,
    max_concurrent_bookings: 1, blackout_dates: null, description: null, created_at: '2025-09-01T00:00:00Z',
  },
  auditorium: {
    id: 'v-auditorium', name: 'Auditorium', space_type: 'auditorium',
    max_capacity: 200, availability_json: null, is_virtual: false, notes: null,
    min_booking_duration_minutes: 60, max_booking_duration_minutes: 180,
    buffer_minutes: 15, advance_booking_days: 60, cancellation_window_hours: 48,
    address: '100 School Ave', amenities: ['stage', 'sound-system'], cost_per_hour: null,
    max_concurrent_bookings: 1, blackout_dates: null, description: null, created_at: '2025-09-01T00:00:00Z',
  },
  practiceRoom: {
    id: 'v-practice-room', name: 'Practice Room B', space_type: 'practice_room',
    max_capacity: 10, availability_json: null, is_virtual: false, notes: null,
    min_booking_duration_minutes: 15, max_booking_duration_minutes: 60,
    buffer_minutes: 5, advance_booking_days: 14, cancellation_window_hours: 12,
    address: '100 School Ave', amenities: ['piano'], cost_per_hour: null,
    max_concurrent_bookings: 1, blackout_dates: null, description: null, created_at: '2025-09-01T00:00:00Z',
  },
};

function tpl(id: string, skills: string[], grades: string[], day: number, start: string, end: string, dur: number): SessionTemplate {
  return {
    id, program_id: MOCK_PROGRAM_ID, template_type: 'fully_defined',
    rotation_mode: 'consistent', instructor_id: null, day_of_week: day,
    grade_groups: grades, start_time: start, end_time: end, duration_minutes: dur,
    venue_id: null, required_skills: skills, sort_order: null, is_active: true,
    week_cycle_length: null, week_in_cycle: null,
    created_at: '2025-09-01T00:00:00Z',
  };
}

const now = '2026-02-28T00:00:00Z';

function sess(
  id: string, date: string, start: string, end: string, dur: number,
  grades: string[], status: 'draft' | 'published' | 'canceled' | 'completed',
  venue: Venue, template: SessionTemplate,
): SessionWithRelations {
  return {
    id, program_id: MOCK_PROGRAM_ID, template_id: template.id,
    instructor_id: null, venue_id: venue.id, grade_groups: grades,
    date, start_time: start, end_time: end, duration_minutes: dur,
    status, is_makeup: false, replaces_session_id: null, needs_resolution: false,
    notes: null, scheduling_notes: null,
    created_at: now, updated_at: now,
    venue, instructor: null, tags: [], template, program: null,
  };
}

// -- Week of Feb 24 – Mar 2 (current week) --
const MOCK_SESSIONS: SessionWithRelations[] = [
  sess('1',  '2026-02-24', '09:00', '10:00', 60, ['1', '2'],    'published', VENUES.musicRoom,    tpl('t1',  ['violin'],     ['1','2'],   1, '09:00','10:00', 60)),
  sess('2',  '2026-02-24', '10:30', '11:30', 60, ['5', '6'],    'published', VENUES.auditorium,   tpl('t2',  ['strings'],    ['5','6'],   1, '10:30','11:30', 60)),
  sess('3',  '2026-02-25', '09:00', '10:00', 60, ['3', '4'],    'published', VENUES.musicRoom,    tpl('t3',  ['trumpet','brass'], ['3','4'], 2, '09:00','10:00', 60)),
  sess('4',  '2026-02-25', '11:00', '12:00', 60, ['K', '1'],    'draft',     VENUES.practiceRoom, tpl('t4',  ['piano'],      ['K','1'],   2, '11:00','12:00', 60)),
  sess('5',  '2026-02-26', '09:00', '10:00', 60, ['3', '4'],    'published', VENUES.musicRoom,    tpl('t5',  ['percussion'], ['3','4'],   3, '09:00','10:00', 60)),
  sess('6',  '2026-02-26', '13:00', '14:00', 60, ['5', '6'],    'published', VENUES.auditorium,   tpl('t6',  ['choral'],     ['5','6'],   3, '13:00','14:00', 60)),
  sess('7',  '2026-02-27', '09:00', '10:00', 60, ['2', '3'],    'published', VENUES.musicRoom,    tpl('t7',  ['cello','strings'], ['2','3'], 4, '09:00','10:00', 60)),
  sess('8',  '2026-02-27', '10:00', '11:00', 60, ['5', '6'],    'published', VENUES.musicRoom,    tpl('t8',  ['brass'],      ['5','6'],   4, '10:00','11:00', 60)),
  sess('9',  '2026-02-27', '14:00', '15:00', 60, ['4', '5'],    'draft',     VENUES.practiceRoom, tpl('t9',  ['piano'],      ['4','5'],   4, '14:00','15:00', 60)),
  sess('10', '2026-02-28', '09:00', '10:00', 60, ['1', '2'],    'published', VENUES.musicRoom,    tpl('t10', ['percussion','drums'], ['1','2'], 5, '09:00','10:00', 60)),
  sess('11', '2026-02-28', '11:00', '12:00', 60, ['3', '4'],    'published', VENUES.auditorium,   tpl('t11', ['choral','vocal'],    ['3','4'], 5, '11:00','12:00', 60)),
  sess('12', '2026-02-28', '13:00', '14:00', 60, ['4', '5', '6'], 'published', VENUES.auditorium, tpl('t12', ['strings'],    ['4','5','6'], 5, '13:00','14:00', 60)),
  sess('13', '2026-03-01', '10:00', '11:00', 60, ['K', '1'],    'draft',     VENUES.musicRoom,    tpl('t13', ['brass'],      ['K','1'],   6, '10:00','11:00', 60)),
  sess('14', '2026-03-02', '10:00', '11:00', 60, ['1','2','3','4','5','6'], 'published', VENUES.auditorium, tpl('t14', ['choral'], ['1','2','3','4','5','6'], 0, '10:00','11:00', 60)),

  // -- Earlier Feb (month view) --
  sess('m1', '2026-02-02', '09:00', '10:00', 60, ['1', '2'],    'published', VENUES.musicRoom,    tpl('tm1', ['violin','strings'],  ['1','2'], 1, '09:00','10:00', 60)),
  sess('m2', '2026-02-04', '10:00', '11:00', 60, ['3', '4'],    'published', VENUES.auditorium,   tpl('tm2', ['choral'],     ['3','4'],   3, '10:00','11:00', 60)),
  sess('m3', '2026-02-09', '11:00', '12:00', 60, ['K', '1'],    'draft',     VENUES.practiceRoom, tpl('tm3', ['piano'],      ['K','1'],   1, '11:00','12:00', 60)),
  sess('m4', '2026-02-11', '09:00', '10:00', 60, ['5', '6'],    'published', VENUES.musicRoom,    tpl('tm4', ['brass'],      ['5','6'],   3, '09:00','10:00', 60)),
  sess('m5', '2026-02-16', '13:00', '14:00', 60, ['1', '2'],    'published', VENUES.musicRoom,    tpl('tm5', ['percussion'], ['1','2'],   1, '13:00','14:00', 60)),
  sess('m6', '2026-02-18', '10:00', '11:00', 60, ['4', '5', '6'], 'published', VENUES.auditorium, tpl('tm6', ['strings'],    ['4','5','6'], 3, '10:00','11:00', 60)),
  sess('m7', '2026-02-20', '14:00', '15:00', 60, ['5', '6'],    'published', VENUES.auditorium,   tpl('tm7', ['choral','vocal'], ['5','6'], 5, '14:00','15:00', 60)),

  // -- Year view (past: Nov-Dec 2025, Jan 2026; future: Mar-Jun 2026) --
  sess('y1',  '2025-11-03', '09:00', '10:00', 60, ['1','2','3','4','5','6'], 'completed', VENUES.auditorium, tpl('ty1',  ['strings','violin'], ['1','2','3','4','5','6'], 1, '09:00','10:00', 60)),
  sess('y2',  '2025-11-10', '10:00', '11:00', 60, ['3', '4', '5', '6'],     'completed', VENUES.musicRoom,  tpl('ty2',  ['brass','trumpet'],  ['3','4','5','6'],         1, '10:00','11:00', 60)),
  sess('y3',  '2025-11-17', '13:00', '14:00', 60, ['1','2','3','4','5','6'], 'completed', VENUES.auditorium, tpl('ty3',  ['choral'],    ['1','2','3','4','5','6'], 1, '13:00','14:00', 60)),
  sess('y4',  '2025-12-01', '09:00', '10:00', 60, ['4', '5', '6'],          'completed', VENUES.auditorium, tpl('ty4',  ['strings'],   ['4','5','6'],             1, '09:00','10:00', 60)),
  sess('y5',  '2025-12-10', '13:00', '14:00', 60, ['1','2','3','4','5','6'], 'completed', VENUES.auditorium, tpl('ty5',  ['choral'],    ['1','2','3','4','5','6'], 3, '13:00','14:00', 60)),
  sess('y6',  '2025-12-18', '14:00', '15:00', 60, ['3', '4', '5'],          'completed', VENUES.musicRoom,  tpl('ty6',  ['percussion'],['3','4','5'],             4, '14:00','15:00', 60)),
  sess('y7',  '2026-01-12', '09:00', '10:00', 60, ['1', '2', '3'],          'published', VENUES.musicRoom,  tpl('ty7',  ['percussion'],['1','2','3'],             1, '09:00','10:00', 60)),
  sess('y8',  '2026-01-20', '14:00', '15:00', 60, ['3', '4', '5'],          'published', VENUES.practiceRoom, tpl('ty8', ['piano'],    ['3','4','5'],             2, '14:00','15:00', 60)),
  sess('y9',  '2026-03-09', '10:00', '11:00', 60, ['2', '3', '4'],          'draft',     VENUES.musicRoom,  tpl('ty9',  ['strings'],   ['2','3','4'],             1, '10:00','11:00', 60)),
  sess('y10', '2026-03-18', '11:00', '12:00', 60, ['5', '6'],               'draft',     VENUES.musicRoom,  tpl('ty10', ['brass'],     ['5','6'],                 3, '11:00','12:00', 60)),
  sess('y11', '2026-04-06', '09:00', '10:00', 60, ['1','2','3','4','5','6'], 'draft',     VENUES.auditorium, tpl('ty11', ['choral'],    ['1','2','3','4','5','6'], 1, '09:00','10:00', 60)),
  sess('y12', '2026-04-22', '10:00', '11:00', 60, ['4', '5', '6'],          'draft',     VENUES.practiceRoom, tpl('ty12',['piano'],    ['4','5','6'],             3, '10:00','11:00', 60)),
  sess('y13', '2026-05-15', '10:00', '11:00', 60, ['1','2','3','4','5','6'], 'draft',     VENUES.auditorium, tpl('ty13', ['strings'],   ['1','2','3','4','5','6'], 5, '10:00','11:00', 60)),
  sess('y14', '2026-05-22', '13:00', '14:00', 60, ['3', '4', '5', '6'],     'draft',     VENUES.musicRoom,  tpl('ty14', ['percussion'],['3','4','5','6'],         5, '13:00','14:00', 60)),
  sess('y15', '2026-06-01', '09:00', '10:00', 60, ['4', '5', '6'],          'draft',     VENUES.practiceRoom, tpl('ty15',['piano'],    ['4','5','6'],             1, '09:00','10:00', 60)),
  sess('y16', '2026-06-12', '14:00', '15:00', 60, ['5', '6'],               'draft',     VENUES.auditorium, tpl('ty16', ['brass'],     ['5','6'],                 5, '14:00','15:00', 60)),
];

// ---------------------------------------------------------------------------
// Helpers — map generated sessions to CalendarEvent
// ---------------------------------------------------------------------------

const KNOWN_EVENT_TYPES = ['strings', 'brass', 'piano', 'percussion', 'choral', 'guitar', 'woodwind'] as const;

const ALL_MOCK_EVENTS = MOCK_SESSIONS.map(sessionToCalendarEvent);

// Upcoming events for the "Needs Assignment" sidebar
interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: EventType;
}

const UPCOMING_UNASSIGNED: UpcomingEvent[] = [
  { id: 'u1', title: 'Piano Lab Session',    date: 'Mon, Feb 24', time: '2:00 PM', type: 'piano' },
  { id: 'u2', title: 'Percussion Basics',    date: 'Tue, Feb 25', time: '3:00 PM', type: 'percussion' },
  { id: 'u3', title: 'Strings Sectional',    date: 'Wed, Feb 26', time: '9:30 AM', type: 'strings' },
  { id: 'u4', title: 'Brass Warm-Up',        date: 'Thu, Feb 27', time: '8:00 AM', type: 'brass' },
  { id: 'u5', title: 'Choral Sight-Reading', date: 'Fri, Feb 28', time: '1:30 PM', type: 'choral' },
];

/** Best-effort mapping from a template's required subjects to an EventType. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveEventType(template: any): EventType {
  const skills: string[] = template?.required_skills ?? [];
  const match = KNOWN_EVENT_TYPES.find((t) =>
    skills.some((s: string) => s.toLowerCase().includes(t)),
  );
  return (match ?? 'strings') as EventType;
}

/** Convert 24-hour "HH:MM" to display format "9:00 AM". */
function formatTimeDisplay(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Build a readable title from a generated session's template data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSessionTitle(session: any): string {
  const skills: string[] = session.template?.required_skills ?? [];
  const grades: string[] = session.grade_groups ?? session.template?.grade_groups ?? [];
  const gradeSuffix = grades.length > 0 ? ` - Grade ${grades.join(', ')}` : '';

  if (skills.length > 0) {
    const skill = skills[0].charAt(0).toUpperCase() + skills[0].slice(1);
    return `${skill} Session${gradeSuffix}`;
  }
  // Instructor: API returns { first_name, last_name }, not { name }
  const instructorName = session.instructor
    ? `${session.instructor.first_name ?? ''} ${session.instructor.last_name ?? ''}`.trim()
    : '';
  if (instructorName) {
    return `${instructorName} Session${gradeSuffix}`;
  }
  return `Music Session${gradeSuffix}`;
}

/** Map a raw generated session (with joins) to a CalendarEvent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sessionToCalendarEvent(session: any): CalendarEvent {
  // Instructor name: API returns { first_name, last_name }, not { name }
  const instructorName = session.instructor
    ? `${session.instructor.first_name ?? ''} ${session.instructor.last_name ?? ''}`.trim() || 'Unassigned'
    : 'Unassigned';

  // Tags: API returns tag objects with { id, name, ... }, convert to string[]
  const tagNames: string[] = Array.isArray(session.tags)
    ? session.tags.map((t: { name?: string }) => t.name).filter(Boolean)
    : [];

  const gradeLabel = session.grade_groups?.length
    ? `Grade ${session.grade_groups.join(', ')}`
    : '';

  return {
    id: session.id,
    title: buildSessionTitle(session),
    subtitle: gradeLabel,
    gradeLevel: gradeLabel || undefined,
    instructor: instructorName,
    type: deriveEventType(session.template),
    time: formatTimeDisplay(session.start_time),
    endTime: formatTimeDisplay(session.end_time),
    date: session.date,
    status: session.status ?? 'draft',
    venue: session.venue?.name,
    subjects: Array.isArray(session.template?.required_skills) ? session.template.required_skills : [],
    tags: tagNames,
    notes: session.notes ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers — filter
// ---------------------------------------------------------------------------

/** Check if an event matches the active filters */
function eventMatchesFilters(event: CalendarEvent, filters: ActiveFilters): boolean {
  for (const [key, values] of Object.entries(filters)) {
    if (values.length === 0) continue;

    switch (key) {
      case 'instructor':
        if (!values.includes(event.instructor)) return false;
        break;
      case 'venue':
        if (event.venue && !values.includes(event.venue)) return false;
        break;
      case 'eventType':
        if (!values.includes(event.type)) return false;
        break;
      case 'grade':
        if (!values.includes(event.subtitle)) return false;
        break;
      case 'status':
        if (event.status && !values.includes(event.status)) return false;
        break;
      case 'tags':
        if (!event.tags || !event.tags.some((t) => values.includes(t))) return false;
        break;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NeedsAssignmentCard({ event }: { event: UpcomingEvent }) {
  const colors = EVENT_COLORS[event.type];

  return (
    <Tooltip text={`Unassigned: ${event.title} on ${event.date}`}>
      <div
        className="rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity"
        style={{
          backgroundColor: colors.bg,
          borderLeft: `3px solid ${colors.accent}`,
        }}
      >
        <p className="text-[12px] font-semibold text-slate-900 truncate">{event.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] text-slate-500">{event.date}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <UserIcon className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] text-slate-400 italic">No instructor assigned</span>
        </div>
      </div>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Clear Events Confirmation Modal
// ---------------------------------------------------------------------------

function ClearEventsModal({
  open,
  onClose,
  onConfirm,
  isClearing,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isClearing: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === 'DELETE';

  // Reset input when modal opens/closes
  useEffect(() => {
    if (!open) setConfirmText('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-50 w-[440px] bg-white rounded-2xl shadow-[0_8px_32px_#00000033] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Clear All Events</h3>
            <p className="text-[12px] text-slate-500">This action is irreversible</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-[13px] text-slate-700 leading-relaxed">
            ⚠️ This will permanently delete <span className="font-semibold">ALL</span> scheduled
            events for this program. This cannot be undone.
          </p>

          <div>
            <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
              Type <span className="font-mono font-semibold text-red-500">DELETE</span> to confirm
            </label>
            <Tooltip text="Type DELETE to confirm permanent deletion">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
              />
            </Tooltip>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
          <Tooltip text="Cancel and go back">
            <button
              onClick={onClose}
              disabled={isClearing}
              className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </Tooltip>

          <Tooltip text={isConfirmed ? 'Delete all events permanently' : 'Type DELETE to enable this button'}>
            <button
              onClick={onConfirm}
              disabled={!isConfirmed || isClearing}
              className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {isClearing ? 'Clearing...' : 'Clear Events'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export helpers
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  'Date', 'Day', 'Start Time', 'End Time', 'Event Name',
  'Instructor', 'Venue', 'Grade Groups', 'Status', 'Tags',
] as const;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function eventToCsvRow(event: CalendarEvent): string {
  const date = event.date ?? '';
  const dayOfWeek = date ? DAY_NAMES[new Date(date + 'T00:00:00').getDay()] : '';
  const fields = [
    date,
    dayOfWeek,
    event.time ?? '',
    event.endTime ?? '',
    event.title,
    event.instructor ?? '',
    event.venue ?? '',
    event.subtitle ?? '',
    event.status ?? '',
    (event.tags ?? []).join('; '),
  ];
  return fields.map(escapeCsvField).join(',');
}

function exportEventsCsv(events: CalendarEvent[], filenameTag: string) {
  const header = CSV_COLUMNS.join(',');
  const rows = events
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))
    .map(eventToCsvRow);
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `symphonix-${filenameTag}-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return events.length;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CalendarDashboardPage() {
  return (
    <Suspense>
      <CalendarDashboard />
    </Suspense>
  );
}

function CalendarDashboard() {
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [contextMenu, setContextMenu] = useState<{
    event: CalendarEvent;
    position: { x: number; y: number };
  } | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [schoolCalendar, setSchoolCalendar] = useState<Array<{
    date: string;
    status_type: 'no_school' | 'early_dismissal' | 'instructor_exception';
    description?: string | null;
    early_dismissal_time?: string | null;
  }>>([]);
  const [dbVenues, setDbVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedulerResult, setSchedulerResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isConfirmingGenerate, setIsConfirmingGenerate] = useState(false);
  // Portal container for Month/Year views (escapes flex hierarchy)
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  // Track recently modified event IDs (eventId -> timestamp) for badge display
  const [recentlyModified, setRecentlyModified] = useState<Map<string, number>>(new Map());
  const recentlyModifiedRef = useRef(recentlyModified);
  recentlyModifiedRef.current = recentlyModified;

  // Clean up entries older than 5 seconds
  const hasRecentlyModified = recentlyModified.size > 0;
  useEffect(() => {
    if (!hasRecentlyModified) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const next = new Map<string, number>();
      for (const [id, ts] of recentlyModifiedRef.current) {
        if (now - ts < 5000) next.set(id, ts);
      }
      if (next.size !== recentlyModifiedRef.current.size) {
        setRecentlyModified(next);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [hasRecentlyModified]);

  const markRecentlyModified = useCallback((eventId: string) => {
    setRecentlyModified((prev) => {
      const next = new Map(prev);
      next.set(eventId, Date.now());
      return next;
    });
  }, []);

  const modifiedCount = recentlyModified.size;

  const searchParams = useSearchParams();

  // Demo mode: URL param takes precedence, then localStorage.
  // Always initialise as false to match SSR and avoid hydration mismatches.
  const DEMO_STORAGE_KEY = 'symphonix-demo-mode';
  const [useMockData, setUseMockData] = useState(false);

  // Hydrate demo-mode state from URL param or localStorage after mount
  useEffect(() => {
    const urlDemo = searchParams.get('demo');
    if (urlDemo === 'true') {
      setUseMockData(true);
      localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    } else if (urlDemo === 'false') {
      setUseMockData(false);
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } else {
      // No URL param → restore from localStorage
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      if (stored === 'true') {
        setUseMockData(true);
      }
    }
  }, [searchParams]);

  const toggleDemoMode = useCallback(() => {
    setUseMockData((prev) => {
      const next = !prev;
      if (next) {
        localStorage.setItem(DEMO_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
      return next;
    });
  }, []);

  const { programs, selectedProgramId } = useProgram();
  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  // Seed mock data in demo mode
  useEffect(() => {
    if (useMockData) {
      setEvents(ALL_MOCK_EVENTS);
      setDbVenues(Object.values(VENUES).map((v) => ({ id: v.id, name: v.name })));
    }
  }, [useMockData]);

  // Initialize filters from URL search params (e.g. ?tag=Percussion from People page)
  useEffect(() => {
    const initial: ActiveFilters = {};

    const tag = searchParams.get('tag');
    if (tag) {
      initial.eventType = [tag.toLowerCase()];
    }

    const instructor = searchParams.get('instructor');
    if (instructor) {
      initial.instructor = [instructor];
    }

    const venue = searchParams.get('venue');
    if (venue) {
      initial.venue = [venue];
    }

    if (Object.keys(initial).length > 0) {
      setActiveFilters(initial);
    }
  }, [searchParams]);

  // Filter events based on active selections
  const filteredEvents = useMemo(() => {
    const hasActiveFilters = Object.values(activeFilters).some((v) => v.length > 0);
    if (!hasActiveFilters) return events;
    return events.filter((event) => eventMatchesFilters(event, activeFilters));
  }, [activeFilters, events]);

  // Navigate to day view when a day cell is clicked in month view
  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentView('day');
  }, []);

  // Context menu handlers
  const handleEventContextMenu = useCallback(
    (event: CalendarEvent, position: { x: number; y: number }) => {
      setContextMenu({ event, position });
    },
    [],
  );

  const handleContextMenuAction = useCallback(
    (action: ContextMenuAction, event: CalendarEvent) => {
      // In a real app, these would trigger API calls
      switch (action) {
        case 'cancel':
          // eslint-disable-next-line no-console
          console.log('Cancel event:', event.title);
          break;
        case 'suggest_replacements':
          // eslint-disable-next-line no-console
          console.log('Suggest replacements for:', event.title);
          break;
        case 'duplicate':
          // eslint-disable-next-line no-console
          console.log('Duplicate event:', event.title);
          break;
        case 'delete':
          // eslint-disable-next-line no-console
          console.log('Delete event:', event.title);
          break;
      }
      setContextMenu(null);
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Event edit panel
  const { panelState, openPanel, closePanel } = useEventEditPanel();

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    openPanel(event);
  }, [openPanel]);

  const handleSaveEvent = useCallback(async (eventId: string, data: EventEditPanelData) => {
    // Capture previous state for revert
    const prevEvents = events;

    // Optimistic update
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId
          ? {
              ...ev,
              title: data.title,
              venue: data.venue,
              instructor: data.instructor,
              date: data.date,
              time: data.time,
              endTime: data.endTime,
              tags: data.tags,
              notes: data.notes,
            }
          : ev,
      ),
    );
    markRecentlyModified(eventId);

    // Persist immediately
    try {
      const res = await fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data.date,
          start_time: to24h(data.time),
          end_time: to24h(data.endTime),
          notes: data.notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
    } catch (err) {
      // Revert on failure
      setEvents(prevEvents);
      showToast(err instanceof Error ? err.message : 'Failed to save event', 'error');
    }
  }, [events, markRecentlyModified]);

  // Drag-and-drop: optimistic update + immediate persist
  const handleEventDrop = useCallback(
    (eventId: string, newDate: string, newTime: string, newEndTime: string) => {
      const prevEvents = events;

      // Optimistic update
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, date: newDate, time: newTime, endTime: newEndTime }
            : ev,
        ),
      );
      markRecentlyModified(eventId);

      // Persist immediately
      fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          start_time: to24h(newTime),
          end_time: to24h(newEndTime),
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to save');
        })
        .catch(() => {
          setEvents(prevEvents);
          showToast('Failed to move event — reverted', 'error');
        });
    },
    [events, markRecentlyModified],
  );

  // Event resize: optimistic update + immediate persist
  const handleEventResize = useCallback(
    (eventId: string, newEndTime: string) => {
      const prevEvents = events;

      // Optimistic update
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, endTime: newEndTime } : ev,
        ),
      );
      markRecentlyModified(eventId);

      // Persist immediately
      fetch(`/api/sessions/${eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          end_time: to24h(newEndTime),
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to save');
        })
        .catch(() => {
          setEvents(prevEvents);
          showToast('Failed to resize event — reverted', 'error');
        });
    },
    [events, markRecentlyModified],
  );

  // Publish all draft sessions
  const handlePublishSchedule = useCallback(async () => {
    const drafts = events.filter((ev) => ev.status === 'draft');
    if (drafts.length === 0) {
      showToast('No draft sessions to publish', 'info');
      return;
    }

    setIsPublishing(true);
    try {
      const results = await Promise.allSettled(
        drafts.map((ev) =>
          fetch(`/api/sessions/${ev.id}`, {
            method: 'PATCH',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'published' }),
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;

      setEvents((prev) =>
        prev.map((ev) =>
          ev.status === 'draft' ? { ...ev, status: 'published' as const } : ev,
        ),
      );

      showToast(`${succeeded} session${succeeded !== 1 ? 's' : ''} published!`);
    } catch {
      showToast('Failed to publish schedule', 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [events]);

  // Compute the date range to fetch from the API based on the current view.
  // Includes a buffer around the visible window so nearby navigation doesn't
  // trigger an extra round-trip.
  const getFetchDateRange = useCallback((): { start_date: string; end_date: string } => {
    const anchor = selectedDate ?? new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    switch (currentView) {
      case 'day':
      case 'week': {
        // Buffer: ±1 month around the anchor so day/week navigation stays cached
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0); // last day of next month
        return { start_date: fmt(start), end_date: fmt(end) };
      }
      case 'month': {
        // Buffer: ±2 months so the 6-week grid overflow + adjacent navigation is covered
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0);
        return { start_date: fmt(start), end_date: fmt(end) };
      }
      case 'year': {
        const jan1 = new Date(anchor.getFullYear(), 0, 1);
        const dec31 = new Date(anchor.getFullYear(), 11, 31);
        return { start_date: fmt(jan1), end_date: fmt(dec31) };
      }
      default: {
        const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0);
        return { start_date: fmt(start), end_date: fmt(end) };
      }
    }
  }, [currentView, selectedDate]);

  // Fetch sessions for the visible date range (with buffer) instead of the
  // entire year.  This avoids hitting row limits and keeps payloads small.
  const fetchSessions = useCallback(async () => {
    if (useMockData) return;
    if (!selectedProgramId) return;

    try {
      const { start_date, end_date } = getFetchDateRange();

      const params = new URLSearchParams({
        program_id: selectedProgramId,
        start_date,
        end_date,
      });

      const res = await fetch(`/api/sessions?${params.toString()}`, { cache: 'no-store' });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        showToast(`Failed to load sessions: ${errBody.error || `HTTP ${res.status}`}`, 'error');
        return;
      }

      const body = await res.json();
      if (Array.isArray(body.sessions)) {
        setEvents(body.sessions.map(sessionToCalendarEvent));
      }

      // Fetch school calendar data
      const calParams = new URLSearchParams({ program_id: selectedProgramId });
      const calRes = await fetch(`/api/calendar?${calParams.toString()}`, { cache: 'no-store' });

      if (calRes.ok) {
        const calBody = await calRes.json();
        if (Array.isArray(calBody.entries)) {
          setSchoolCalendar(calBody.entries);
        }
      }

      // Fetch all venues from DB (includes empty venues with no events).
      // Don't filter by program_id — venues are physical spaces shared across programs.
      const venueRes = await fetch('/api/venues', { cache: 'no-store' });

      if (venueRes.ok) {
        const venueBody = await venueRes.json();
        if (Array.isArray(venueBody.venues)) {
          const mappedVenues = venueBody.venues.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }));
          console.log('[Admin] Fetched venues from API:', mappedVenues);
          setDbVenues(mappedVenues);
        }
      } else {
        console.warn('[Admin] Failed to fetch venues:', venueRes.status, venueRes.statusText);
      }
    } catch (err) {
      console.error('[fetchSessions]', err);
      showToast('Failed to load sessions — check console for details', 'error');
    }
  }, [selectedProgramId, useMockData, getFetchDateRange]);

  // Fetch sessions from DB on page load and when program changes
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-generate draft schedule — first shows preview, then confirms
  const handleGenerateSchedule = useCallback(async () => {
    if (useMockData) {
      showToast('Switch to Live Mode to generate a real schedule.', 'info');
      return;
    }
    if (!selectedProgramId) {
      showToast('Select a program first.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const anchor = selectedDate ?? new Date();
      const year = anchor.getFullYear();
      const payload = { program_id: selectedProgramId, year };

      // Run preview first (no DB mutations)
      const res = await fetch('/api/scheduler/generate?preview=true', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Preview failed');
      }

      // Show preview modal
      setSchedulerResult(body);
      setIsPreviewMode(true);
      setShowResultModal(true);
    } catch (err) {
      console.error('[handleGenerateSchedule]', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to generate preview',
        'error',
      );
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProgramId, selectedDate, useMockData]);

  // Confirm generation after preview
  const handleConfirmGenerate = useCallback(async () => {
    if (!selectedProgramId) return;
    setIsConfirmingGenerate(true);
    try {
      const anchor = selectedDate ?? new Date();
      const year = anchor.getFullYear();
      const payload = { program_id: selectedProgramId, year };

      // Run for real (clears drafts + inserts sessions)
      const res = await fetch('/api/scheduler/generate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        throw new Error(body.error || 'Generation failed');
      }

      // Show results modal
      setSchedulerResult(body);
      setIsPreviewMode(false);
      setShowResultModal(true);

      // Refresh calendar
      await fetchSessions();
    } catch (err) {
      console.error('[handleConfirmGenerate]', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to generate schedule',
        'error',
      );
      setShowResultModal(false);
    } finally {
      setIsConfirmingGenerate(false);
    }
  }, [selectedProgramId, selectedDate, fetchSessions]);

  // Clear all events for the current program
  const handleClearEvents = useCallback(async () => {
    setIsClearing(true);
    try {
      const url = `/api/sessions/bulk?program_id=${encodeURIComponent(selectedProgramId ?? '')}`;
      const res = await fetch(url, { method: 'DELETE', cache: 'no-store' });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Failed to clear events');
      }

      // Clear local state immediately
      setEvents([]);
      setShowClearModal(false);
      showToast(`All events cleared (${body.deleted ?? 0} deleted)`);

      // Force re-fetch to ensure we're in sync with DB
      await fetchSessions();
    } catch (err) {
      console.error('[handleClearEvents]', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to clear events',
        'error',
      );
    } finally {
      setIsClearing(false);
    }
  }, [selectedProgramId, fetchSessions]);

  // Export helpers — filter events by date range, generate CSV, trigger download
  const handleExportWeekly = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = monday.toISOString().slice(0, 10);
    const end = sunday.toISOString().slice(0, 10);
    const weekEvents = events.filter((ev) => ev.date && ev.date >= start && ev.date <= end);
    const count = exportEventsCsv(weekEvents, 'weekly');
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''}`);
    setShowExportMenu(false);
  }, [events]);

  const handleExportMonthly = useCallback(() => {
    const now = new Date();
    const yearStr = String(now.getFullYear());
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const start = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const monthEvents = events.filter((ev) => ev.date && ev.date >= start && ev.date <= end);
    const count = exportEventsCsv(monthEvents, 'monthly');
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''}`);
    setShowExportMenu(false);
  }, [events]);

  const handleExportYearly = useCallback(() => {
    const count = exportEventsCsv(events, 'yearly');
    showToast(`Exported ${count} event${count !== 1 ? 's' : ''}`);
    setShowExportMenu(false);
  }, [events]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ================================================================= */}
      {/* TOP BAR                                                            */}
      {/* ================================================================= */}
      <div className="flex items-center gap-4 bg-white px-6 py-4 border-b border-slate-200 shrink-0">
        {/* Program Selector */}
        <Tooltip text="Switch active program">
          <button className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <Music className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-slate-900">
              {selectedProgram?.name ?? 'Fall 2026 Program'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>
        </Tooltip>

        {/* View Toggle */}
        <ViewToggle value={currentView} onChange={setCurrentView} />

        {/* Today button (outline) */}
        <Button variant="todayOutline" tooltip="Jump to today's date">
          Today
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Demo Mode toggle */}
        <Tooltip text={useMockData ? 'Click to exit demo mode' : 'Click to enter demo mode (mock data)'}>
          <button
            onClick={toggleDemoMode}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md cursor-pointer transition-colors ${
              useMockData
                ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                : 'text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${useMockData ? 'bg-amber-500' : 'bg-slate-400'}`} />
            {useMockData ? 'Demo Mode' : 'Live Mode'}
          </button>
        </Tooltip>

        {/* Recently modified indicator (fades after 5s) */}
        {modifiedCount > 0 && (
          <Tooltip text={`${modifiedCount} event${modifiedCount !== 1 ? 's' : ''} saved in the last few seconds`}>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {modifiedCount} saved
            </span>
          </Tooltip>
        )}

        {/* Export Calendar */}
        <div className="relative">
          <Tooltip text="Export schedule as CSV">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-lg border transition-colors cursor-pointer ${
                showExportMenu
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {showExportMenu && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />

              <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-40">
                <Tooltip text="Download this week's events as CSV">
                  <button
                    onClick={handleExportWeekly}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Export Weekly Schedule (CSV)
                  </button>
                </Tooltip>
                <Tooltip text="Download this month's events as CSV">
                  <button
                    onClick={handleExportMonthly}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Export Monthly Schedule (CSV)
                  </button>
                </Tooltip>
                <Tooltip text="Download all events for the program year as CSV">
                  <button
                    onClick={handleExportYearly}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    Export Yearly Schedule (CSV)
                  </button>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Clear Events */}
        <Button
          variant="danger"
          tooltip="Delete all scheduled events for this program"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => setShowClearModal(true)}
        >
          Clear Events
        </Button>

        {/* Auto-Generate Draft */}
        <Button
          variant="secondary"
          tooltip="Preview and generate a draft schedule using templates"
          icon={isGenerating ? <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-slate-500" />}
          onClick={handleGenerateSchedule}
          disabled={isGenerating}
        >
          {isGenerating ? 'Previewing...' : 'Auto-Generate Draft'}
        </Button>

        {/* Publish Schedule + Readiness */}
        <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <ReadinessWidget programId={selectedProgramId} />
          <Button
            variant="primary"
            tooltip="Publish the current schedule to instructors"
            onClick={handlePublishSchedule}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish Schedule'}
          </Button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* FILTER BAR                                                         */}
      {/* ================================================================= */}
      <FilterBar
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                       */}
      {/* ================================================================= */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ---- Week View ---- */}
        {currentView === 'week' && (
          <>
            <WeekView
              events={filteredEvents}
              venues={dbVenues}
              currentDate={selectedDate}
              onDateChange={setSelectedDate}
              onEventClick={handleEditEvent}
              onEventContextMenu={handleEventContextMenu}
              onOpenEditPanel={openPanel}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
            />

            {/* Right Sidebar: Needs Assignment */}
            <div className="w-[260px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <Tooltip text="Events that need an instructor assigned">
                    <h3 className="text-sm font-semibold text-slate-900">Needs Assignment</h3>
                  </Tooltip>
                  <Badge variant="count" color="red" tooltip="Number of unassigned events">
                    {UPCOMING_UNASSIGNED.length}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {UPCOMING_UNASSIGNED.map((event) => (
                  <NeedsAssignmentCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ---- Day View ---- */}
        {currentView === 'day' && (
          <DayView
            events={filteredEvents}
            venues={dbVenues}
            currentDate={selectedDate}
            onDateChange={setSelectedDate}
            onBackToMonth={() => setCurrentView('month')}
            conflicts={1}
            onOpenEditPanel={openPanel}
          />
        )}

        {/* Portal target for Month/Year views — absolute-positioned to
            fill the calendar area, completely outside the flex flow */}
        <div
          ref={setPortalContainer}
          className="absolute inset-0"
          style={{ display: (currentView === 'month' || currentView === 'year') ? 'flex' : 'none' }}
        />
      </div>

      {/* ---- Month View (portaled) ---- */}
      {currentView === 'month' && portalContainer && createPortal(
        <MonthView
          events={filteredEvents}
          venues={dbVenues}
          currentDate={selectedDate}
          onDateChange={setSelectedDate}
          schoolCalendar={schoolCalendar}
          onDayClick={handleDayClick}
          onOpenEditPanel={openPanel}
        />,
        portalContainer,
      )}

      {/* ---- Year View (portaled) ---- */}
      {currentView === 'year' && portalContainer && createPortal(
        <YearView
          events={filteredEvents}
          venues={dbVenues}
          schoolCalendar={schoolCalendar}
          onTodayClick={() => setCurrentView('week')}
          onOpenEditPanel={openPanel}
        />,
        portalContainer,
      )}

      {/* ================================================================= */}
      {/* CONTEXT MENU (portal-like, rendered on top)                        */}
      {/* ================================================================= */}
      {contextMenu && (
        <EventContextMenu
          event={contextMenu.event}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onAction={handleContextMenuAction}
        />
      )}

      {/* Event Edit Side Panel */}
      {panelState.event && (
        <EventEditPanel
          event={panelState.event}
          open={panelState.open}
          onClose={closePanel}
          onSave={handleSaveEvent}
        />
      )}

      {/* Clear Events Confirmation Modal */}
      <ClearEventsModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearEvents}
        isClearing={isClearing}
      />

      {/* Scheduler Preview / Results Modal */}
      {schedulerResult && (
        <SchedulerResultModal
          open={showResultModal}
          onClose={() => {
            setShowResultModal(false);
            setSchedulerResult(null);
          }}
          result={schedulerResult}
          isPreview={isPreviewMode}
          onConfirm={handleConfirmGenerate}
          isConfirming={isConfirmingGenerate}
          programId={selectedProgramId ?? undefined}
        />
      )}
    </div>
  );
}
