'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  skills: string[] | null;
}

interface Venue {
  id: string;
  name: string;
  space_type: string;
}

interface Tag {
  id: string;
  name: string;
  category?: string | null;
}

interface CreateTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  /** Pre-filled date in YYYY-MM-DD format (for the session) */
  initialDate?: string;
  /** Pre-filled time in "9:00 AM" display format (for the session) */
  initialTime?: string;
  /** Pre-filled venue ID from the clicked slot */
  initialVenueId?: string;
  programId: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADE_OPTIONS = [
  'Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "9:00 AM" → "09:00" */
function displayTimeTo24h(time12: string): string {
  if (!time12) return '09:00';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '09:00';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateTemplateModal({
  open,
  onClose,
  onCreated,
  initialDate,
  initialTime,
  initialVenueId,
  programId,
}: CreateTemplateModalProps) {
  // Template fields
  const [name, setName] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [instructorId, setInstructorId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [gradeGroups, setGradeGroups] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [additionalTags, setAdditionalTags] = useState<string[]>([]);

  // Session fields (pre-filled from slot click)
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
      setRequiredSkills([]);
      setInstructorId('');
      setVenueId(initialVenueId ?? '');
      setGradeGroups([]);
      setDurationMinutes(45);
      setAdditionalTags([]);
      setDate(initialDate ?? '');
      setStartTime(initialTime ? displayTimeTo24h(initialTime) : '09:00');
      setSaving(false);
      setError(null);
    }
  }, [open, initialDate, initialTime, initialVenueId]);

  // Fetch reference data on mount
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      const [instrRes, venueRes, tagRes] = await Promise.all([
        fetch('/api/instructors?is_active=true'),
        fetch('/api/venues'),
        fetch('/api/tags'),
      ]);

      if (instrRes.ok) {
        const body = await instrRes.json();
        setInstructors(body.instructors ?? []);
      }
      if (venueRes.ok) {
        const body = await venueRes.json();
        setVenues(body.venues ?? []);
      }
      if (tagRes.ok) {
        const body = await tagRes.json();
        setTags(body.tags ?? []);
      }
    };

    load();
  }, [open]);

  const toggleSkill = useCallback((skill: string) => {
    setRequiredSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }, []);

  const toggleGrade = useCallback((grade: string) => {
    setGradeGroups((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setAdditionalTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !date) return;
    if (!programId) {
      setError('Select a program first');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      // Step 1: Create the template
      const templateBody = {
        program_id: programId,
        name: name.trim(),
        required_skills: requiredSkills.length > 0 ? requiredSkills : null,
        instructor_id: instructorId || null,
        venue_id: venueId || null,
        grade_groups: gradeGroups,
        duration_minutes: durationMinutes,
        additional_tags: additionalTags.length > 0 ? additionalTags : null,
        is_active: true,
      };

      const templateRes = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateBody),
      });

      if (!templateRes.ok) {
        const body = await templateRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create template');
      }

      const { template } = await templateRes.json();

      // Step 2: Create a session at the clicked slot
      const startTime24 = startTime;
      const [hStr, mStr] = startTime24.split(':');
      const startMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
      const endMinutes = startMinutes + durationMinutes;
      const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
      const endM = String(endMinutes % 60).padStart(2, '0');
      const endTime = `${endH}:${endM}`;

      const sessionBody = {
        program_id: programId,
        template_id: template.id,
        instructor_id: instructorId || null,
        venue_id: venueId || null,
        grade_groups: gradeGroups,
        date,
        start_time: `${startTime24}:00`,
        end_time: `${endTime}:00`,
        duration_minutes: durationMinutes,
        status: 'draft',
        is_makeup: false,
        name: name.trim(),
      };

      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
      });

      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create session');
      }

      // Both succeeded — refresh and close
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Subject tags for required_skills
  const subjectTags = tags.filter(
    (t) => t.category?.toLowerCase() === 'subjects' || t.category?.toLowerCase() === 'subject',
  );
  const displaySubjectTags = subjectTags.length > 0 ? subjectTags : tags;

  // Non-subject tags for additional_tags
  const nonSubjectTags = tags.filter(
    (t) => t.category?.toLowerCase() !== 'subjects' && t.category?.toLowerCase() !== 'subject',
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-[70] w-[520px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-[0_8px_32px_#00000033] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
              <Plus className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Create Event Template</h3>
              <p className="text-[12px] text-slate-500">Creates a template &amp; places a session on the calendar</p>
            </div>
          </div>
          <Tooltip text="Close">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </Tooltip>
        </div>

        {/* Divider */}
        <div className="mx-6 my-3 border-t border-slate-100 shrink-0" />

        {/* Form body */}
        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Error banner */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Template Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Template Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Piano Lesson, Art Workshop"
              autoFocus
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Required Skills (Subjects) - multi-select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subjects</label>
            <div className="flex flex-wrap gap-1.5">
              {displaySubjectTags.map((t) => {
                const selected = requiredSkills.includes(t.name);
                return (
                  <Tooltip key={t.id} text={selected ? `Remove ${t.name}` : `Add ${t.name}`}>
                    <button
                      type="button"
                      onClick={() => toggleSkill(t.name)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t.name}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Instructor + Venue row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Instructor</label>
              <Tooltip text="Assign an instructor to this template">
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                >
                  <option value="">-- None --</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.first_name} {i.last_name}
                    </option>
                  ))}
                </select>
              </Tooltip>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Venue</label>
              <Tooltip text="Assign a venue to this template">
                <select
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
                >
                  <option value="">-- None --</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.space_type})
                    </option>
                  ))}
                </select>
              </Tooltip>
            </div>
          </div>

          {/* Grade Groups */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Grade Groups</label>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_OPTIONS.map((g) => {
                const selected = gradeGroups.includes(g);
                return (
                  <Tooltip key={g} text={selected ? `Remove ${g}` : `Add ${g}`}>
                    <button
                      type="button"
                      onClick={() => toggleGrade(g)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Duration + Date + Time row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration (min)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 0))}
                min={5}
                max={480}
                step={5}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Session Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Additional Tags */}
          {nonSubjectTags.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Additional Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {nonSubjectTags.map((t) => {
                  const selected = additionalTags.includes(t.id);
                  return (
                    <Tooltip key={t.id} text={selected ? `Remove ${t.name}` : `Add ${t.name}`}>
                      <button
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t.name}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-6 my-1 border-t border-slate-100 shrink-0" />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-3 shrink-0">
          <Tooltip text="Cancel and close">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </Tooltip>

          <Tooltip text={name.trim() && date ? 'Create template & place session' : 'Name and date are required'}>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || !date || saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {saving ? 'Creating...' : 'Create Template & Session'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
