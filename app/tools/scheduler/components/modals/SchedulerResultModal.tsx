'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  LayoutTemplate,
  Sparkles,
  X,
  Wand2,
  Loader2,
  Check,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { showToast } from '../../lib/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateStats {
  template_id: string;
  day_of_week: number;
  grade_groups: string[];
  sessions_generated: number;
  sessions_unassigned: number;
  unassigned_reason?: string;
  required_skills?: string[];
}

interface SkippedDate {
  date: string;
  template_id: string;
  reason: string;
  detail?: string;
}

interface ScheduleWarning {
  templateId: string;
  templateName: string;
  type: string;
  message: string;
  details: { requested: number; created: number };
}

interface SchedulerResult {
  success: boolean;
  sessions_created: number;
  unassigned_count: number;
  sessions_with_warnings: number;
  drafts_cleared: number;
  template_stats: TemplateStats[];
  skipped_dates: SkippedDate[];
  summary: string;
  error?: string;
  unassigned_reasons?: Record<string, number>;
  schedule_warnings?: ScheduleWarning[];
}

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  skills: string[] | null;
  is_active: boolean;
}

interface UnassignedSession {
  id: string;
  date: string;
  template_id: string | null;
  instructor_id: string | null;
  grade_groups: string[];
  start_time: string;
  end_time: string;
}

interface SchedulerResultModalProps {
  open: boolean;
  onClose: () => void;
  result: SchedulerResult;
  /** When true, shows "Confirm" button to proceed with actual generation */
  isPreview?: boolean;
  onConfirm?: () => void;
  isConfirming?: boolean;
  /** Program ID for fetching sessions/instructors */
  programId?: string;
  /** Callback after assignments change so parent can refresh */
  onAssignmentsChanged?: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const REASON_LABELS: Record<string, string> = {
  no_school: 'No School',
  early_dismissal: 'Early Dismissal',
  blackout_rule: 'Blackout Rule',
  venue_unavailable: 'Venue Unavailable',
  venue_conflict: 'Venue Conflict',
  venue_at_capacity: 'Venue at Capacity',
  venue_blackout: 'Venue Blackout',
  no_instructor: 'No Staff',
  no_qualified_instructor: 'No Qualified Staff',
  week_cycle_skip: 'Week Cycle Skip',
};

// ---------------------------------------------------------------------------
// Auto-assign suggestion logic
// ---------------------------------------------------------------------------

function suggestInstructor(
  session: UnassignedSession,
  instructors: Instructor[],
  templateSkills: string[] | null,
  assignmentCounts: Map<string, number>,
): Instructor | null {
  let candidates = instructors.filter((i) => i.is_active);

  // Filter by required skills if the template specifies them
  if (templateSkills && templateSkills.length > 0) {
    candidates = candidates.filter((i) =>
      templateSkills.every((skill) => i.skills?.includes(skill)),
    );
  }

  if (candidates.length === 0) return null;

  // Pick the instructor with the fewest existing assignments (round-robin)
  candidates.sort(
    (a, b) => (assignmentCounts.get(a.id) ?? 0) - (assignmentCounts.get(b.id) ?? 0),
  );

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Helper: format date as "Week of Mon DD"
// ---------------------------------------------------------------------------

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

// ---------------------------------------------------------------------------
// SkippedDatesSection (unchanged)
// ---------------------------------------------------------------------------

function SkippedDatesSection({ skippedDates }: { skippedDates: SkippedDate[] }) {
  const [expanded, setExpanded] = useState(false);

  const byReason = new Map<string, SkippedDate[]>();
  for (const sd of skippedDates) {
    const group = byReason.get(sd.reason) ?? [];
    group.push(sd);
    byReason.set(sd.reason, group);
  }

  if (skippedDates.length === 0) return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded px-1 -mx-1 py-1 transition-colors cursor-pointer"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
        <span className="text-[12px] font-medium text-slate-700 flex-1">
          {skippedDates.length} date(s) skipped
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-700" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-700" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
          {Array.from(byReason.entries()).map(([reason, dates]) => (
            <div key={reason}>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                {REASON_LABELS[reason] ?? reason} ({dates.length})
              </p>
              <div className="space-y-0.5 ml-2">
                {dates.slice(0, 5).map((sd, i) => (
                  <p key={i} className="text-[11px] text-slate-600">
                    {sd.date}{sd.detail ? ` - ${sd.detail}` : ''}
                  </p>
                ))}
                {dates.length > 5 && (
                  <p className="text-[11px] text-slate-700 italic">
                    ...and {dates.length - 5} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UnassignedPanel — shown when user clicks an unassigned badge
// ---------------------------------------------------------------------------

function UnassignedPanel({
  templateStats,
  programId,
  onAssigned,
}: {
  templateStats: TemplateStats;
  programId: string;
  onAssigned: () => void;
}) {
  const [sessions, setSessions] = useState<UnassignedSession[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch unassigned sessions and instructors on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [sessRes, instrRes] = await Promise.all([
          fetch(
            `/api/sessions?template_id=${templateStats.template_id}&instructor_id=null&program_id=${programId}&status=draft`,
          ),
          fetch('/api/instructors?is_active=true'),
        ]);

        if (!sessRes.ok) throw new Error('Failed to fetch sessions');
        if (!instrRes.ok) throw new Error('Failed to fetch instructors');

        const sessData = await sessRes.json();
        const instrData = await instrRes.json();

        if (!cancelled) {
          setSessions(sessData.sessions ?? []);
          setInstructors(instrData.instructors ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [templateStats.template_id, programId]);

  const handleAssign = (sessionId: string, instructorId: string) => {
    setAssignments((prev) => {
      if (instructorId === '') {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      }
      return { ...prev, [sessionId]: instructorId };
    });
  };

  const handleAutoAssignOne = (session: UnassignedSession) => {
    const counts = new Map<string, number>();
    // Count existing assignments in our local state
    for (const iid of Object.values(assignments)) {
      counts.set(iid, (counts.get(iid) ?? 0) + 1);
    }
    const match = suggestInstructor(session, instructors, null, counts);
    if (match) {
      setAssignments((prev) => ({ ...prev, [session.id]: match.id }));
    } else {
      showToast('No matching staff found', 'info');
    }
  };

  const handleAutoAssignAll = () => {
    const counts = new Map<string, number>();
    const newAssignments = { ...assignments };
    let assigned = 0;

    for (const session of sessions) {
      if (newAssignments[session.id]) {
        counts.set(newAssignments[session.id], (counts.get(newAssignments[session.id]) ?? 0) + 1);
      }
    }

    for (const session of sessions) {
      if (newAssignments[session.id]) continue;
      const match = suggestInstructor(session, instructors, null, counts);
      if (match) {
        newAssignments[session.id] = match.id;
        counts.set(match.id, (counts.get(match.id) ?? 0) + 1);
        assigned++;
      }
    }

    setAssignments(newAssignments);
    if (assigned > 0) {
      showToast(`Auto-assigned ${assigned} session${assigned !== 1 ? 's' : ''}`);
    } else {
      showToast('No sessions could be auto-assigned', 'info');
    }
  };

  const handleSave = async () => {
    const toSave = Object.entries(assignments).filter(([id]) => !savedIds.has(id));
    if (toSave.length === 0) {
      showToast('No new assignments to save', 'info');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sessions/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: toSave.map(([id, instructor_id]) => ({ id, instructor_id })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save assignments');
      }

      const data = await res.json();
      const newSaved = new Set(savedIds);
      for (const [id] of toSave) newSaved.add(id);
      setSavedIds(newSaved);

      showToast(`${data.updated} session${data.updated !== 1 ? 's' : ''} assigned`);
      if (data.failed > 0) {
        showToast(`${data.failed} assignment${data.failed !== 1 ? 's' : ''} failed`, 'error');
      }
      onAssigned();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = Object.keys(assignments).filter((id) => !savedIds.has(id)).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 px-3">
        <Loader2 className="w-3.5 h-3.5 text-amber-800 animate-spin" />
        <span className="text-[11px] text-slate-600">Loading unassigned sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-2 px-3">
        <p className="text-[11px] text-red-700">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-2 px-3">
        <p className="text-[11px] text-slate-600">No unassigned sessions found.</p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-lg mx-3 mb-1 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 bg-amber-100/60 border-b border-amber-200">
        <span className="text-[11px] font-semibold text-amber-800">
          Unassigned Sessions for {DAY_NAMES[templateStats.day_of_week]} &mdash;{' '}
          {templateStats.grade_groups.length > 0
            ? templateStats.grade_groups.join(', ')
            : 'All grades'}
        </span>
        <button
          onClick={handleAutoAssignAll}
          disabled={saving || instructors.length === 0}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-800 bg-amber-200/60 rounded hover:bg-amber-200 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Wand2 className="w-3 h-3" />
          Auto-assign All
        </button>
      </div>

      {/* Session rows */}
      <div className="max-h-[180px] overflow-y-auto divide-y divide-amber-100">
        {sessions.map((session) => {
          const isSaved = savedIds.has(session.id);
          return (
            <div
              key={session.id}
              className="flex items-center gap-2 px-3 py-1.5"
            >
              {isSaved ? (
                <Check className="w-3 h-3 text-emerald-700 shrink-0" />
              ) : (
                <div className="w-3 h-3 shrink-0" />
              )}
              <span className="text-[11px] text-slate-600 w-16 shrink-0 tabular-nums">
                {formatWeekLabel(session.date)}
              </span>
              <select
                value={assignments[session.id] ?? ''}
                onChange={(e) => handleAssign(session.id, e.target.value)}
                disabled={saving}
                className="flex-1 text-[11px] text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 min-w-0 disabled:opacity-50"
              >
                <option value="">Select Instructor...</option>
                {instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.first_name} {inst.last_name}
                    {inst.skills && inst.skills.length > 0
                      ? ` (${inst.skills.join(', ')})`
                      : ''}
                  </option>
                ))}
                <option value="" disabled>
                  ──────────
                </option>
                <option value="">Leave Unassigned</option>
              </select>
              <button
                onClick={() => handleAutoAssignOne(session)}
                disabled={saving || instructors.length === 0}
                title="Auto-assign"
                aria-label="Auto-assign instructor"
                className="p-0.5 text-amber-800 hover:bg-amber-100 rounded transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Wand2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Panel footer */}
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-amber-200 bg-amber-50/60">
        {pendingCount > 0 && (
          <span className="text-[10px] text-amber-800 mr-auto">
            {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || pendingCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-white bg-amber-600 rounded hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Assignments'
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function SchedulerResultModal({
  open,
  onClose,
  result,
  isPreview = false,
  onConfirm,
  isConfirming = false,
  programId,
  onAssignmentsChanged,
}: SchedulerResultModalProps) {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [autoAssigningAll, setAutoAssigningAll] = useState(false);

  if (!open) return null;

  const headerIcon = isPreview ? (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
      <Sparkles className="w-5 h-5 text-blue-500" />
    </div>
  ) : result.success ? (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50">
      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
    </div>
  ) : (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
      <XCircle className="w-5 h-5 text-red-700" />
    </div>
  );

  const title = isPreview
    ? 'Schedule Preview'
    : result.success
      ? 'Schedule Generated'
      : 'Generation Failed';

  const subtitle = isPreview
    ? 'Review what will be created before confirming'
    : result.success
      ? `${result.sessions_created} session${result.sessions_created !== 1 ? 's' : ''} created`
      : result.error ?? 'An error occurred';

  const templateKey = (ts: TemplateStats) => `${ts.template_id}-${ts.day_of_week}`;

  const handleAutoAssignAll = async () => {
    if (!programId) return;
    setAutoAssigningAll(true);
    try {
      // Fetch all unassigned draft sessions for this program
      const [sessRes, instrRes] = await Promise.all([
        fetch(`/api/sessions?program_id=${programId}&instructor_id=null&status=draft`),
        fetch('/api/instructors?is_active=true'),
      ]);

      if (!sessRes.ok || !instrRes.ok) throw new Error('Failed to fetch data');

      const { sessions } = await sessRes.json() as { sessions: UnassignedSession[] };
      const { instructors } = await instrRes.json() as { instructors: Instructor[] };

      if (sessions.length === 0) {
        showToast('No unassigned sessions found', 'info');
        return;
      }

      // Build assignments using round-robin suggestion
      const counts = new Map<string, number>();
      const assignmentList: { id: string; instructor_id: string }[] = [];

      for (const session of sessions) {
        const match = suggestInstructor(session, instructors, null, counts);
        if (match) {
          assignmentList.push({ id: session.id, instructor_id: match.id });
          counts.set(match.id, (counts.get(match.id) ?? 0) + 1);
        }
      }

      if (assignmentList.length === 0) {
        showToast('No staff available for auto-assignment', 'info');
        return;
      }

      const res = await fetch('/api/sessions/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assignmentList }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save assignments');
      }

      const data = await res.json();
      showToast(
        `Auto-assigned ${data.updated} of ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`,
      );
      if (data.failed > 0) {
        showToast(`${data.failed} assignment${data.failed !== 1 ? 's' : ''} failed`, 'error');
      }
      onAssignmentsChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Auto-assign failed', 'error');
    } finally {
      setAutoAssigningAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-[70] w-[540px] max-h-[85vh] bg-white rounded-2xl shadow-[0_8px_32px_#00000033] overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer z-10"
          aria-label="Close modal"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
          {headerIcon}
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            <p className="text-[12px] text-slate-600">{subtitle}</p>
          </div>
          {/* Global Auto-assign All */}
          {result.unassigned_count > 0 && isPreview && programId && (
            <button
              onClick={handleAutoAssignAll}
              disabled={autoAssigningAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {autoAssigningAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  Auto-assign All
                </>
              )}
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Calendar className="w-4 h-4 text-blue-500" />}
              label={isPreview ? 'Will Create' : 'Created'}
              value={result.sessions_created}
            />
            <StatCard
              icon={<Users className="w-4 h-4 text-amber-800" />}
              label="Unassigned"
              value={result.unassigned_count}
              warn={result.unassigned_count > 0}
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4 text-slate-700" />}
              label="Warnings"
              value={result.sessions_with_warnings}
              warn={result.sessions_with_warnings > 0}
            />
          </div>

          {/* Drafts cleared info */}
          {result.drafts_cleared > 0 && !isPreview && (
            <p className="text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              Cleared {result.drafts_cleared} previous draft{result.drafts_cleared !== 1 ? 's' : ''} before regeneration.
            </p>
          )}

          {/* Template breakdown */}
          {result.template_stats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutTemplate className="w-3.5 h-3.5 text-slate-700" />
                <span className="text-[12px] font-semibold text-slate-600">
                  Template Breakdown
                </span>
              </div>
              <div className="space-y-1">
                {result.template_stats.map((ts) => {
                  const key = templateKey(ts);
                  const isExpanded = expandedTemplate === key;
                  const canExpand = ts.sessions_unassigned > 0 && isPreview && !!programId;

                  const hasIssue = ts.sessions_unassigned > 0;

                  return (
                    <div key={key}>
                      <div className={`rounded-lg px-3 py-2 ${hasIssue ? 'bg-amber-50/60 border border-amber-200' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-medium text-slate-600 w-8 shrink-0">
                              {DAY_NAMES[ts.day_of_week]}
                            </span>
                            <span className="text-[12px] text-slate-700 truncate">
                              {ts.grade_groups.length > 0
                                ? ts.grade_groups.join(', ')
                                : 'All grades'}
                            </span>
                            {ts.required_skills && ts.required_skills.length > 0 && (
                              <span className="text-[10px] text-slate-700 truncate">
                                ({ts.required_skills.join(', ')})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[12px] font-medium text-slate-900 tabular-nums">
                              {ts.sessions_generated}
                            </span>
                            {hasIssue && (
                              canExpand ? (
                                <button
                                  onClick={() =>
                                    setExpandedTemplate(isExpanded ? null : key)
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                >
                                  {ts.sessions_unassigned} unassigned
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-[11px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                  {ts.sessions_unassigned} unassigned
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        {/* Inline reason for unassigned */}
                        {hasIssue && ts.unassigned_reason && (
                          <p className="text-[10px] text-amber-800 mt-1 ml-10 leading-relaxed">
                            ⚠ {ts.unassigned_reason}
                          </p>
                        )}
                      </div>

                      {/* Expandable assignment panel */}
                      {isExpanded && programId && (
                        <div className="mt-1">
                          <UnassignedPanel
                            templateStats={ts}
                            programId={programId}
                            onAssigned={() => onAssignmentsChanged?.()}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unassigned reasons */}
          {result.unassigned_count > 0 && result.unassigned_reasons && Object.keys(result.unassigned_reasons).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
                <span className="text-[12px] font-semibold text-amber-800">
                  Why {result.unassigned_count} session{result.unassigned_count !== 1 ? 's are' : ' is'} unassigned
                </span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(result.unassigned_reasons)
                  .sort(([, a], [, b]) => b - a)
                  .map(([reason, count]) => (
                    <div key={reason} className="flex items-start gap-2">
                      <span className="text-[11px] font-medium text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 tabular-nums shrink-0">
                        {count}×
                      </span>
                      <span className="text-[11px] text-amber-900 leading-relaxed">
                        {reason}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Schedule warnings (scheduling mode constraints) */}
          {result.schedule_warnings && result.schedule_warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
                <span className="text-[12px] font-semibold text-amber-800">
                  Scheduling Warnings
                </span>
              </div>
              <div className="space-y-2">
                {result.schedule_warnings.map((w, i) => (
                  <div key={i} className="text-[11px] text-amber-800 bg-yellow-100/50 rounded px-2.5 py-2">
                    <div className="font-medium">{w.templateName}</div>
                    <div className="mt-0.5 leading-relaxed">{w.message}</div>
                    <div className="mt-1 text-amber-800 text-[10px]">
                      Created {w.details.created} of {w.details.requested} requested
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped dates */}
          <SkippedDatesSection skippedDates={result.skipped_dates} />

          {/* Error message */}
          {result.error && !result.success && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-[12px] text-red-700">{result.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
          {isPreview && onConfirm ? (
            <>
              <button
                onClick={onClose}
                disabled={isConfirming}
                className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isConfirming ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Confirm & Generate
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${
      warn ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-slate-600">{label}</span>
      </div>
      <p className={`text-[18px] font-semibold tabular-nums ${
        warn ? 'text-amber-800' : 'text-slate-900'
      }`}>
        {value}
      </p>
    </div>
  );
}
