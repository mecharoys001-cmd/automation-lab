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
  Save,
  ChevronDown,
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

interface VenueOption {
  id: string;
  name: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string | null;
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

/** Data shape emitted by the Save callback */
export interface EventEditData {
  title: string;
  venue: string;
  date: string;
  time: string;
  endTime: string;
  tags: string[];
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
  /** Callback when user saves edited event fields */
  onSave?: (eventId: string, data: EventEditData) => void;
  /** Callback when user cancels the event */
  onCancel?: (eventId: string) => void;
  /** Callback when user wants to replace instructor */
  onReplaceInstructor?: (eventId: string, substituteId?: string) => void;
  /** Callback when user wants to replace entire event */
  onReplaceEvent?: (eventId: string, templateId?: string) => void;
  /** Open full event details */
  onViewDetails?: (event: CalendarEvent) => void;
  /** Open the side edit panel for this event */
  onOpenEditPanel?: (event: CalendarEvent) => void;
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
  onSave,
  onCancel,
  onReplaceInstructor,
  onReplaceEvent,
  onViewDetails,
  onOpenEditPanel,
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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editVenue, setEditVenue] = useState(event.venue ?? '');
  const [editDate, setEditDate] = useState(event.date);
  const [editTime, setEditTime] = useState(event.time);
  const [editEndTime, setEditEndTime] = useState(event.endTime ?? '');
  const [editTags, setEditTags] = useState<string[]>(event.tags ?? []);
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown data
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

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
  }, [computePosition, pinned, showCancelConfirm, showReplaceOptions, showSubstitutes, showTemplates, isEditingNotes, isEditing, showTagDropdown]);

  useEffect(() => {
    if (placed && !animatedIn) {
      requestAnimationFrame(() => setAnimatedIn(true));
    }
  }, [placed, animatedIn]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          resetEditFields();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, isEditing]);

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

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!showTagDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTagDropdown]);

  // -------------------------------------------------------------------------
  // Edit helpers
  // -------------------------------------------------------------------------

  function resetEditFields() {
    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditDate(event.date);
    setEditTime(event.time);
    setEditEndTime(event.endTime ?? '');
    setEditTags(event.tags ?? []);
  }

  const enterEditMode = async () => {
    setIsEditing(true);
    resetEditFields();

    // Fetch venues & tags concurrently
    setLoadingVenues(true);
    setLoadingTags(true);

    try {
      const [venuesRes, tagsRes] = await Promise.all([
        fetch('/api/venues'),
        fetch('/api/tags'),
      ]);
      const venuesData = await venuesRes.json();
      const tagsData = await tagsRes.json();
      setVenues(venuesData.venues ?? []);
      setAllTags(tagsData.tags ?? []);
    } catch {
      setVenues([]);
      setAllTags([]);
    } finally {
      setLoadingVenues(false);
      setLoadingTags(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(event.id, {
        title: editTitle.trim(),
        venue: editVenue,
        date: editDate,
        time: editTime,
        endTime: editEndTime,
        tags: editTags,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tagName: string) => {
    setEditTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName],
    );
  };

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

        {isEditing ? (
          <Tooltip text="Edit session name">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 min-w-0 text-[13px] font-bold text-slate-900 bg-white/80 border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              aria-label="Session name"
            />
          </Tooltip>
        ) : (
          <h3 className="text-[13px] font-bold text-slate-900 flex-1 truncate">
            {event.title}
          </h3>
        )}

        {/* Edit – opens side panel instead of inline editing */}
        {pinned && !isEditing && !inCancelFlow && onOpenEditPanel && (
          <Tooltip text="Edit session details">
            <button
              onClick={() => { onOpenEditPanel(event); onClose(); }}
              className="p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
              aria-label="Edit session"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </Tooltip>
        )}
        {/* Inline edit toggle – kept for reference, currently wired to side panel above
        {pinned && !isEditing && !inCancelFlow && (
          <Tooltip text="Edit event details">
            <button
              onClick={enterEditMode}
              className="p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
              aria-label="Edit event"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </Tooltip>
        )}
        */}

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
        {event.subtitle && !isEditing && (
          <p className="text-[11px] text-slate-500">{event.subtitle}</p>
        )}

        {/* ---- EDIT MODE ---- */}
        {isEditing ? (
          <div className="space-y-3">
            {/* Date & Time */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Tooltip text="Session date and time">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Tooltip>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Date &amp; Time
                </span>
              </div>
              <div className="flex gap-2">
                <Tooltip text="Session date">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="flex-1 text-[12px] text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                    aria-label="Session date"
                  />
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Tooltip text="Start time">
                  <input
                    type="time"
                    value={to24h(editTime)}
                    onChange={(e) => setEditTime(from24h(e.target.value))}
                    className="flex-1 text-[12px] text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                    aria-label="Start time"
                  />
                </Tooltip>
                <span className="text-[12px] text-slate-400 self-center">&ndash;</span>
                <Tooltip text="End time">
                  <input
                    type="time"
                    value={to24h(editEndTime)}
                    onChange={(e) => setEditEndTime(from24h(e.target.value))}
                    className="flex-1 text-[12px] text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
                    aria-label="End time"
                  />
                </Tooltip>
              </div>
            </div>

            {/* Venue dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Tooltip text="Session venue">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Tooltip>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Venue
                </span>
              </div>
              <Tooltip text="Select a venue">
                <div className="relative">
                  <select
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    disabled={loadingVenues}
                    className="w-full text-[12px] text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white appearance-none cursor-pointer disabled:opacity-50"
                    aria-label="Venue"
                  >
                    <option value="">
                      {loadingVenues ? 'Loading venues...' : '— Select venue —'}
                    </option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Tooltip>
            </div>

            {/* Tags multi-select */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Tooltip text="Session tags">
                  <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Tooltip>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Tags
                </span>
              </div>

              {/* Selected tags */}
              {editTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {editTags.map((tag) => (
                    <Tooltip key={tag} text={`Remove tag "${tag}"`}>
                      <button
                        onClick={() => toggleTag(tag)}
                        className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-2xl px-2.5 py-0.5 text-[11px] font-medium hover:bg-blue-200 transition-colors cursor-pointer"
                        aria-label={`Remove tag ${tag}`}
                      >
                        {tag}
                        <X className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}

              {/* Tag picker dropdown */}
              <div ref={tagDropdownRef} className="relative">
                <Tooltip text="Add or remove tags">
                  <button
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    disabled={loadingTags}
                    className="w-full flex items-center justify-between text-[12px] text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    aria-label="Toggle tag picker"
                  >
                    <span>{loadingTags ? 'Loading tags...' : 'Select tags...'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </Tooltip>

                {showTagDropdown && allTags.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-[140px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {allTags.map((tag) => {
                      const selected = editTags.includes(tag.name);
                      return (
                        <Tooltip key={tag.id} text={selected ? `Remove "${tag.name}"` : `Add "${tag.name}"`} position="right">
                          <button
                            onClick={() => toggleTag(tag.name)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors cursor-pointer ${
                              selected
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                            aria-label={selected ? `Remove tag ${tag.name}` : `Add tag ${tag.name}`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                selected
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-300'
                              }`}
                            >
                              {selected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            {tag.color && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                            )}
                            <span className="truncate">{tag.name}</span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Save / Cancel edit buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !editTitle.trim()}
                icon={isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                className="flex-1"
                tooltip="Save session changes"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setIsEditing(false); resetEditFields(); }}
                className="flex-1"
                tooltip="Discard changes"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* ---- VIEW MODE ---- */
          <>
            {/* Time */}
            <div className="flex items-center gap-2">
              <Tooltip text="Session time">
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
              <Tooltip text="Instructor">
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
        )}

        {/* Notes Section (pinned only, view mode only) */}
        {pinned && !isEditing && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Notes
                </span>
              </div>
              {!isEditingNotes && (
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

            {isEditingNotes ? (
              <div className="space-y-2">
                <Tooltip text="Type session notes here">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add notes about this session..."
                    className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-white"
                    rows={3}
                    autoFocus
                    aria-label="Session notes"
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
                <p className="text-[12px] font-semibold text-amber-900">Are you sure you want to cancel this session?</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  You can choose to replace the instructor or the entire event afterward.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={handleConfirmCancel} className="flex-1" tooltip="Confirm cancellation">
                Yes, Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowCancelConfirm(false)} className="flex-1" tooltip="Keep the session">
                No, Keep It
              </Button>
            </div>
          </div>
        )}

        {/* Replace Options */}
        {showReplaceOptions && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <p className="text-[12px] font-semibold text-slate-700">Replace instructor or session?</p>
            <div className="space-y-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowSubstitutes}
                icon={<UserX className="w-3.5 h-3.5" />}
                className="w-full justify-start"
                tooltip="Find a substitute instructor"
              >
                Replace Instructor Only
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowTemplates}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="w-full justify-start"
                tooltip="Replace with a different session"
              >
                Replace Entire Session
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleFinalCancel}
                className="w-full"
                tooltip="Cancel without replacement"
              >
                Just Cancel (No Replacement)
              </Button>
            </div>

            {/* Similar event suggestions */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.5px]">
                  Similar sessions (different instructor)
                </span>
              </div>
              {loadingSimilar ? (
                <div className="flex items-center justify-center py-3 gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-[11px] text-slate-400">Finding similar sessions...</span>
                </div>
              ) : similarEvents.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1">No similar sessions found.</p>
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
              <p className="text-[12px] font-semibold text-slate-700">Select Substitute Instructor</p>
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
                <span className="text-[12px] text-slate-500">Finding available instructors...</span>
              </div>
            ) : substitutes.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-center">
                <p className="text-[12px] text-slate-500">No substitute instructors available.</p>
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
              <p className="text-[12px] font-semibold text-slate-700">Select Replacement Session</p>
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
      {!inCancelFlow && !isEditing && (
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

/** Convert "9:00 AM" / "2:30 PM" to "09:00" / "14:30" for <input type="time"> */
function to24h(time12: string): string {
  if (!time12) return '';
  // Already in 24h format (HH:MM)?
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

/** Convert "14:30" to "2:30 PM" for display */
function from24h(time24: string): string {
  if (!time24) return '';
  const [hStr, m] = time24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

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
