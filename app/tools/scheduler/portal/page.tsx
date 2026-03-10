'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Instructor, Session, Venue, Program } from '@/types/database';
import { Tooltip } from '../components/ui/Tooltip';
import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────

interface SessionDisplay extends Session {
  venue?: Venue | null;
  program?: Program | null;
}

interface DateGroup {
  date: string;
  formatted: string;
  sessions: SessionDisplay[];
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function groupByDate(sessions: SessionDisplay[]): DateGroup[] {
  const map = new Map<string, SessionDisplay[]>();
  for (const s of sessions) {
    const existing = map.get(s.date);
    if (existing) {
      existing.push(s);
    } else {
      map.set(s.date, [s]);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sessions]) => ({
      date,
      formatted: formatDate(date),
      sessions: sessions.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
}

// ── View filter ────────────────────────────────────────────────────

type ViewFilter = 'upcoming' | 'past' | 'all';

// ── Component ──────────────────────────────────────────────────────

export default function InstructorPortalPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDisplay[]>([]);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('upcoming');

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/tools/scheduler/portal/login');
  }

  useEffect(() => {
    loadPortalData();
  }, []);

  async function loadPortalData() {
    setLoading(true);
    setError('');

    try {
      // Get logged-in user's email from Supabase auth
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('Unable to identify your account. Please log in again.');
        setLoading(false);
        return;
      }

      // Look up instructor by email
      const instrRes = await fetch(`/api/instructors?email=${encodeURIComponent(user.email)}`);
      if (!instrRes.ok) {
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      const { instructors } = await instrRes.json();
      if (!instructors || instructors.length === 0) {
        setError('No instructor profile found for your account.');
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
      const sessRes = await fetch(`/api/instructor-sessions?${sessParams}`);
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

  // Filter sessions by view
  const today = new Date().toISOString().split('T')[0];
  const filteredSessions = sessions.filter((s) => {
    if (viewFilter === 'upcoming') return s.date >= today;
    if (viewFilter === 'past') return s.date < today;
    return true;
  });

  const dateGroups = groupByDate(filteredSessions);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg className="mx-auto h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {instructor
                ? `${instructor.first_name} ${instructor.last_name}`
                : 'Staff Portal'}
            </h1>
            <div className="flex items-center gap-2">
              <Tooltip text="Return to scheduler home">
                <Link
                  href="/tools/scheduler"
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  &larr; Back
                </Link>
              </Tooltip>
              <Tooltip text="Sign out of your account">
                <button
                  onClick={handleSignOut}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                >
                  <svg className="inline-block h-4 w-4 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Sign Out
                </button>
              </Tooltip>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Your teaching schedule (read-only)
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <>
            {/* View filter tabs */}
            <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1">
              {([
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past' },
                { key: 'all', label: 'All' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewFilter(key)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewFilter === key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Session count */}
            <p className="mb-4 text-xs text-muted-foreground">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
            </p>

            {filteredSessions.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg sm:p-12">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                  <svg
                    className="h-7 w-7 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium">
                  {viewFilter === 'upcoming'
                    ? 'No upcoming sessions'
                    : viewFilter === 'past'
                      ? 'No past sessions'
                      : 'No sessions found'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {viewFilter === 'upcoming'
                    ? "You don't have any published sessions scheduled yet."
                    : 'No sessions match this filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {dateGroups.map((group) => (
                  <div key={group.date}>
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                      {group.formatted}
                    </h3>
                    <div className="space-y-3">
                      {group.sessions.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5"
                        >
                          <div className="mb-2 text-base font-semibold">
                            {formatTime(session.start_time)} –{' '}
                            {formatTime(session.end_time)}
                          </div>
                          <div className="space-y-1.5 text-sm">
                            {session.program && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-muted-foreground">Program:</span>
                                <span>{session.program.name}</span>
                              </div>
                            )}
                            {session.grade_groups.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-muted-foreground">Grades:</span>
                                <span>{session.grade_groups.join(', ')}</span>
                              </div>
                            )}
                            {session.venue && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-muted-foreground">Venue:</span>
                                <span>{session.venue.name}</span>
                              </div>
                            )}
                            {session.status !== 'published' && (
                              <div className="mt-2">
                                <span className="inline-block rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                                  {session.status}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
