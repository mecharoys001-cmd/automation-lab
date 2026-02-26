'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { EventClickArg, DateSelectArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { sessionToCalendarEvent, type SessionCalendarHandle } from '../components/SessionCalendar';
import SchoolYearView from '../components/SchoolYearView';
import SchoolYearWeekView from '../components/SchoolYearWeekView';
import Tooltip from '../components/Tooltip';
import { useProgram } from './ProgramContext';

const SessionCalendar = dynamic(
  () => import('../components/SessionCalendar'),
  { ssr: false }
);

interface SessionStats {
  total: number;
  draft: number;
  published: number;
  canceled: number;
  completed: number;
  unassigned: number;
}

// Raw session shape from the API (with relations)
interface RawSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  grade_groups: string[];
  scheduling_notes?: string | null;
  tags?: { id: string; name: string; color?: string | null; description?: string | null }[];
  instructor?: { id: string; first_name: string; last_name: string } | null;
  venue?: { id: string; name: string; space_type: string } | null;
}

interface TagOption {
  id: string;
  name: string;
  description?: string | null;
}

interface InstructorOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface VenueOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = ['draft', 'published', 'canceled', 'completed'] as const;

// ── Multi-select dropdown component ──────────────────────────────────
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  title,
}: {
  label: string;
  options: { value: string; label: string; title?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors min-w-[140px]"
      >
        <span className="truncate">
          {selected.length === 0
            ? label
            : `${label} (${selected.length})`}
        </span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 max-h-60 overflow-auto rounded-lg border border-border bg-card shadow-lg">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No options</p>
          )}
          {options.map((opt) => (
            <label
              key={opt.value}
              title={opt.title}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-border accent-primary"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminDashboardContent() {
  const { selectedProgramId } = useProgram();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    total: 0, draft: 0, published: 0, canceled: 0, completed: 0, unassigned: 0,
  });
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generateWarnings, setGenerateWarnings] = useState<number>(0);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'year' | 'week'>('calendar');
  const calendarRef = useRef<SessionCalendarHandle>(null);

  // ── Navigation & feedback state ──────────────────────────────────
  const [previousView, setPreviousView] = useState<'year' | 'week' | null>(null);
  const [previousScrollDate, setPreviousScrollDate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [viewFadeIn, setViewFadeIn] = useState(true);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modal state ────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RawSession | null>(null);

  // ── Filter state ───────────────────────────────────────────────────
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedGradeGroups, setSelectedGradeGroups] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showNeedsAttention, setShowNeedsAttention] = useState(false);

  // ── Available tags for modal dropdown ────────────────────────
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [addingTagToSession, setAddingTagToSession] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Derive unique grade groups from raw sessions
  const gradeGroupOptions = useMemo(() => {
    const groups = new Set<string>();
    for (const s of sessions) {
      if (s.grade_groups) s.grade_groups.forEach((g) => groups.add(g));
    }
    return Array.from(groups).sort();
  }, [sessions]);

  // Derive unique tag names from raw sessions (with descriptions)
  const tagOptions = useMemo(() => {
    const tagMap = new Map<string, string | undefined>();
    for (const s of sessions) {
      if (s.tags) s.tags.forEach((t) => {
        if (!tagMap.has(t.name)) tagMap.set(t.name, t.description ?? undefined);
      });
    }
    return Array.from(tagMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  // Apply filters
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    if (selectedInstructors.length > 0) {
      filtered = filtered.filter(
        (s) => s.instructor && selectedInstructors.includes(s.instructor.id),
      );
    }

    if (selectedVenues.length > 0) {
      filtered = filtered.filter(
        (s) => s.venue && selectedVenues.includes(s.venue.id),
      );
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((s) => selectedStatuses.includes(s.status));
    }

    if (selectedGradeGroups.length > 0) {
      filtered = filtered.filter(
        (s) =>
          s.grade_groups &&
          s.grade_groups.some((g) => selectedGradeGroups.includes(g)),
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(
        (s) =>
          s.tags &&
          s.tags.some((t) => selectedTags.includes(t.name)),
      );
    }

    if (showNeedsAttention) {
      filtered = filtered.filter(
        (s) => !s.instructor || !!s.scheduling_notes,
      );
    }

    return filtered;
  }, [sessions, selectedInstructors, selectedVenues, selectedStatuses, selectedGradeGroups, selectedTags, showNeedsAttention]);

  // Convert to calendar events (for FullCalendar view)
  const events = useMemo<EventInput[]>(() => {
    return filteredSessions.map(sessionToCalendarEvent);
  }, [filteredSessions]);

  const activeFilterCount =
    (selectedInstructors.length > 0 ? 1 : 0) +
    (selectedVenues.length > 0 ? 1 : 0) +
    (selectedStatuses.length > 0 ? 1 : 0) +
    (selectedGradeGroups.length > 0 ? 1 : 0) +
    (selectedTags.length > 0 ? 1 : 0) +
    (showNeedsAttention ? 1 : 0);

  const clearFilters = () => {
    setSelectedInstructors([]);
    setSelectedVenues([]);
    setSelectedStatuses([]);
    setSelectedGradeGroups([]);
    setSelectedTags([]);
    setShowNeedsAttention(false);
  };

  // ── Fetch instructors & venues on mount ────────────────────────────
  useEffect(() => {
    async function loadFilterData() {
      try {
        const [instrRes, venueRes, tagsRes] = await Promise.all([
          fetch('/api/instructors?is_active=true'),
          fetch('/api/venues'),
          fetch('/api/tags'),
        ]);
        const instrData = await instrRes.json();
        const venueData = await venueRes.json();
        const tagsData = await tagsRes.json();
        if (instrData.instructors) setInstructors(instrData.instructors);
        if (venueData.venues) setVenues(venueData.venues);
        if (tagsData.tags) setAvailableTags(tagsData.tags);
      } catch (err) {
        console.error('Failed to load filter data:', err);
      }
    }
    loadFilterData();
  }, []);

  // Apply instructor filter from URL query param
  useEffect(() => {
    const instructorParam = searchParams.get('instructor');
    if (instructorParam) {
      setSelectedInstructors([instructorParam]);
    }
  }, [searchParams]);

  // Fetch sessions (store raw sessions instead of converting immediately)
  const fetchSessions = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/sessions?program_id=${selectedProgramId}`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedProgramId]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!selectedProgramId) return;
    try {
      const res = await fetch(`/api/sessions/stats?program_id=${selectedProgramId}`);
      const data = await res.json();
      if (!data.error) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [selectedProgramId]);

  // Load data when program changes
  useEffect(() => {
    if (selectedProgramId) {
      fetchSessions();
      fetchStats();
    }
  }, [selectedProgramId, fetchSessions, fetchStats]);

  // Generate sessions from templates
  const handleGenerate = async () => {
    if (!selectedProgramId) return;
    setGenerating(true);
    setGenerateResult(null);
    setGenerateWarnings(0);
    try {
      const res = await fetch('/api/scheduler/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: selectedProgramId }),
      });
      const result = await res.json();
      if (result.success) {
        setGenerateResult(result.summary);
        setGenerateWarnings(result.sessions_with_warnings ?? 0);
        // Refresh calendar and stats
        await Promise.all([fetchSessions(), fetchStats()]);
      } else {
        setGenerateResult(`Error: ${result.error}`);
      }
    } catch (err) {
      setGenerateResult(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  // Publish all draft sessions
  const handlePublish = async () => {
    if (!selectedProgramId || stats.draft === 0) return;
    setShowPublishDialog(false);
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/notifications/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: selectedProgramId }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setPublishResult({
          type: 'success',
          message: `Published ${result.sessionsPublished ?? 0} sessions and sent ${result.notificationsSent ?? 0} notifications.`,
        });
        await Promise.all([fetchSessions(), fetchStats()]);
      } else {
        setPublishResult({ type: 'error', message: result.error || 'Failed to publish schedule' });
      }
    } catch (err) {
      setPublishResult({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setPublishing(false);
    }
  };

  // ── Tag management for sessions ──────────────────────────────
  const handleAddTagToSession = async (sessionId: string, tagId: string) => {
    setAddingTagToSession(true);
    try {
      const res = await fetch('/api/session-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, tag_id: tagId }),
      });
      if (res.ok) {
        // Update local session state
        const tag = availableTags.find((t) => t.id === tagId);
        if (tag && selectedEvent) {
          const updatedTags = [...(selectedEvent.tags ?? []), { id: tag.id, name: tag.name }];
          const updated = { ...selectedEvent, tags: updatedTags };
          setSelectedEvent(updated);
          setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
          );
        }
      }
    } catch (err) {
      console.error('Failed to add tag:', err);
    } finally {
      setAddingTagToSession(false);
      setShowTagDropdown(false);
    }
  };

  const handleRemoveTagFromSession = async (sessionId: string, tagId: string) => {
    try {
      const res = await fetch('/api/session-tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, tag_id: tagId }),
      });
      if (res.ok && selectedEvent) {
        const updatedTags = (selectedEvent.tags ?? []).filter((t) => t.id !== tagId);
        const updated = { ...selectedEvent, tags: updatedTags };
        setSelectedEvent(updated);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
        );
      }
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  // ── Toast helper ───────────────────────────────────────────────────
  const showToast = useCallback((date: string) => {
    const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    setToastMessage(`Viewing ${label}`);
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToastMessage(null), 300);
    }, 2000);
  }, []);

  const handleEventClick = (info: EventClickArg) => {
    const session = filteredSessions.find((s) => s.id === info.event.id);
    if (session) setSelectedEvent(session);
  };

  const handleDateClick = (info: DateClickArg) => {
    const date = info.dateStr.slice(0, 10);
    showToast(date);
    if (viewMode === 'calendar') {
      setCalendarDate(date);
      calendarRef.current?.goToDay(date);
    } else {
      setPreviousView(viewMode as 'year' | 'week');
      setPreviousScrollDate(date);
      setViewMode('calendar');
      setCalendarDate(date);
      setTimeout(() => calendarRef.current?.goToDay(date), 100);
    }
  };

  const handleDayClickFromScroll = (date: string) => {
    setPreviousView(viewMode as 'year' | 'week');
    setPreviousScrollDate(date);
    setViewMode('calendar');
    setCalendarDate(date);
    showToast(date);
    setTimeout(() => calendarRef.current?.goToDay(date), 100);
  };

  const handleBackToScrollView = () => {
    if (previousView) {
      setViewMode(previousView);
      setPreviousView(null);
      setPreviousScrollDate(null);
    }
  };

  const handleGoToToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (viewMode === 'calendar') {
      calendarRef.current?.goToDay(today);
      setCalendarDate(today);
    } else {
      setViewMode('calendar');
      setCalendarDate(today);
      setTimeout(() => calendarRef.current?.goToDay(today), 100);
    }
    showToast(today);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    console.log('Date selected:', info.startStr, '→', info.endStr);
  };

  const handleEventDrop = (info: EventDropArg) => {
    console.log('Event moved:', info.event.title, '→', info.event.startStr);
  };

  // ── Current date indicator label ────────────────────────────────────
  const currentDateLabel = useMemo(() => {
    if (viewMode === 'year') return 'School Year 2025\u20132026';
    if (viewMode === 'week') return 'All Weeks \u2014 School Year 2025\u20132026';
    const d = new Date(calendarDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }, [viewMode, calendarDate]);

  // ── View transition effect ────────────────────────────────────────
  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      setViewFadeIn(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setViewFadeIn(true);
        });
      });
      prevViewModeRef.current = viewMode;
    }
  }, [viewMode]);

  const statItems = [
    { label: 'Total Sessions', value: stats.total, color: 'text-foreground', tooltip: 'Total sessions in the system' },
    { label: 'Draft', value: stats.draft, color: 'text-gray-400', tooltip: 'Sessions pending review' },
    { label: 'Published', value: stats.published, color: 'text-blue-400', tooltip: 'Sessions published and visible to instructors' },
    { label: 'Unassigned', value: stats.unassigned, color: 'text-red-400', tooltip: 'Sessions with no assigned instructor' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground mt-1">
            View and manage sessions. Drag to reschedule, click to edit.
          </p>
        </div>
        <div className="flex gap-3">
          <Tooltip text="Auto-generate sessions from your session templates" position="bottom">
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedProgramId}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate from Templates'}
            </button>
          </Tooltip>
          <Tooltip text="Publish all draft sessions and notify instructors" position="bottom">
            <button
              onClick={() => setShowPublishDialog(true)}
              disabled={publishing || !selectedProgramId || stats.draft === 0}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing
                ? 'Publishing...'
                : `Publish Schedule${stats.draft > 0 ? ` (${stats.draft} draft)` : ''}`}
            </button>
          </Tooltip>
          <Tooltip text="Manually create a new session" position="bottom">
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              New Session
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Generate Result Banner */}
      {generateResult && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            generateResult.startsWith('Error') || generateResult.startsWith('Failed')
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : generateWarnings > 0
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-green-500/30 bg-green-500/10 text-green-400'
          }`}
        >
          <span>{generateResult}</span>
          {generateWarnings > 0 && (
            <Tooltip text="Filter calendar to show only sessions needing attention">
              <button
                onClick={() => {
                  setShowNeedsAttention(true);
                  setGenerateResult(null);
                  setGenerateWarnings(0);
                }}
                className="ml-3 text-xs font-medium underline text-amber-400 hover:text-amber-300 transition-colors"
              >
                Show {generateWarnings} warning{generateWarnings !== 1 ? 's' : ''}
              </button>
            </Tooltip>
          )}
          <Tooltip text="Dismiss this notification">
            <button
              onClick={() => { setGenerateResult(null); setGenerateWarnings(0); }}
              className="ml-3 text-xs underline opacity-70 hover:opacity-100"
            >
              dismiss
            </button>
          </Tooltip>
        </div>
      )}

      {/* Publish Result Banner */}
      {publishResult && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            publishResult.type === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-green-500/30 bg-green-500/10 text-green-400'
          }`}
        >
          {publishResult.message}
          <Tooltip text="Dismiss this notification">
            <button
              onClick={() => setPublishResult(null)}
              className="ml-3 text-xs underline opacity-70 hover:opacity-100"
            >
              dismiss
            </button>
          </Tooltip>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <Tooltip key={stat.label} text={stat.tooltip}>
            <div
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Status Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <Tooltip text="Not yet published or reviewed">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6b7280' }} />
            Draft
          </span>
        </Tooltip>
        <Tooltip text="Visible to instructors">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
            Published
          </span>
        </Tooltip>
        <Tooltip text="Session has been canceled">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
            Canceled
          </span>
        </Tooltip>
        <Tooltip text="Session has been completed">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
            Completed
          </span>
        </Tooltip>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Filters
          </span>

          <Tooltip text="Filter sessions by assigned instructor">
            <MultiSelectDropdown
              label="Instructor"
              title="Filter sessions by assigned instructor"
              options={instructors.map((i) => ({
                value: i.id,
                label: `${i.first_name} ${i.last_name}`,
              }))}
              selected={selectedInstructors}
              onChange={setSelectedInstructors}
            />
          </Tooltip>

          <Tooltip text="Filter sessions by venue location">
            <MultiSelectDropdown
              label="Venue"
              title="Filter sessions by venue location"
              options={venues.map((v) => ({ value: v.id, label: v.name }))}
              selected={selectedVenues}
              onChange={setSelectedVenues}
            />
          </Tooltip>

          <Tooltip text="Filter sessions by current status">
            <MultiSelectDropdown
              label="Status"
              title="Filter sessions by current status"
              options={STATUS_OPTIONS.map((s) => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
              }))}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
            />
          </Tooltip>

          <Tooltip text="Filter sessions by grade group">
            <MultiSelectDropdown
              label="Grade Group"
              title="Filter sessions by grade group"
              options={gradeGroupOptions.map((g) => ({ value: g, label: g }))}
              selected={selectedGradeGroups}
              onChange={setSelectedGradeGroups}
            />
          </Tooltip>

          <Tooltip text="Filter sessions by event type tag">
            <MultiSelectDropdown
              label="Event Type"
              title="Filter sessions by event type tag"
              options={tagOptions.map(([name, desc]) => ({ value: name, label: name, title: desc }))}
              selected={selectedTags}
              onChange={setSelectedTags}
            />
          </Tooltip>

          <Tooltip text="Show only unassigned sessions or those with scheduling warnings" position="bottom">
            <button
              onClick={() => setShowNeedsAttention((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                showNeedsAttention
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Needs Attention
            </button>
          </Tooltip>

          {activeFilterCount > 0 && (
            <>
              <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </span>
              <Tooltip text="Remove all active filters" position="bottom">
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Clear filters
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-border bg-card p-1">
          <Tooltip text="Interactive calendar with week/day/month views" position="bottom">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Calendar View
            </button>
          </Tooltip>
          <Tooltip text="Scroll through all months of the school year" position="bottom">
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Year View
            </button>
          </Tooltip>
          <Tooltip text="Scroll through all weeks of the school year" position="bottom">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Week View
            </button>
          </Tooltip>
        </div>
        {viewMode !== 'calendar' && (
          <span className="text-xs text-muted-foreground">
            Nov 2025 &ndash; Jun 2026 &middot; {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Back Banner */}
      {previousView && viewMode === 'calendar' && (
        <Tooltip text={`Return to ${previousView === 'year' ? 'Year' : 'Week'} scroll view`} position="bottom">
          <button
            onClick={handleBackToScrollView}
            className="w-full flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to {previousView === 'year' ? 'Year' : 'Week'} View
          </button>
        </Tooltip>
      )}

      {/* Current Date Indicator */}
      <div className="rounded-lg border border-border bg-card/50 px-4 py-2.5">
        <p className="text-sm font-medium text-foreground">{currentDateLabel}</p>
      </div>

      {/* Calendar / Year / Week View */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ opacity: viewFadeIn ? 1 : 0, transform: viewFadeIn ? 'translateY(0)' : 'translateY(4px)' }}
      >
      {viewMode === 'calendar' ? (
        <div className="rounded-lg border border-border bg-card p-4">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Loading sessions...
            </div>
          ) : (
            <SessionCalendar
              ref={calendarRef}
              events={events}
              onEventClick={handleEventClick}
              onDateSelect={handleDateSelect}
              onDateClick={handleDateClick}
              onEventDrop={handleEventDrop}
            />
          )}
        </div>
      ) : viewMode === 'year' ? (
        <div>
          {loadingSessions ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Loading sessions...
            </div>
          ) : (
            <SchoolYearView sessions={filteredSessions} onDayClick={handleDayClickFromScroll} onEventClick={handleEventClick} />
          )}
        </div>
      ) : (
        <div>
          {loadingSessions ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Loading sessions...
            </div>
          ) : (
            <SchoolYearWeekView sessions={filteredSessions} onDayClick={handleDayClickFromScroll} onEventClick={handleEventClick} />
          )}
        </div>
      )}
      </div>

      {/* Publish Confirmation Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowPublishDialog(false)}
          />
          <div className="relative rounded-lg border border-border bg-card p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold">Publish Schedule</h2>
            <p className="text-sm text-muted-foreground">
              Publish all draft sessions and notify instructors?
              This will update <span className="font-medium text-foreground">{stats.draft}</span> draft
              {stats.draft === 1 ? ' session' : ' sessions'} to published and send email
              notifications to all assigned instructors.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Tooltip text="Cancel and return to dashboard">
                <button
                  onClick={() => setShowPublishDialog(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip text="Confirm publishing and send email notifications">
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Publish &amp; Notify
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Day Detail Modal */}
      {selectedDate && (() => {
        const daySessions = filteredSessions.filter((s) => s.date === selectedDate);
        const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });
        const formatTime12 = (t: string) => {
          const [h, m] = t.split(':');
          const hour = parseInt(h, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${ampm}`;
        };
        const statusBadge = (status: string) => {
          const classes: Record<string, string> = {
            draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
            published: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
            completed: 'bg-green-500/20 text-green-400 border-green-500/30',
          };
          return (
            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status] ?? classes.draft}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          );
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedDate(null)} />
            <div className="relative rounded-lg border border-border bg-card p-6 shadow-xl max-w-lg w-full mx-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{dateLabel}</h2>
                <Tooltip text="Close day detail view">
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
              {daySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No sessions scheduled for this day.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {daySessions.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {formatTime12(s.start_time)} &ndash; {formatTime12(s.end_time)}
                        </span>
                        {statusBadge(s.status)}
                      </div>
                      <p className="text-sm text-foreground">{s.grade_groups?.join(', ') || 'No grades'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{s.instructor ? `${s.instructor.first_name} ${s.instructor.last_name}` : 'Unassigned'}</span>
                        {s.venue && <span>&middot; {s.venue.name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Floating Today Button */}
      <Tooltip text="Jump to today's date in the calendar" position="top">
        <button
          onClick={handleGoToToday}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Today
        </button>
      </Tooltip>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-20 right-6 z-50 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg transition-all duration-300 ease-in-out"
          style={{ opacity: toastVisible ? 1 : 0, transform: toastVisible ? 'translateY(0)' : 'translateY(8px)' }}
        >
          {toastMessage}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (() => {
        const s = selectedEvent;
        const formatTime12 = (t: string) => {
          const [h, m] = t.split(':');
          const hour = parseInt(h, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${ampm}`;
        };
        const statusConfig: Record<string, { label: string; classes: string }> = {
          draft: { label: 'Draft', classes: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
          published: { label: 'Published', classes: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
          canceled: { label: 'Canceled', classes: 'bg-red-500/20 text-red-400 border-red-500/30' },
          completed: { label: 'Completed', classes: 'bg-green-500/20 text-green-400 border-green-500/30' },
        };
        const badge = statusConfig[s.status] ?? statusConfig.draft;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedEvent(null)} />
            <div className="relative rounded-lg border border-border bg-card p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Session Details</h2>
                <Tooltip text="Close session details">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Event</p>
                  <p className="text-sm font-medium">{s.grade_groups?.join(', ') || 'No grades'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Instructor</p>
                  <p className="text-sm">{s.instructor ? `${s.instructor.first_name} ${s.instructor.last_name}` : 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Venue</p>
                  <p className="text-sm">{s.venue ? `${s.venue.name} — ${s.venue.space_type}` : 'No venue'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium mt-0.5 ${badge.classes}`}>
                    {badge.label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm">{formatTime12(s.start_time)} &ndash; {formatTime12(s.end_time)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
                {s.grade_groups && s.grade_groups.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Grade Groups</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {s.grade_groups.map((g) => (
                        <span key={g} className="inline-block rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Tags Section */}
                <div>
                  <p className="text-xs text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {s.tags && s.tags.length > 0 ? (
                      s.tags.map((tag) => (
                        <span
                          key={tag.id}
                          title={tag.description ?? undefined}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag.name}
                          <Tooltip text="Remove this tag from session">
                            <button
                              onClick={() => handleRemoveTagFromSession(s.id, tag.id)}
                              className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                              title="Remove tag"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </Tooltip>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No tags</span>
                    )}
                    {/* Add tag dropdown */}
                    <div className="relative">
                      <Tooltip text="Add a tag to this session">
                        <button
                          onClick={() => setShowTagDropdown((o) => !o)}
                          disabled={addingTagToSession}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                        >
                          + Add Tag
                        </button>
                      </Tooltip>
                      {showTagDropdown && (
                        <div className="absolute z-50 mt-1 left-0 w-48 max-h-48 overflow-auto rounded-lg border border-border bg-card shadow-lg">
                          {availableTags
                            .filter((t) => !(s.tags ?? []).some((st) => st.id === t.id))
                            .length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No more tags available</p>
                          ) : (
                            availableTags
                              .filter((t) => !(s.tags ?? []).some((st) => st.id === t.id))
                              .map((tag) => (
                                <Tooltip key={tag.id} text={`Apply "${tag.name}" tag to this session`}>
                                  <button
                                    onClick={() => handleAddTagToSession(s.id, tag.id)}
                                    title={tag.description ?? undefined}
                                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                                  >
                                    {tag.name}
                                  </button>
                                </Tooltip>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
