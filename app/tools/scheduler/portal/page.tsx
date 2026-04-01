'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Instructor, Session, Venue, Program } from '@/types/database';
import { Tooltip } from '../components/ui/Tooltip';
import { ViewToggle } from '../components/ui/ViewToggle';
import type { CalendarView } from '../components/ui/ViewToggle';
import type { CalendarEvent } from '../components/calendar/types';
import { sessionToCalendarEvent } from '../lib/sessionToCalendarEvent';

// Code-split heavy calendar views
const WeekView = dynamic(() => import('../components/calendar/WeekView').then(m => ({ default: m.WeekView })), { ssr: false });
const MonthView = dynamic(() => import('../components/calendar/MonthView').then(m => ({ default: m.MonthView })), { ssr: false });
const DayView = dynamic(() => import('../components/calendar/DayView').then(m => ({ default: m.DayView })), { ssr: false });
const YearView = dynamic(() => import('../components/calendar/YearView').then(m => ({ default: m.YearView })), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────

interface SessionDisplay extends Session {
  venue?: Venue | null;
  program?: Program | null;
  instructor?: { id: string; first_name: string; last_name: string } | null;
}

// ── Schedule mode ─────────────────────────────────────────────────

type ScheduleMode = 'my' | 'full';

// ── View filter ────────────────────────────────────────────────────

type ViewFilter = 'upcoming' | 'past' | 'all';

// ── Component ──────────────────────────────────────────────────────

export default function InstructorPortalPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDisplay[]>([]);
  const [fullSessions, setFullSessions] = useState<SessionDisplay[]>([]);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('my');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('upcoming');
  const [fullScheduleLoading, setFullScheduleLoading] = useState(false);
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/tools/scheduler/portal/login');
  }

  useEffect(() => {
    loadPortalData();
  }, []);

  async function loadPortalData() {
    setLoading(true);
    setError('');

    try {
      // Get logged-in user's email via server API (cookies are httpOnly)
      const authRes = await fetch('/api/auth/me');
      const authData = authRes.ok ? await authRes.json() : null;
      if (!authData?.email) {
        setError('Unable to identify your account. Please log in again.');
        setLoading(false);
        return;
      }

      // Look up instructor by email
      const instrRes = await fetch(`/api/staff?email=${encodeURIComponent(authData.email)}`);
      if (!instrRes.ok) {
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      const { instructors } = await instrRes.json();
      if (!instructors || instructors.length === 0) {
        setError('No staff profile found for your account.');
        setLoading(false);
        return;
      }

      const resolvedInstructor = instructors[0] as Instructor;
      setInstructor(resolvedInstructor);

      // Fetch all sessions for this instructor (both past and upcoming)
      const sessParams = new URLSearchParams({
        instructor_id: resolvedInstructor.id,
        status: 'published',
      });
      const sessRes = await fetch(`/api/staff-sessions?${sessParams}`);
      if (!sessRes.ok) {
        setError('Failed to load schedule. Please try again.');
        setLoading(false);
        return;
      }

      const { sessions: sessionData } = await sessRes.json();
      setSessions((sessionData as SessionDisplay[]) ?? []);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Load full schedule when switching to that mode
  useEffect(() => {
    if (scheduleMode === 'full' && fullSessions.length === 0 && instructor) {
      loadFullSchedule();
    }
  }, [scheduleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFullSchedule() {
    if (!instructor || !sessions.length) return;
    // Determine program_id from the user's sessions
    const programId = sessions[0]?.program_id;
    if (!programId) return;

    setFullScheduleLoading(true);
    try {
      const params = new URLSearchParams({
        program_id: programId,
        status: 'published',
      });
      const res = await fetch(`/api/staff-sessions?${params}`);
      if (res.ok) {
        const { sessions: data } = await res.json();
        setFullSessions((data as SessionDisplay[]) ?? []);
      }
    } catch {
      // Silently fail — user can retry by toggling
    } finally {
      setFullScheduleLoading(false);
    }
  }

  // Filter sessions by view and convert to CalendarEvents
  const today = new Date().toISOString().split('T')[0];
  const activeSessions = scheduleMode === 'full' ? fullSessions : sessions;

  const filteredEvents = useMemo(() => {
    const filtered = activeSessions.filter((s) => {
      if (viewFilter === 'upcoming') return s.date >= today;
      if (viewFilter === 'past') return s.date < today;
      return true;
    });
    return filtered.map(sessionToCalendarEvent);
  }, [activeSessions, viewFilter, today]);

  // Derive venues from session data for DayView
  const venues = useMemo(() => {
    const venueMap = new Map<string, { id: string; name: string }>();
    for (const s of activeSessions) {
      if (s.venue) {
        venueMap.set(s.venue.id ?? s.venue_id, { id: s.venue.id ?? s.venue_id, name: s.venue.name });
      }
    }
    return Array.from(venueMap.values());
  }, [activeSessions]);

  // Event click handler (read-only — just log for now)
  function handleEventClick(event: CalendarEvent) {
    // Read-only portal — no edit panel
    console.log('Event clicked:', event);
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg className="mx-auto h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-500">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold sm:text-3xl text-slate-900">
              {instructor
                ? `${instructor.first_name} ${instructor.last_name}`
                : 'Staff Portal'}
            </h1>
            <div className="flex items-center gap-2">
              <Tooltip text="Return to scheduler home">
                <Link
                  href="/tools/scheduler"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  &larr; Back
                </Link>
              </Tooltip>
              <Tooltip text="Sign out of your account">
                <button
                  onClick={handleSignOut}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  aria-label="Sign out of your account"
                >
                  <svg className="inline-block h-4 w-4 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Sign Out
                </button>
              </Tooltip>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {scheduleMode === 'full' ? 'Full program schedule (read-only)' : 'Your teaching schedule (read-only)'}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <>
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Schedule mode toggle */}
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {([
                  { key: 'my' as const, label: 'My Schedule', tip: 'Show only your sessions' },
                  { key: 'full' as const, label: 'Full Schedule', tip: 'Show all sessions in your program' },
                ]).map(({ key, label, tip }) => (
                  <Tooltip key={key} text={tip}>
                    <button
                      onClick={() => setScheduleMode(key)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        scheduleMode === key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  </Tooltip>
                ))}
              </div>

              {/* View filter tabs */}
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {([
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'past', label: 'Past' },
                  { key: 'all', label: 'All' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setViewFilter(key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      viewFilter === key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <ViewToggle value={currentView} onChange={setCurrentView} />

              {/* Session count */}
              <span className="text-xs text-slate-400 ml-auto">
                {filteredEvents.length} session{filteredEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Calendar area */}
            {fullScheduleLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-2 text-sm text-slate-500">Loading full schedule...</span>
              </div>
            ) : (
              <div className="min-h-[600px]">
                {currentView === 'week' && (
                  <WeekView
                    events={filteredEvents}
                    venues={venues}
                    currentDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onEventClick={handleEventClick}
                  />
                )}
                {currentView === 'day' && (
                  <DayView
                    events={filteredEvents}
                    venues={venues}
                    currentDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onEventClick={handleEventClick}
                    onBackToMonth={() => setCurrentView('month')}
                  />
                )}
                {currentView === 'month' && (
                  <MonthView
                    events={filteredEvents}
                    venues={venues}
                    currentDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onDayClick={(date: Date) => {
                      setSelectedDate(date);
                      setCurrentView('day');
                    }}
                    onEventClick={handleEventClick}
                  />
                )}
                {currentView === 'year' && (
                  <YearView
                    events={filteredEvents}
                    venues={venues}
                    currentDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onDayClick={(date: Date) => {
                      setSelectedDate(date);
                      setCurrentView('month');
                    }}
                    onEventClick={handleEventClick}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
