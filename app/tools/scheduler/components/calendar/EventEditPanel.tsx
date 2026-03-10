'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Clock,
  ChevronDown,
  X,
  Plus,
  Loader2,
  Check,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { skillsMatch } from '@/lib/scheduler/utils';
import type { CalendarEvent } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VenueOption {
  id: string;
  name: string;
}

interface InstructorOption {
  id: string;
  first_name: string;
  last_name: string;
  skills: string[] | null;
}

interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

/** Data shape emitted by the Save callback */
export interface EventEditPanelData {
  title: string;
  venue: string;
  instructor: string;
  date: string;
  time: string;
  endTime: string;
  tags: string[];
  notes: string;
}

export interface EventEditPanelProps {
  event: CalendarEvent;
  open: boolean;
  onClose: () => void;
  onSave?: (eventId: string, data: EventEditPanelData) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Time helpers
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

function from24h(time24: string): string {
  if (!time24) return '';
  const [hStr, m] = time24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventEditPanel({ event, open, onClose, onSave }: EventEditPanelProps) {
  // Form state
  const [editTitle, setEditTitle] = useState(event.title);
  const [editVenue, setEditVenue] = useState(event.venue ?? '');
  const [editInstructor, setEditInstructor] = useState(event.instructor);
  const [editDate, setEditDate] = useState(event.date);
  const [editTime, setEditTime] = useState(event.time);
  const [editEndTime, setEditEndTime] = useState(event.endTime ?? '');
  const [editTags, setEditTags] = useState<string[]>(event.tags ?? []);
  const [editNotes, setEditNotes] = useState(event.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown data
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Add new instructor inline
  const [showAddInstructor, setShowAddInstructor] = useState(false);
  const [newInstructorFirst, setNewInstructorFirst] = useState('');
  const [newInstructorLast, setNewInstructorLast] = useState('');
  const [addingInstructor, setAddingInstructor] = useState(false);

  // Animation
  const [visible, setVisible] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Reset form when event changes
  useEffect(() => {
    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditInstructor(event.instructor);
    setEditDate(event.date);
    setEditTime(event.time);
    setEditEndTime(event.endTime ?? '');
    setEditTags(event.tags ?? []);
    setEditNotes(event.notes ?? '');
  }, [event]);

  // Animate in/out
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [open]);

  // Fetch dropdown data on open
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoadingVenues(true);
      setLoadingInstructors(true);
      setLoadingTags(true);

      try {
        const [venuesRes, instructorsRes, tagsRes] = await Promise.allSettled([
          fetch('/api/venues'),
          fetch('/api/instructors'),
          fetch('/api/tags'),
        ]);

        if (venuesRes.status === 'fulfilled' && venuesRes.value.ok) {
          const data = await venuesRes.value.json();
          setVenues(data.venues ?? []);
        }
        if (instructorsRes.status === 'fulfilled' && instructorsRes.value.ok) {
          const data = await instructorsRes.value.json();
          setInstructors(data.instructors ?? []);
        }
        if (tagsRes.status === 'fulfilled' && tagsRes.value.ok) {
          const data = await tagsRes.value.json();
          setAllTags(data.tags ?? []);
        }
      } finally {
        setLoadingVenues(false);
        setLoadingInstructors(false);
        setLoadingTags(false);
      }
    };

    fetchData();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

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

  // Filter instructors by subject match (event.subjects comes from template.required_skills)
  const subjectFilteredInstructors = useMemo(() => {
    const subjects = event.subjects;
    if (!subjects || subjects.length === 0) return instructors;
    return instructors.filter((inst) => skillsMatch(inst.skills, subjects));
  }, [instructors, event.subjects]);

  const toggleTag = useCallback((tagName: string) => {
    setEditTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName],
    );
  }, []);

  const handleAddInstructor = async () => {
    if (!newInstructorFirst.trim() || !newInstructorLast.trim()) return;
    setAddingInstructor(true);
    try {
      const res = await fetch('/api/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newInstructorFirst.trim(),
          last_name: newInstructorLast.trim(),
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to add instructor');
      const { instructor } = await res.json();
      
      // Add to local instructors list
      setInstructors((prev) => [...prev, instructor]);
      
      // Auto-select the new instructor
      setEditInstructor(`${instructor.first_name} ${instructor.last_name}`);
      
      // Reset form
      setNewInstructorFirst('');
      setNewInstructorLast('');
      setShowAddInstructor(false);
    } catch (err) {
      console.error('Failed to add instructor:', err);
      alert('Failed to add instructor. Please try again.');
    } finally {
      setAddingInstructor(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(event.id, {
        title: editTitle.trim(),
        venue: editVenue,
        instructor: editInstructor,
        date: editDate,
        time: editTime,
        endTime: editEndTime,
        tags: editTags,
        notes: editNotes,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditInstructor(event.instructor);
    setEditDate(event.date);
    setEditTime(event.time);
    setEditEndTime(event.endTime ?? '');
    setEditTags(event.tags ?? []);
    setEditNotes(event.notes ?? '');
    onClose();
  };

  // Count qualified instructors (those not currently assigned, filtered by subject)
  const qualifiedCount = Math.max(0, subjectFilteredInstructors.length - 1);

  if (!open) return null;

  /* Shared field styles per Screen 18 spec */
  const inputCls =
    'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
  const selectCls = `${inputCls} appearance-none cursor-pointer pr-9 disabled:opacity-50`;
  const labelCls = 'block text-xs font-medium text-[#64748B] mb-1.5';

  return createPortal(
    <div
      className="fixed inset-0 z-[50000] flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Dim Overlay — Screen 18 spec: #00000020 */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.125)',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Side Panel — 520px, slide from right */}
      <div
        ref={panelRef}
        className="relative w-full max-w-[520px] h-full bg-white flex flex-col transition-transform duration-300 ease-out"
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.08)',
        }}
        role="dialog"
        aria-label="Edit event"
      >
        {/* ================================================================= */}
        {/* Panel Header — Screen 18: "Edit Event" 18px 700 + Close 32x32    */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="text-lg font-bold text-[#0F172A]">
            Edit Event
          </h2>
          <Tooltip text="Close panel (Esc)">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* ================================================================= */}
        {/* Panel Body — scrollable, divider-separated sections               */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto px-4">

          {/* ---- Section 1: Event Name ---- */}
          <div className="py-4">
            <Tooltip text="The name displayed on the calendar">
              <label className={labelCls}>Event Name</label>
            </Tooltip>
            <Tooltip text="Enter the event or session name">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Grade 3 Brass"
                className={inputCls}
                aria-label="Event name"
              />
            </Tooltip>
          </div>

          <div className="h-px bg-[#F1F5F9]" />

          {/* ---- Section 2: Date & Time ---- */}
          <div className="py-4 space-y-3">
            <div>
              <Tooltip text="The date this event takes place">
                <label className={labelCls}>Date</label>
              </Tooltip>
              <Tooltip text="Pick the date for this session">
                <div className="relative">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                    aria-label="Session date"
                  />
                  <Calendar className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Tooltip>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Tooltip text="When the session begins">
                  <label className={labelCls}>Start Time</label>
                </Tooltip>
                <Tooltip text="Set the start time">
                  <div className="relative">
                    <input
                      type="time"
                      value={to24h(editTime)}
                      onChange={(e) => setEditTime(from24h(e.target.value))}
                      className={`${inputCls} cursor-pointer`}
                      aria-label="Start time"
                    />
                    <Clock className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </Tooltip>
              </div>
              <div>
                <Tooltip text="When the session ends">
                  <label className={labelCls}>End Time</label>
                </Tooltip>
                <Tooltip text="Set the end time">
                  <div className="relative">
                    <input
                      type="time"
                      value={to24h(editEndTime)}
                      onChange={(e) => setEditEndTime(from24h(e.target.value))}
                      className={`${inputCls} cursor-pointer`}
                      aria-label="End time"
                    />
                    <Clock className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#F1F5F9]" />

          {/* ---- Section 3: Venue ---- */}
          <div className="py-4">
            <Tooltip text="Select the room or facility for this session">
              <label className={labelCls}>Venue</label>
            </Tooltip>
            <Tooltip text="Choose where this session will be held">
              <div className="relative">
                <select
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  disabled={loadingVenues}
                  className={selectCls}
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
                <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Tooltip>
          </div>

          <div className="h-px bg-[#F1F5F9]" />

          {/* ---- Section 4: Instructor ---- */}
          <div className="py-4">
            <Tooltip text="The staff member assigned to lead this session">
              <label className={labelCls}>Instructor</label>
            </Tooltip>
            <Tooltip text="Choose the session staff member">
              <div className="relative">
                <select
                  value={editInstructor}
                  onChange={(e) => setEditInstructor(e.target.value)}
                  disabled={loadingInstructors}
                  className={selectCls}
                  aria-label="Instructor"
                >
                  <option value="">
                    {loadingInstructors ? 'Loading instructors...' : '— Select instructor —'}
                  </option>
                  {event.instructor && !subjectFilteredInstructors.some((i) => `${i.first_name} ${i.last_name}` === event.instructor) && (
                    <option value={event.instructor}>{event.instructor}</option>
                  )}
                  {subjectFilteredInstructors.map((i) => {
                    const fullName = `${i.first_name} ${i.last_name}`;
                    return (
                      <option key={i.id} value={fullName}>
                        {fullName}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Tooltip>
            {event.subjects && event.subjects.length > 0 && subjectFilteredInstructors.length === 0 && !loadingInstructors && (
              <Tooltip text="No staff members have the required skills. Add staff with these subjects on the Staff & Venues page.">
                <p className="text-[11px] text-red-500 mt-1.5">
                  No staff teach {event.subjects.join(', ')}. Add staff with this subject on the Staff & Venues page.
                </p>
              </Tooltip>
            )}
            {event.subjects && event.subjects.length > 0 && subjectFilteredInstructors.length > 0 && (
              <Tooltip text="Only instructors whose skills match the session's required subjects are shown">
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                  Filtered by subject: {event.subjects.join(', ')} — {qualifiedCount} other qualified instructor{qualifiedCount !== 1 ? 's' : ''}
                </p>
              </Tooltip>
            )}
            {(!event.subjects || event.subjects.length === 0) && qualifiedCount > 0 && (
              <Tooltip text="Other instructors who are qualified and available for this session type">
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                  {qualifiedCount} other qualified instructor{qualifiedCount !== 1 ? 's' : ''} available
                </p>
              </Tooltip>
            )}

            {/* Add New Staff Member Button/Form */}
            {!showAddInstructor ? (
              <Tooltip text="Add a new instructor to the system">
                <button
                  onClick={() => setShowAddInstructor(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Staff Member
                </button>
              </Tooltip>
            ) : (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-slate-700">New Instructor</span>
                  <Tooltip text="Cancel adding instructor">
                    <button
                      onClick={() => {
                        setShowAddInstructor(false);
                        setNewInstructorFirst('');
                        setNewInstructorLast('');
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
                <div className="space-y-2">
                  <Tooltip text="Enter the instructor's first name">
                    <input
                      type="text"
                      placeholder="First name"
                      value={newInstructorFirst}
                      onChange={(e) => setNewInstructorFirst(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      disabled={addingInstructor}
                    />
                  </Tooltip>
                  <Tooltip text="Enter the instructor's last name">
                    <input
                      type="text"
                      placeholder="Last name"
                      value={newInstructorLast}
                      onChange={(e) => setNewInstructorLast(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      disabled={addingInstructor}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newInstructorFirst.trim() && newInstructorLast.trim()) {
                          handleAddInstructor();
                        }
                      }}
                    />
                  </Tooltip>
                  <Tooltip text="Create this instructor">
                    <button
                      onClick={handleAddInstructor}
                      disabled={addingInstructor || !newInstructorFirst.trim() || !newInstructorLast.trim()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors"
                    >
                      {addingInstructor ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Add Instructor
                        </>
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#F1F5F9]" />

          {/* ---- Section 5: Tags ---- */}
          <div className="py-4">
            <Tooltip text="Categorize and label this session">
              <label className={labelCls}>Tags</label>
            </Tooltip>

            <div className="flex flex-wrap items-center gap-2">
              {editTags.map((tag) => (
                <Tooltip key={tag} text={`Remove tag "${tag}"`}>
                  <button
                    onClick={() => toggleTag(tag)}
                    className="inline-flex items-center gap-1.5 bg-[#DBEAFE] text-[#3B82F6] rounded-full px-2.5 py-1 text-xs font-medium hover:bg-blue-200 transition-colors cursor-pointer"
                    aria-label={`Remove tag ${tag}`}
                  >
                    {tag}
                    <X className="w-3 h-3" />
                  </button>
                </Tooltip>
              ))}

              <div ref={tagDropdownRef} className="relative">
                <Tooltip text="Add a tag to this session">
                  <button
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    disabled={loadingTags}
                    className="inline-flex items-center gap-1 border border-[#E2E8F0] text-[#64748B] rounded-full px-2.5 py-1 text-xs font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
                    aria-label="Add tag"
                  >
                    <Plus className="w-3 h-3" />
                    {loadingTags ? 'Loading...' : 'Add Tag'}
                  </button>
                </Tooltip>

                {showTagDropdown && allTags.length > 0 && (
                  <div className="absolute z-10 mt-1 left-0 w-56 max-h-[200px] overflow-y-auto bg-white border border-[#E2E8F0] rounded-lg shadow-lg">
                    {allTags.map((tag) => {
                      const selected = editTags.includes(tag.name);
                      return (
                        <Tooltip key={tag.id} text={selected ? `Remove "${tag.name}"` : `Add "${tag.name}"`} position="right">
                          <button
                            onClick={() => toggleTag(tag.name)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                              selected
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                            aria-label={selected ? `Remove tag ${tag.name}` : `Add tag ${tag.name}`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                selected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                              }`}
                            >
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {tag.color && (
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
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
          </div>

          <div className="h-px bg-[#F1F5F9]" />

          {/* ---- Section 6: Notes ---- */}
          <div className="pt-4 pb-4">
            <Tooltip text="Additional notes or instructions for this session">
              <label className={labelCls}>Notes</label>
            </Tooltip>
            <Tooltip text="Type any notes about this session">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes..."
                className={`${inputCls} resize-none`}
                style={{ height: '80px' }}
                aria-label="Session notes"
              />
            </Tooltip>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Panel Footer — right-aligned Cancel + Save Changes               */}
        {/* ================================================================= */}
        <div className="flex items-center justify-end gap-3 px-4 py-4 border-t border-[#E2E8F0] shrink-0">
          <Tooltip text="Discard changes and close the panel">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </Tooltip>
          <Tooltip text="Save session changes">
            <button
              onClick={handleSave}
              disabled={isSaving || !editTitle.trim()}
              className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}
