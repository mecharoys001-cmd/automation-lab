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
  Trash2,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { InstructorEditModal } from '../modals/InstructorEditModal';
import type { InstructorFormData } from '../modals/InstructorEditModal';
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
  onDelete?: (eventId: string, mode: 'single' | 'future') => void | Promise<void>;
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

export function EventEditPanel({ event, open, onClose, onSave, onDelete }: EventEditPanelProps) {
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
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<'single' | 'future' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dropdown data
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Add new instructor via modal
  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [savingNewInstructor, setSavingNewInstructor] = useState(false);

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

  const handleAddInstructor = async (data: InstructorFormData) => {
    setSavingNewInstructor(true);
    try {
      const body: Record<string, unknown> = {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim() || null,
        phone: data.phone.trim() || null,
        notes: data.notes.trim() || null,
        is_active: data.is_active,
        skills: data.skills.length > 0 ? data.skills : null,
        availability_json: data.availability_json,
      };
      const res = await fetch('/api/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to add instructor');
      const { instructor } = await res.json();

      // Add to local instructors list
      setInstructors((prev) => [...prev, instructor]);

      // Auto-select the new instructor
      setEditInstructor(`${instructor.first_name} ${instructor.last_name}`);

      setShowInstructorModal(false);
    } catch (err) {
      console.error('Failed to add instructor:', err);
      alert('Failed to add instructor. Please try again.');
    } finally {
      setSavingNewInstructor(false);
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

  const handleDeleteClick = async (mode: 'single' | 'future') => {
    if (deleteConfirm !== mode) {
      setDeleteConfirm(mode);
      return;
    }
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(event.id, mode);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
      setShowDeleteMenu(false);
    }
  };

  // Count qualified instructors (those not currently assigned, filtered by subject)
  const qualifiedCount = Math.max(0, subjectFilteredInstructors.length - 1);

  if (!open) return null;

  /* Shared field styles per Screen 18 spec */
  const inputCls =
    'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
  const selectCls = `${inputCls} appearance-none cursor-pointer pr-9 disabled:opacity-50`;
  const labelCls = 'block text-xs font-medium text-[#64748B] mb-1.5';

  const panel = createPortal(
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

          {/* ---- Section 4: Staff ---- */}
          <div className="py-4">
            <Tooltip text="The staff member assigned to lead this session">
              <label className={labelCls}>Staff</label>
            </Tooltip>
            <Tooltip text="Choose the session staff member">
              <div className="relative">
                <select
                  value={editInstructor}
                  onChange={(e) => setEditInstructor(e.target.value)}
                  disabled={loadingInstructors}
                  className={selectCls}
                  aria-label="Staff"
                >
                  <option value="">
                    {loadingInstructors ? 'Loading staff...' : '— Select staff member —'}
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
              <Tooltip text="Only staff whose subjects match the session's required subjects are shown">
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                  Filtered by subject: {event.subjects.join(', ')} — {qualifiedCount} other qualified staff member{qualifiedCount !== 1 ? 's' : ''}
                </p>
              </Tooltip>
            )}
            {(!event.subjects || event.subjects.length === 0) && qualifiedCount > 0 && (
              <Tooltip text="Other staff who are qualified and available for this class type">
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                  {qualifiedCount} other qualified staff available
                </p>
              </Tooltip>
            )}

            {/* Add New Staff Member Button */}
            <Tooltip text="Add new staff to the system">
              <button
                onClick={() => setShowInstructorModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Staff Member
              </button>
            </Tooltip>
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
        {/* Panel Footer — Delete left, Cancel + Save right                 */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-4 py-4 border-t border-[#E2E8F0] shrink-0">
          {/* Delete section — left side */}
          {onDelete ? (
            <div className="relative">
              <Tooltip text="Delete this session">
                <button
                  onClick={() => {
                    setShowDeleteMenu(!showDeleteMenu);
                    setDeleteConfirm(null);
                  }}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete
                </button>
              </Tooltip>

              {showDeleteMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-56 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-10 overflow-hidden">
                  <button
                    onClick={() => handleDeleteClick('single')}
                    disabled={isDeleting}
                    className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deleteConfirm === 'single' ? 'Are you sure?' : 'Cancel This Session'}
                  </button>
                  {event.templateId && (
                    <button
                      onClick={() => handleDeleteClick('future')}
                      disabled={isDeleting}
                      className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-[#E2E8F0] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deleteConfirm === 'future' ? 'Are you sure?' : 'Cancel All Future Sessions'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* Save/Cancel — right side */}
          <div className="flex items-center gap-3">
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
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {panel}
      {showInstructorModal && (
        <InstructorEditModal
          instructor={null}
          saving={savingNewInstructor}
          deleting={false}
          onSave={handleAddInstructor}
          onDelete={null}
          onClose={() => setShowInstructorModal(false)}
        />
      )}
    </>
  );
}
