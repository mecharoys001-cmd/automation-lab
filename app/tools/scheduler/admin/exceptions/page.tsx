'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProgram } from '../ProgramContext';
import Tooltip from '../../components/Tooltip';
import type { Tag } from '@/types/database';

interface FlaggedSession {
  id: string;
  program_id: string;
  template_id: string | null;
  instructor_id: string | null;
  venue_id: string | null;
  grade_groups: string[];
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  is_makeup: boolean;
  replaces_session_id: string | null;
  needs_resolution: boolean;
  notes: string | null;
  instructor?: { id: string; first_name: string; last_name: string } | null;
  venue?: { id: string; name: string; space_type: string } | null;
  tags?: Tag[];
}

interface SubstituteCandidate {
  id: string;
  first_name: string;
  last_name: string;
  skills: string[] | null;
}

type ResolutionType = 'substitute' | 'cancel' | 'cancel_reschedule' | null;

export default function ExceptionsPage() {
  const { selectedProgramId } = useProgram();
  const [flaggedSessions, setFlaggedSessions] = useState<FlaggedSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedSession, setSelectedSession] = useState<FlaggedSession | null>(null);
  const [modalAction, setModalAction] = useState<ResolutionType>(null);
  const [substitutes, setSubstitutes] = useState<SubstituteCandidate[]>([]);
  const [selectedSubstitute, setSelectedSubstitute] = useState('');
  const [makeupDate, setMakeupDate] = useState('');
  const [resolving, setResolving] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'cancel' | ''>('');
  const [bulkResolving, setBulkResolving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchFlagged = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({ program_id: selectedProgramId });
      const res = await fetch(`/api/exceptions/flagged?${params}`);
      const data = await res.json();

      if (data.success) {
        setFlaggedSessions(data.sessions);
      }
    } catch {
      // Silently handle fetch error
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  // Fetch eligible substitute instructors for a session
  const fetchSubstitutes = async (session: FlaggedSession) => {
    try {
      const params = new URLSearchParams({ session_id: session.id });
      const res = await fetch(`/api/exceptions/substitute-candidates?${params}`);
      const data = await res.json();

      if (data.success) {
        setSubstitutes(data.candidates);
      } else {
        setSubstitutes([]);
      }
    } catch {
      setSubstitutes([]);
    }
  };

  const openSubstituteModal = async (session: FlaggedSession) => {
    setSelectedSession(session);
    setModalAction('substitute');
    setSelectedSubstitute('');
    setMakeupDate('');
    await fetchSubstitutes(session);
  };

  const openCancelModal = (session: FlaggedSession) => {
    setSelectedSession(session);
    setModalAction('cancel');
  };

  const openRescheduleModal = (session: FlaggedSession) => {
    setSelectedSession(session);
    setModalAction('cancel_reschedule');
    setMakeupDate('');
  };

  const closeModal = () => {
    setSelectedSession(null);
    setModalAction(null);
    setSelectedSubstitute('');
    setMakeupDate('');
    setSubstitutes([]);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleResolve = async () => {
    if (!selectedSession || !modalAction) return;
    setResolving(true);

    try {
      const payload: Record<string, string> = {
        session_id: selectedSession.id,
        resolution_type: modalAction,
      };
      if (modalAction === 'substitute') {
        payload.instructor_id = selectedSubstitute;
      }
      if (modalAction === 'cancel_reschedule') {
        payload.makeup_date = makeupDate;
      }

      const res = await fetch('/api/exceptions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        showToast(result.summary, 'success');
        closeModal();
        fetchFlagged();
      } else {
        showToast(result.error ?? 'Resolution failed', 'error');
      }
    } catch {
      showToast('Network error resolving session', 'error');
    } finally {
      setResolving(false);
    }
  };

  // Bulk actions
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === flaggedSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(flaggedSessions.map((s) => s.id)));
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0 || !bulkAction) return;
    setBulkResolving(true);

    let successCount = 0;
    let failCount = 0;

    for (const sessionId of selectedIds) {
      try {
        const res = await fetch('/api/exceptions/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            resolution_type: bulkAction,
          }),
        });
        const result = await res.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      showToast(
        `Resolved ${successCount} session${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        failCount > 0 ? 'error' : 'success'
      );
    } else {
      showToast('All resolutions failed', 'error');
    }

    setSelectedIds(new Set());
    setBulkAction('');
    fetchFlagged();
    setBulkResolving(false);
  };

  // Derive a "reason" for each flagged session from its notes or context
  const getSessionReason = (session: FlaggedSession): string => {
    if (session.notes) {
      return session.notes;
    }
    if (!session.instructor_id) {
      return 'No instructor assigned';
    }
    return 'Calendar exception';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Exception Resolution</h1>
        <p className="text-muted-foreground mt-1">
          Sessions flagged by calendar exceptions. Assign a substitute, cancel, or reschedule.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <Tooltip text="Total sessions with unresolved exceptions" position="bottom">
            <p className="text-xs text-muted-foreground">Needs Resolution</p>
          </Tooltip>
          <p className="text-2xl font-semibold mt-1 text-red-400">
            {loading ? '—' : flaggedSessions.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <Tooltip text="Date of the oldest unresolved exception" position="bottom">
            <p className="text-xs text-muted-foreground">Earliest Flagged</p>
          </Tooltip>
          <p className="text-2xl font-semibold mt-1 text-foreground">
            {loading || flaggedSessions.length === 0
              ? '—'
              : flaggedSessions[0].date}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <Tooltip text="Number of distinct dates with exceptions" position="bottom">
            <p className="text-xs text-muted-foreground">Unique Dates</p>
          </Tooltip>
          <p className="text-2xl font-semibold mt-1 text-foreground">
            {loading
              ? '—'
              : new Set(flaggedSessions.map((s) => s.date)).size}
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      {flaggedSessions.length > 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Tooltip text="Choose an action to apply to all selected sessions" position="bottom">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as 'cancel' | '')}
                disabled={selectedIds.size === 0}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Bulk action...</option>
                <option value="cancel">Cancel All Selected</option>
              </select>
            </Tooltip>
            <Tooltip text="Apply bulk action to selected sessions" position="bottom">
              <button
                onClick={handleBulkResolve}
                disabled={selectedIds.size === 0 || !bulkAction || bulkResolving}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkResolving ? 'Processing...' : 'Apply'}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Flagged Sessions Table */}
      {loading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          Loading flagged sessions...
        </div>
      ) : flaggedSessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          No sessions need resolution. All clear!
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10">
                    <Tooltip text="Select all sessions" position="bottom">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === flaggedSessions.length && flaggedSessions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                      />
                    </Tooltip>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Instructor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Venue</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Grades</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedSessions.map((session) => {
                  const inst = session.instructor;
                  const venue = session.venue;
                  return (
                    <tr
                      key={session.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        selectedIds.has(session.id) ? 'bg-muted/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Tooltip text="Select this session for bulk action">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(session.id)}
                            onChange={() => toggleSelection(session.id)}
                            className="rounded border-border"
                          />
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <Tooltip text="Unresolved exception">
                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          </Tooltip>
                          {session.date}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3">
                        {inst
                          ? `${inst.first_name} ${inst.last_name}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {venue ? venue.name : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {session.grade_groups.map((g) => (
                            <span
                              key={g}
                              className="inline-block rounded bg-muted px-2 py-0.5 text-xs"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground italic">
                          {getSessionReason(session)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Tooltip text="Assign a substitute instructor">
                            <button
                              onClick={() => openSubstituteModal(session)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              Substitute
                            </button>
                          </Tooltip>
                          <Tooltip text="Cancel this session">
                            <button
                              onClick={() => openCancelModal(session)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-muted transition-colors"
                            >
                              Cancel
                            </button>
                          </Tooltip>
                          <Tooltip text="Cancel and reschedule to a new date">
                            <button
                              onClick={() => openRescheduleModal(session)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                            >
                              Reschedule
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {modalAction && selectedSession && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {modalAction === 'substitute' && 'Assign Substitute'}
                {modalAction === 'cancel' && 'Cancel Session'}
                {modalAction === 'cancel_reschedule' && 'Cancel & Reschedule'}
              </h2>
              <Tooltip text="Close without saving">
                <button
                  onClick={closeModal}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </Tooltip>
            </div>

            {/* Session Info */}
            <div className="rounded-lg bg-muted/50 p-3 mb-4 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Date:</span>{' '}
                {selectedSession.date}
              </p>
              <p>
                <span className="text-muted-foreground">Time:</span>{' '}
                {selectedSession.start_time.slice(0, 5)} – {selectedSession.end_time.slice(0, 5)}
              </p>
              <p>
                <span className="text-muted-foreground">Instructor:</span>{' '}
                {selectedSession.instructor
                  ? `${selectedSession.instructor.first_name} ${selectedSession.instructor.last_name}`
                  : 'Unassigned'}
              </p>
              <p>
                <span className="text-muted-foreground">Grades:</span>{' '}
                {selectedSession.grade_groups.join(', ')}
              </p>
            </div>

            {/* Substitute picker */}
            {modalAction === 'substitute' && (
              <div className="mb-4">
                <Tooltip text="Only instructors available on this date with matching skills" position="bottom">
                  <label className="block text-sm font-medium mb-2">
                    Select Substitute Instructor
                  </label>
                </Tooltip>
                <p className="text-xs text-muted-foreground mb-2">
                  Filtered by matching skills, availability, and no double-booking.
                </p>
                {substitutes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No eligible substitutes found.
                  </p>
                ) : (
                  <Tooltip text="Select a substitute instructor for this session" position="bottom">
                    <select
                      value={selectedSubstitute}
                      onChange={(e) => setSelectedSubstitute(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Choose an instructor...</option>
                      {substitutes.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.first_name} {sub.last_name}
                          {sub.skills && sub.skills.length > 0
                            ? ` (${sub.skills.join(', ')})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </Tooltip>
                )}
              </div>
            )}

            {/* Cancel confirmation */}
            {modalAction === 'cancel' && (
              <p className="text-sm text-muted-foreground mb-4">
                This will cancel the session. It will remain in the schedule with a
                &quot;canceled&quot; status for record-keeping.
              </p>
            )}

            {/* Reschedule with makeup date picker */}
            {modalAction === 'cancel_reschedule' && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-3">
                  This will cancel the session and create a draft makeup session on the
                  selected date with a link back to the original.
                </p>
                <Tooltip text="Date for the replacement makeup session" position="bottom">
                  <label className="block text-sm font-medium mb-2">
                    Makeup Date
                  </label>
                </Tooltip>
                <Tooltip text="Pick the date for the rescheduled makeup session" position="bottom">
                  <input
                    type="date"
                    value={makeupDate}
                    onChange={(e) => setMakeupDate(e.target.value)}
                    min={selectedSession.date}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Tooltip text="Return without changes">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                >
                  Back
                </button>
              </Tooltip>
              <Tooltip text={
                modalAction === 'substitute'
                  ? 'Confirm substitute assignment'
                  : modalAction === 'cancel'
                  ? 'Permanently cancel this session'
                  : 'Cancel session and create makeup'
              }>
                <button
                  onClick={handleResolve}
                  disabled={
                    resolving ||
                    (modalAction === 'substitute' && !selectedSubstitute) ||
                    (modalAction === 'cancel_reschedule' && !makeupDate)
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    modalAction === 'cancel'
                      ? 'bg-red-600 hover:bg-red-700'
                      : modalAction === 'cancel_reschedule'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {resolving
                    ? 'Processing...'
                    : modalAction === 'substitute'
                    ? 'Assign Substitute'
                    : modalAction === 'cancel'
                    ? 'Confirm Cancel'
                    : 'Cancel & Reschedule'}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
