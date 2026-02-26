'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Tooltip from '../../components/Tooltip';
import type { Instructor, Venue, AvailabilityJson, DayOfWeek, TimeBlock } from '@/types/database';

// ── Helpers ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const DAY_ABBR: Record<DayOfWeek, string> = {
  monday: 'M',
  tuesday: 'Tu',
  wednesday: 'W',
  thursday: 'Th',
  friday: 'F',
  saturday: 'Sa',
  sunday: 'Su',
};

function availabilitySummary(avail: AvailabilityJson | null): string {
  if (!avail) return 'Not set';
  const days = (Object.keys(avail) as DayOfWeek[]).filter(
    (d) => avail[d] && avail[d]!.length > 0,
  );
  if (days.length === 0) return 'Not set';
  return days.map((d) => DAY_ABBR[d]).join(', ');
}

function availabilityDetail(avail: AvailabilityJson | null): string {
  if (!avail) return 'No availability set';
  const days = (Object.keys(avail) as DayOfWeek[]).filter(
    (d) => avail[d] && avail[d]!.length > 0,
  );
  if (days.length === 0) return 'No availability set';
  return days.map((d) => {
    const times = avail[d]!.map((b) => `${b.start.slice(0, 5)}–${b.end.slice(0, 5)}`).join(', ');
    return `${DAY_ABBR[d]}: ${times}`;
  }).join(' · ');
}

// ── Availability grid constants ─────────────────────────────

const ALL_DAYS: { key: DayOfWeek; short: string }[] = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
];

const GRID_HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM

function formatHourLabel(h: number): string {
  const h12 = h === 0 || h === 12 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${h >= 12 ? 'PM' : 'AM'}`;
}

function isHourAvailable(hour: number, blocks: TimeBlock[]): boolean {
  const slotStart = hour * 60;
  const slotEnd = (hour + 1) * 60;
  return blocks.some((b) => {
    const [sh, sm] = b.start.split(':').map(Number);
    const [eh, em] = b.end.split(':').map(Number);
    return sh * 60 + sm < slotEnd && eh * 60 + em > slotStart;
  });
}

// ── Skeleton loaders ─────────────────────────────────────────

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-muted/30" />
      ))}
    </div>
  );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-40 rounded-lg bg-muted/30 animate-pulse" />
      ))}
    </div>
  );
}

// ── Skill badge ──────────────────────────────────────────────

function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
      {skill}
    </span>
  );
}

// ── Status dot ───────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${active ? 'bg-green-400' : 'bg-red-400'}`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Availability grid (read-only) ───────────────────────────

function AvailabilityGrid({ availability }: { availability: AvailabilityJson | null }) {
  if (!availability || Object.keys(availability).length === 0) {
    return <p className="text-sm text-muted-foreground">No availability set</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        <div
          className="grid gap-px rounded-lg border border-border overflow-hidden"
          style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
        >
          {/* Header row */}
          <div className="bg-muted/50 p-1" />
          {ALL_DAYS.map((day) => (
            <div
              key={day.key}
              className="bg-muted/50 py-1.5 text-center text-xs font-medium text-muted-foreground"
            >
              {day.short}
            </div>
          ))}

          {/* Time rows */}
          {GRID_HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex items-center justify-end pr-1.5 text-[10px] text-muted-foreground bg-card h-6 border-t border-border">
                {formatHourLabel(hour)}
              </div>
              {ALL_DAYS.map((day) => {
                const blocks = availability[day.key] ?? [];
                const available = isHourAvailable(hour, blocks);
                return (
                  <div
                    key={`${day.key}-${hour}`}
                    className={`h-6 border-t border-l border-border flex items-center justify-center ${
                      available ? 'bg-green-500/40' : 'bg-background'
                    }`}
                  >
                    <span className={`text-[10px] leading-none font-medium ${available ? 'text-white' : 'text-muted-foreground'}`}>
                      {formatHourLabel(hour)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Instructor detail modal ─────────────────────────────────

interface SessionRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  venue?: { name: string } | null;
  program?: { name: string } | null;
}

function InstructorDetailModal({
  instructor,
  sessionCount,
  sessions,
  loadingSessions,
  togglingStatus,
  onClose,
  onToggleStatus,
}: {
  instructor: Instructor;
  sessionCount: number | null;
  sessions: SessionRecord[];
  loadingSessions: boolean;
  togglingStatus: boolean;
  onClose: () => void;
  onToggleStatus: () => void;
}) {
  const [showSessions, setShowSessions] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">
              {instructor.first_name} {instructor.last_name}
            </h2>
            <div className="mt-1">
              <StatusDot active={instructor.is_active} />
            </div>
          </div>
          <Tooltip text="Close details">
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Status toggle */}
        <div className="mb-6">
          <Tooltip text="Toggle active/inactive status" position="bottom">
            <button
              onClick={onToggleStatus}
              disabled={togglingStatus}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                instructor.is_active
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                  : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
              }`}
            >
              {togglingStatus
                ? 'Updating…'
                : instructor.is_active
                  ? 'Deactivate Instructor'
                  : 'Activate Instructor'}
            </button>
          </Tooltip>
        </div>

        {/* Contact Info */}
        <div className="space-y-2 mb-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Contact
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium mt-0.5">{instructor.email ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium mt-0.5">{instructor.phone ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-2 mb-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {instructor.skills && instructor.skills.length > 0
              ? instructor.skills.map((s) => <SkillBadge key={s} skill={s} />)
              : <span className="text-sm text-muted-foreground">No skills listed</span>}
          </div>
        </div>

        {/* Assigned Sessions */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Assigned Sessions
            </h3>
            <Tooltip text="Jump to calendar filtered to this instructor">
              <Link
                href={`/tools/scheduler/admin?instructor=${instructor.id}`}
                onClick={onClose}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View on Calendar &rarr;
              </Link>
            </Tooltip>
          </div>
          <Tooltip text="Show or hide assigned session dates" position="bottom">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="w-full rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
            >
              {loadingSessions ? (
                <div className="h-8 w-16 rounded bg-muted/30 animate-pulse" />
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-semibold">{sessionCount ?? 0}</p>
                  <span className="text-xs text-muted-foreground">
                    {showSessions ? '▲ Hide' : '▼ Show dates'}
                  </span>
                </div>
              )}
            </button>
          </Tooltip>
          {showSessions && !loadingSessions && sessions.length > 0 && (
            <div className="rounded-lg border border-border bg-background overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Venue</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{s.venue?.name ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'scheduled' ? 'bg-green-500/20 text-green-400' :
                          s.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                          s.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showSessions && !loadingSessions && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground px-1">No sessions assigned yet.</p>
          )}
        </div>

        {/* Availability Grid */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Availability
          </h3>
          <AvailabilityGrid availability={instructor.availability_json} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function PeoplePage() {
  const [recentInstructors, setRecentInstructors] = useState<Instructor[]>([]);
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [detailSessionCount, setDetailSessionCount] = useState<number | null>(null);
  const [detailSessions, setDetailSessions] = useState<SessionRecord[]>([]);
  const [loadingDetailSessions, setLoadingDetailSessions] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Venues state
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);

  // Fetch all instructors from the API and populate both lists
  const fetchInstructors = useCallback(async () => {
    setLoadingRecent(true);
    setLoadingAll(true);
    try {
      const res = await fetch('/api/instructors');
      if (!res.ok) throw new Error(`Failed to fetch instructors: ${res.status}`);
      const { instructors } = (await res.json()) as { instructors: Instructor[] };

      // All instructors (already ordered by last_name from API)
      setAllInstructors(instructors);

      // Recent: sort by created_at desc and take 10
      const recent = [...instructors]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      setRecentInstructors(recent);
    } catch {
      // silently fail — empty state will show
      setAllInstructors([]);
      setRecentInstructors([]);
    } finally {
      setLoadingRecent(false);
      setLoadingAll(false);
    }
  }, []);

  // Fetch venues
  const fetchVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const res = await fetch('/api/venues');
      if (!res.ok) throw new Error(`Failed to fetch venues: ${res.status}`);
      const { venues: data } = (await res.json()) as { venues: Venue[] };
      setVenues(data);
    } catch {
      setVenues([]);
    } finally {
      setLoadingVenues(false);
    }
  }, []);

  useEffect(() => {
    fetchInstructors();
    fetchVenues();
  }, [fetchInstructors, fetchVenues]);

  // Open instructor detail modal
  const openDetail = useCallback(async (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setDetailSessionCount(null);
    setDetailSessions([]);
    setLoadingDetailSessions(true);
    try {
      const res = await fetch(`/api/instructor-sessions?instructor_id=${instructor.id}`);
      if (res.ok) {
        const { sessions } = (await res.json()) as { sessions: SessionRecord[] };
        setDetailSessionCount(sessions.length);
        setDetailSessions(sessions);
      }
    } catch {
      setDetailSessionCount(null);
      setDetailSessions([]);
    } finally {
      setLoadingDetailSessions(false);
    }
  }, []);

  // Toggle instructor active status
  const toggleStatus = useCallback(async () => {
    if (!selectedInstructor) return;
    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/instructors/${selectedInstructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !selectedInstructor.is_active }),
      });
      if (res.ok) {
        const { instructor: updated } = (await res.json()) as { instructor: Instructor };
        setSelectedInstructor(updated);
        // Update in local lists
        const update = (list: Instructor[]) =>
          list.map((i) => (i.id === updated.id ? updated : i));
        setAllInstructors(update);
        setRecentInstructors(update);
      }
    } catch {
      // silently fail
    } finally {
      setTogglingStatus(false);
    }
  }, [selectedInstructor]);

  // Filtered instructors for the All section
  const filtered = allInstructors.filter((inst) => {
    // Status filter
    if (filterStatus === 'active' && !inst.is_active) return false;
    if (filterStatus === 'inactive' && inst.is_active) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = `${inst.first_name} ${inst.last_name}`.toLowerCase();
      const email = (inst.email ?? '').toLowerCase();
      const skills = (inst.skills ?? []).join(' ').toLowerCase();
      return name.includes(q) || email.includes(q) || skills.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">People &amp; Places</h1>
        <p className="text-muted-foreground mt-1">
          Manage instructors and venues — skills, availability, capacity.
        </p>
      </div>

      {/* ── Recent Intake Submissions ──────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Intake Submissions</h2>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loadingRecent ? (
            <div className="p-4">
              <TableSkeleton rows={4} />
            </div>
          ) : recentInstructors.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No instructor submissions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Skills</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {recentInstructors.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {inst.first_name} {inst.last_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {inst.email ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {inst.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {inst.skills && inst.skills.length > 0
                            ? inst.skills.map((s) => <SkillBadge key={s} skill={s} />)
                            : <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {relativeTime(inst.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusDot active={inst.is_active} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Tooltip text="View availability, sessions, and contact info">
                          <button
                            onClick={() => openDetail(inst)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                          >
                            View Details
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── All Instructors ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">All Instructors</h2>

        {/* Search & filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Tooltip text="Search instructors by name, email, or skill" position="bottom">
              <input
                type="text"
                placeholder="Search by name, email, or skill…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Tooltip>
          </div>
          <Tooltip text="Filter by active or inactive status" position="bottom">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </Tooltip>
        </div>

        {/* Instructor cards */}
        {loadingAll ? (
          <CardGridSkeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            {allInstructors.length === 0
              ? 'No instructors found.'
              : 'No instructors match your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((inst) => (
              <Tooltip key={inst.id} text="View instructor details" position="bottom">
              <div
                className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-muted-foreground/30 transition-colors cursor-pointer"
                onClick={() => openDetail(inst)}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {inst.first_name} {inst.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {inst.email ?? 'No email'}
                    </p>
                  </div>
                  <StatusDot active={inst.is_active} />
                </div>

                {/* Phone */}
                {inst.phone && (
                  <p className="text-sm text-muted-foreground">{inst.phone}</p>
                )}

                {/* Skills */}
                <div className="flex flex-wrap gap-1">
                  {inst.skills && inst.skills.length > 0
                    ? inst.skills.map((s) => <SkillBadge key={s} skill={s} />)
                    : <span className="text-xs text-muted-foreground">No skills listed</span>}
                </div>

                {/* Availability */}
                <div className="text-xs">
                  <span className="text-muted-foreground mb-1 block">Availability</span>
                  <div className="flex gap-1.5">
                    {(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as DayOfWeek[]).map((day) => {
                      const avail = inst.availability_json;
                      const hasSlots = avail && avail[day] && avail[day]!.length > 0;
                      return (
                        <Tooltip key={day} text={`${DAY_ABBR[day]}: ${hasSlots ? 'Available' : 'Not available'}`} position="bottom">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-muted-foreground text-[10px]">{DAY_ABBR[day]}</span>
                            <span className={`h-2.5 w-2.5 rounded-full ${hasSlots ? 'bg-green-400' : 'bg-red-400/60'}`} />
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Count footer */}
        {!loadingAll && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {allInstructors.length} instructor{allInstructors.length !== 1 ? 's' : ''}
          </p>
        )}
      </section>

      {/* ── Venues (Places) ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Venues</h2>

        {loadingVenues ? (
          <CardGridSkeleton />
        ) : venues.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            No venues found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-muted-foreground/30 transition-colors"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{venue.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {venue.space_type}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${venue.is_virtual ? 'bg-blue-400' : 'bg-green-400'}`}
                    />
                    {venue.is_virtual ? 'Virtual' : 'In-Person'}
                  </span>
                </div>

                {/* Capacity */}
                {venue.max_capacity != null && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    Capacity: {venue.max_capacity}
                  </div>
                )}

                {/* Notes / Equipment */}
                {venue.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{venue.notes}</p>
                )}

                {/* Availability */}
                <div className="text-xs text-muted-foreground">
                  Availability: {availabilitySummary(venue.availability_json)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Count footer */}
        {!loadingVenues && venues.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {venues.length} venue{venues.length !== 1 ? 's' : ''}
          </p>
        )}
      </section>

      {/* ── Instructor Detail Modal ────────────────────────────── */}
      {selectedInstructor && (
        <InstructorDetailModal
          instructor={selectedInstructor}
          sessionCount={detailSessionCount}
          sessions={detailSessions}
          loadingSessions={loadingDetailSessions}
          togglingStatus={togglingStatus}
          onClose={() => setSelectedInstructor(null)}
          onToggleStatus={toggleStatus}
        />
      )}
    </div>
  );
}
