'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Tag,
  X,
  AlertCircle,
  UserX,
  RefreshCw,
  Pin,
  PinOff,
  StickyNote,
  GraduationCap,
  Loader2,
  Check,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../ui/Pill';
import { Tooltip } from '../ui/Tooltip';
import type { CalendarEvent, EventType } from './types';
import { EVENT_COLORS, EVENT_TYPE_LABELS } from './types';
import { getSubjectColor } from '../../lib/subjectColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubstituteCandidate {
  id: string;
  first_name: string;
  last_name: string;
  skills: string[];
}

interface TemplateEvent {
  id: string;
  name: string;
  type: string;
  duration_minutes: number;
  instructor_name?: string;
}

/** Similar event suggestion (same type, different instructor) */
interface SimilarEvent {
  id: string;
  title: string;
  instructor: string;
  time: string;
  date: string;
  venue?: string;
}

export interface EventPopoverProps {
  event: CalendarEvent;
  /** Anchor element rect for positioning */
  anchorRect: DOMRect;
  /** Whether the popover is pinned (clicked to stay open) */
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
  /** Callback when user saves notes */
  onEditNotes?: (eventId: string, notes: string) => void;
  /** Callback when user cancels the event */
  onCancel?: (eventId: string) => void;
  /** Callback when user wants to replace instructor */
  onReplaceInstructor?: (eventId: string, substituteId?: string) => void;
  /** Callback when user wants to replace entire event */
  onReplaceEvent?: (eventId: string, templateId?: string) => void;
  /** Open full event details */
  onViewDetails?: (event: CalendarEvent) => void;
  /** Open the edit modal for this event */
  onOpenEditPanel?: (event: CalendarEvent) => void;
  /** Callback when user cancels all future sessions */
  onCancelFuture?: (eventId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventPopover({
  event,
  anchorRect,
  pinned,
  onPin,
  onClose,
  onEditNotes,
  onCancel,
  onReplaceInstructor,
  onReplaceEvent,
  onViewDetails,
  onOpenEditPanel,
  onCancelFuture,
}: EventPopoverProps) {
  // Cancel / replace flow
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReplaceOptions, setShowReplaceOptions] = useState(false);
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [substitutes, setSubstitutes] = useState<SubstituteCandidate[]>([]);
  const [templates, setTemplates] = useState<TemplateEvent[]>([]);
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState(event.notes ?? '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Similar event suggestions (for replace flow)
  const [similarEvents, setSimilarEvents] = useState<SimilarEvent[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Positioning
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placed, setPlaced] = useState(false);
  const [animatedIn, setAnimatedIn] = useState(false);

  const subjectColor = event.subjects?.[0] ? getSubjectColor(event.subjects[0]) : null;
  const colors = subjectColor
    ? { accent: subjectColor.accent, bg: subjectColor.eventBg, text: subjectColor.eventText }
    : EVENT_COLORS[event.type] ?? { accent: '#64748B', bg: '#F8FAFC', text: '#334155' };

  // -------------------------------------------------------------------------
  // Positioning
  // -------------------------------------------------------------------------

  const computePosition = useCallback(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const pr = popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 8;

    let left = anchorRect.right + GAP;
    if (left + pr.width > vw - 12) {
      left = anchorRect.left - pr.width - GAP;
    }
    left = Math.max(12, Math.min(left, vw - pr.width - 12));

    let top = anchorRect.top;
    if (top + pr.height > vh - 12) {
      top = vh - pr.height - 12;
    }
    top = Math.max(12, top);

    setCoords({ top, left });
    setPlaced(true);
  }, [anchorRect]);

  useEffect(() => {
    setPlaced(false);
    requestAnimationFrame(computePosition);
  }, [computePosition, pinned, showCancelConfirm, showReplaceOptions, showSubstitutes, showTemplates, isEditingNotes]);

  useEffect(() => {
    if (placed && !animatedIn) {
      requestAnimationFrame(() => setAnimatedIn(true));
    }
  }, [placed, animatedIn]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on click outside when pinned
  useEffect(() => {
    if (!pinned) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [pinned, onClose]);

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------

  const handleSaveNotes = () => {
    onEditNotes?.(event.id, noteText);
    setIsEditingNotes(false);
  };

  // -------------------------------------------------------------------------
  // Cancel / Replace flow
  // -------------------------------------------------------------------------

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    setShowReplaceOptions(true);
    // Also fetch similar events for suggestions
    fetchSimilarEvents();
  };

  const fetchSimilarEvents = async () => {
    setLoadingSimilar(true);
    try {
      const res = await fetch(
        `/api/sessions?exclude_id=${event.id}&exclude_status=canceled`,
      );
      const data = await res.json();
      const sessions = data.sessions ?? [];
      // Filter to same event type but different instructor
      const similar = sessions
        .filter(
          (s: { instructor?: { first_name: string; last_name: string } | null; status?: string }) => {
            const instrName = s.instructor
              ? `${s.instructor.first_name} ${s.instructor.last_name}`
              : '';
            return instrName !== event.instructor;
          },
        )
        .slice(0, 5)
        .map(
          (s: {
            id: string;
            date: string;
            start_time: string;
            instructor?: { first_name: string; last_name: string } | null;
            venue?: { name: string } | null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
          }) => ({
            id: s.id,
            title: s.name ?? s.template_name ?? event.title,
            instructor: s.instructor
              ? `${s.instructor.first_name} ${s.instructor.last_name}`
              : 'TBD',
            time: s.start_time
              ? formatTime(s.start_time)
              : '',
            date: s.date,
            venue: s.venue?.name,
          }),
        );
      setSimilarEvents(similar);
    } catch {
      setSimilarEvents([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleShowSubstitutes = async () => {
    setShowReplaceOptions(false);
    setShowSubstitutes(true);
    setLoadingSubstitutes(true);
    try {
      const res = await fetch(`/api/exceptions/substitute-candidates?session_id=${event.id}`);
      const data = await res.json();
      setSubstitutes(data.candidates ?? []);
    } catch {
      setSubstitutes([]);
    } finally {
      setLoadingSubstitutes(false);
    }
  };

  const handleSelectSubstitute = (candidateId: string) => {
    onReplaceInstructor?.(event.id, candidateId);
    setShowSubstitutes(false);
    onClose();
  };

  const handleShowTemplates = async () => {
    setShowReplaceOptions(false);
    setShowTemplates(true);
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/templates?type=${event.type}`);
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    onReplaceEvent?.(event.id, templateId);
    setShowTemplates(false);
    onClose();
  };

  const handleFinalCancel = () => {
    onCancel?.(event.id);
    setShowReplaceOptions(false);
    onClose();
  };

  const handleBackToReplaceOptions = () => {
    setShowSubstitutes(false);
    setShowTemplates(false);
    setShowReplaceOptions(true);
  };

  const inCancelFlow = showCancelConfirm || showReplaceOptions || showSubstitutes || showTemplates;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return createPortal(
    <div
      ref={popoverRef}
      className="w-[340px] max-h-[calc(100vh-24px)] overflow-y-auto bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-slate-200"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 50000,
        opacity: animatedIn ? 1 : 0,
        transform: animatedIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(4px)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-t-xl"
        style={{ backgroundColor: colors.bg, borderBottom: `2px solid ${colors.accent}` }}
      >
        <Tooltip text={EVENT_TYPE_LABELS[event.type]}>
          <Calendar className="w-4 h-4 shrink-0" style={{ color: colors.accent }} />
        </Tooltip>

        <h3 className="text-[13px] font-bold text-slate-900 flex-1 truncate">
          {event.title}
        </h3>

        {/* Edit – opens modal */}
        {pinned && !inCancelFlow && onOpenEditPanel && (
          <Tooltip text="Edit class details">
            <button
              onClick={() => { onOpenEditPanel(event); onClose(); }}
              className="p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
              aria-label="Edit class"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </Tooltip>
        )}

        {/* Pin/unpin toggle */}
        <Tooltip text={pinned ? 'Unpin popover' : 'Pin popover open'}>
          <button
            onClick={(e) => { e.stopPropagation(); pinned ? onClose() : onPin(); }}
            className="p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
            aria-label={pinned ? 'Unpin popover' : 'Pin popover'}
          >
            {pinned ? (
              <PinOff className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Pin className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </Tooltip>

        <Tooltip text="Close popover">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
            aria-label="Close popover"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </Tooltip>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Body                                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Subtitle */}
        {event.subtitle && (
          <p className="text-[11px] text-slate-500">{event.subtitle}</p>
        )}

        {/* ---- VIEW MODE ---- */}
        <>
            {/* Time */}
            <div className="flex items-center gap-2">
              <Tooltip text="Class time">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Tooltip>
              <div>
                <span className="text-[12px] font-medium text-slate-700">
                  {event.date}
                </span>
                <span className="text-[12px] text-slate-500 ml-2">
                  {event.time}{event.endTime ? ` \u2013 ${event.endTime}` : ''}
                </span>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-2">
              <Tooltip text="Staff member">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Tooltip>
              <span className="text-[12px] font-medium text-slate-700">
                {event.instructor}
              </span>
            </div>

            {/* Venue */}
            {event.venue && (
              <div className="flex items-center gap-2">
                <Tooltip text="Venue">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Tooltip>
                <span className="text-[12px] text-slate-700">{event.venue}</span>
              </div>
            )}

            {/* Grade Level */}
            {event.gradeLevel && (
              <div className="flex items-center gap-2">
                <Tooltip text="Grade level">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Tooltip>
                <span className="text-[12px] text-slate-700">{event.gradeLevel}</span>
              </div>
            )}

            {/* Duration */}
            {event.durationMinutes != null && (
              <div className="flex items-center gap-2">
                <Tooltip text="Duration">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Tooltip>
                <span className="text-[12px] text-slate-700">
                  {event.durationMinutes >= 60
                    ? `${Math.floor(event.durationMinutes / 60)}h${event.durationMinutes % 60 ? ` ${event.durationMinutes % 60}m` : ''}`
                    : `${event.durationMinutes}m`}
                </span>
              </div>
            )}

            {/* Subjects / Skills */}
            {event.subjects && event.subjects.length > 0 && (
              <div className="flex items-start gap-2">
                <Tooltip text="Subjects / Skills">
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                </Tooltip>
                <div className="flex flex-wrap gap-1">
                  {event.subjects.map((subj) => (
                    <Pill key={subj} variant="tag" tooltip={subj}>
                      {subj}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            {/* Type badge + status */}
            <div className="flex items-center gap-2">
              <Tooltip text={`Type: ${EVENT_TYPE_LABELS[event.type]}`}>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.accent}33` }}
                >
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
              </Tooltip>
              {event.status && (
                <Tooltip text={`Status: ${event.status}`}>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    event.status === 'published' ? 'bg-green-100 text-green-700' :
                    event.status === 'canceled' ? 'bg-red-100 text-red-600' :
                    event.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </Tooltip>
              )}
            </div>

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="flex items-start gap-2">
                <Tooltip text="Tags">
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                </Tooltip>
                <div className="flex flex-wrap gap-1">
                  {event.tags.map((tag) => (
                    <Pill key={tag} variant="tag" tooltip={tag}>
                      {tag}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
        </>

        {/* Notes Section (always visible; edit controls pinned-only) */}
        {(noteText || pinned) && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Notes
                </span>
              </div>
              {pinned && !isEditingNotes && (
                <Tooltip text="Edit notes">
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="text-[11px] text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
                    aria-label={noteText ? 'Edit notes' : 'Add notes'}
                  >
                    {noteText ? 'Edit' : 'Add'}
                  </button>
                </Tooltip>
              )}
            </div>

            {pinned && isEditingNotes ? (
              <div className="space-y-2">
                <Tooltip text="Type class notes here">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add notes about this class..."
                    className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-white"
                    rows={3}
                    autoFocus
                    aria-label="Class notes"
                  />
                </Tooltip>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleSaveNotes} className="flex-1" tooltip="Save notes">
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setNoteText(event.notes ?? ''); setIsEditingNotes(false); }}
                    className="flex-1"
                    tooltip="Discard changes"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 min-h-[48px]">
                <p className="text-[12px] text-slate-500 whitespace-pre-wrap">
                  {noteText || 'No notes added.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cancel Confirmation */}
        {showCancelConfirm && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-amber-900">Are you sure you want to cancel this class?</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  You can choose to replace the staff or the entire event afterward.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={handleConfirmCancel} className="flex-1" tooltip="Confirm cancellation">
                Yes, Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowCancelConfirm(false)} className="flex-1" tooltip="Keep the class">
                No, Keep It
              </Button>
            </div>
          </div>
        )}

        {/* Replace Options */}
        {showReplaceOptions && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <p className="text-[12px] font-semibold text-slate-700">Replace staff or class?</p>
            <div className="space-y-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowSubstitutes}
                icon={<UserX className="w-3.5 h-3.5" />}
                className="w-full justify-start"
                tooltip="Find a substitute staff member"
              >
                Replace Staff Only
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowTemplates}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="w-full justify-start"
                tooltip="Replace with a different class"
              >
                Replace Entire Class
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleFinalCancel}
                className="w-full"
                tooltip="Cancel this session without replacement"
              >
                Just Cancel This Session
              </Button>
              {event.templateId && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onCancelFuture?.(event.id);
                    setShowReplaceOptions(false);
                    onClose();
                  }}
                  className="w-full"
                  tooltip="Cancel this and all future sessions with the same template"
                >
                  Cancel All Future Sessions
                </Button>
              )}
            </div>

            {/* Similar event suggestions */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Similar classes (different staff)
                </span>
              </div>
              {loadingSimilar ? (
                <div className="flex items-center justify-center py-3 gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-[11px] text-slate-400">Finding similar classes...</span>
                </div>
              ) : similarEvents.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1">No similar classes found.</p>
              ) : (
                <div className="space-y-1">
                  {similarEvents.map((se) => (
                    <Tooltip key={se.id} text={`${se.instructor} \u2013 ${se.date} ${se.time}${se.venue ? ` at ${se.venue}` : ''}`}>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50/60 border border-amber-100 text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-700 truncate">{se.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {se.instructor} &middot; {se.date} {se.time}
                            {se.venue ? ` \u00b7 ${se.venue}` : ''}
                          </p>
                        </div>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Substitute Instructor List */}
        {showSubstitutes && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-slate-700">Select Substitute Staff</p>
              <Tooltip text="Back to options">
                <button
                  onClick={handleBackToReplaceOptions}
                  className="text-[11px] text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
                  aria-label="Back to replace options"
                >
                  Back
                </button>
              </Tooltip>
            </div>
            {loadingSubstitutes ? (
              <div className="flex items-center justify-center py-4 gap-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-[12px] text-slate-500">Finding available staff...</span>
              </div>
            ) : substitutes.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-center">
                <p className="text-[12px] text-slate-500">No substitute staff available.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {substitutes.map((candidate) => (
                  <Tooltip key={candidate.id} text={`Select ${candidate.first_name} ${candidate.last_name}`}>
                    <button
                      onClick={() => handleSelectSubstitute(candidate.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer group text-left"
                      aria-label={`Select substitute ${candidate.first_name} ${candidate.last_name}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-slate-800 truncate">
                          {candidate.first_name} {candidate.last_name}
                        </p>
                        {candidate.skills.length > 0 && (
                          <p className="text-[10px] text-slate-400 truncate">
                            {candidate.skills.join(', ')}
                          </p>
                        )}
                      </div>
                      <Check className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Template Event List */}
        {showTemplates && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-slate-700">Select Replacement Class</p>
              <Tooltip text="Back to options">
                <button
                  onClick={handleBackToReplaceOptions}
                  className="text-[11px] text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
                  aria-label="Back to replace options"
                >
                  Back
                </button>
              </Tooltip>
            </div>
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-4 gap-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-[12px] text-slate-500">Finding available events...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-center">
                <p className="text-[12px] text-slate-500">No replacement sessions available.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {templates.map((tmpl) => (
                  <Tooltip key={tmpl.id} text={`Select "${tmpl.name}"`}>
                    <button
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer group text-left"
                      aria-label={`Select replacement ${tmpl.name}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-slate-800 truncate">
                          {tmpl.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {tmpl.duration_minutes} min
                          {tmpl.instructor_name ? ` \u00b7 ${tmpl.instructor_name}` : ''}
                        </p>
                      </div>
                      <Check className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Footer Actions (when not in cancel flow and not editing)           */}
      {/* ----------------------------------------------------------------- */}
      {!inCancelFlow && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
          <Tooltip text="Cancel this session">
            <button
              onClick={handleCancelClick}
              className="text-[11px] font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              aria-label="Cancel session"
            >
              Cancel Session
            </button>
          </Tooltip>
          <div className="flex-1" />
          {!pinned && (
            <Tooltip text="Click to pin and add notes">
              <button
                onClick={(e) => { e.stopPropagation(); onPin(); }}
                className="text-[11px] font-medium text-slate-400 hover:text-blue-500 hover:bg-blue-50 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
                aria-label="Pin popover"
              >
                Pin
              </button>
            </Tooltip>
          )}
          <Tooltip text="Open full session details">
            <button
              onClick={(e) => { e.stopPropagation(); onViewDetails?.(event); }}
              className="text-[11px] font-medium text-blue-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
              aria-label="View session details"
            >
              View Details
            </button>
          </Tooltip>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Time-conversion helpers
// ---------------------------------------------------------------------------

/** Format HH:MM:SS to "h:mm AM/PM" */
function formatTime(time: string): string {
  const parts = time.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}
