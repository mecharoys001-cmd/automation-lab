'use client';

import { useState } from 'react';
import type { Instructor, Session, Venue, Program } from '@/types/database';
import Tooltip from '../components/Tooltip';

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Component ──────────────────────────────────────────────────────

export default function InstructorPortalPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sessions, setSessions] = useState<SessionDisplay[]>([]);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError('');
    setLoading(true);
    setError('');

    try {
      // 1. Look up instructor by email
      const instrRes = await fetch(`/api/instructors?email=${encodeURIComponent(trimmed)}`);
      if (!instrRes.ok) {
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      const { instructors } = await instrRes.json();
      if (!instructors || instructors.length === 0) {
        setError('No instructor found with that email address. Please check and try again.');
        setLoading(false);
        return;
      }

      const resolvedInstructor = instructors[0] as Instructor;
      setInstructor(resolvedInstructor);

      // 2. Fetch upcoming published sessions for this instructor
      const today = new Date().toISOString().split('T')[0];
      const sessParams = new URLSearchParams({
        instructor_id: resolvedInstructor.id,
        status: 'published',
        from_date: today,
      });
      const sessRes = await fetch(`/api/instructor-sessions?${sessParams}`);
      if (!sessRes.ok) {
        setError('Failed to load schedule. Please try again.');
        setLoading(false);
        return;
      }

      const { sessions: sessionData } = await sessRes.json();
      setSessions((sessionData as SessionDisplay[]) ?? []);
      setShowSchedule(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setShowSchedule(false);
    setSessions([]);
    setInstructor(null);
    setError('');
    setEmailError('');
  }

  const dateGroups = groupByDate(sessions);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Instructor Portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            View your upcoming teaching schedule
          </p>
        </div>

        {!showSchedule ? (
          /* ── Email Entry Form ─────────────────────────────────── */
          <div className="rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Email Address
                </label>
                <Tooltip text="Enter your instructor email address">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    className={`w-full rounded-md border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring ${
                      emailError ? 'border-red-500' : 'border-border'
                    }`}
                  />
                </Tooltip>
                {emailError && (
                  <p className="mt-1.5 text-xs text-red-400">{emailError}</p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Tooltip text="Look up your upcoming teaching schedule">
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Loading…
                    </span>
                  ) : (
                    'View My Schedule'
                  )}
                </button>
              </Tooltip>
            </form>
          </div>
        ) : (
          /* ── Schedule Display ─────────────────────────────────── */
          <div className="space-y-5">
            {/* Instructor header + back button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {instructor
                    ? `${instructor.first_name} ${instructor.last_name}`
                    : email}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {sessions.length} upcoming session
                  {sessions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Tooltip text="Return to email lookup">
                <button
                  onClick={handleBack}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  &larr; Back
                </button>
              </Tooltip>
            </div>

            {sessions.length === 0 ? (
              /* ── Empty state ─────────────────────────────────── */
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
                <p className="text-sm font-medium">No upcoming sessions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You don&apos;t have any published sessions scheduled yet.
                </p>
              </div>
            ) : (
              /* ── Sessions grouped by date ────────────────────── */
              <div className="space-y-6">
                {dateGroups.map((group) => (
                  <div key={group.date}>
                    {/* Date header */}
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                      {group.formatted}
                    </h3>

                    {/* Session cards for this date */}
                    <div className="space-y-3">
                      {group.sessions.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5"
                        >
                          {/* Time row */}
                          <div className="mb-2 text-base font-semibold">
                            {formatTime(session.start_time)} –{' '}
                            {formatTime(session.end_time)}
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5 text-sm">
                            {session.program && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-muted-foreground">
                                  Program:
                                </span>
                                <span>{session.program.name}</span>
                              </div>
                            )}

                            {session.grade_groups.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-muted-foreground">
                                  Grades:
                                </span>
                                <span>{session.grade_groups.join(', ')}</span>
                              </div>
                            )}

                            {session.venue && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 text-muted-foreground">
                                  Venue:
                                </span>
                                <span>{session.venue.name}</span>
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
          </div>
        )}
      </div>
    </div>
  );
}
