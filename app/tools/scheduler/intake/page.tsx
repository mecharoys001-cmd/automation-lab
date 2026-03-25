'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AvailabilityJson, DayOfWeek } from '@/types/database';
import { Tooltip } from '../components/ui/Tooltip';

// ── Types ─────────────────────────────────────────────────

interface SubjectTag {
  id: string;
  name: string;
  emoji?: string | null;
  category: string;
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
];

// 8:00 AM to 5:30 PM — each slot is a 30-min block (end = start + 30m)
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 18; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 17 || h === 17) {
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }
  return slots.filter((s) => s <= '17:30');
}

const TIME_SLOTS = generateTimeSlots();

function formatTime(slot: string): string {
  const [hStr, min] = slot.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${min} ${ampm}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

/** Convert a Set of "day-HH:MM" keys into merged AvailabilityJson */
function buildAvailability(selected: Set<string>): AvailabilityJson {
  const grouped: Record<string, string[]> = {};
  for (const key of selected) {
    const [day, time] = key.split('-');
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(time);
  }

  const result: AvailabilityJson = {};
  for (const [day, times] of Object.entries(grouped)) {
    const sorted = times.sort();
    const blocks: { start: string; end: string }[] = [];
    let blockStart = sorted[0];
    let blockEnd = addMinutes(sorted[0], 30);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === blockEnd) {
        blockEnd = addMinutes(sorted[i], 30);
      } else {
        blocks.push({ start: blockStart, end: blockEnd });
        blockStart = sorted[i];
        blockEnd = addMinutes(sorted[i], 30);
      }
    }
    blocks.push({ start: blockStart, end: blockEnd });
    result[day as DayOfWeek] = blocks;
  }
  return result;
}

// ── Form State Type ────────────────────────────────────────

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  skills?: string;
  availability?: string;
}

// ── Component ──────────────────────────────────────────────

export default function IntakePage() {
  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  // Dynamic subjects from API
  const [availableSubjects, setAvailableSubjects] = useState<SubjectTag[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  // Program existence check — form disabled until a program with time blocks exists
  const [hasProgram, setHasProgram] = useState(false);
  const [programLoading, setProgramLoading] = useState(true);
  const [programId, setProgramId] = useState<string | null>(null);

  useEffect(() => {
    // First fetch programs, then use the program ID to fetch tags
    fetch('/api/programs')
      .then((res) => res.json())
      .then((data) => {
        const programs = data.programs ?? [];
        const validProgram = programs.find(
          (p: { id: string; start_date?: string; end_date?: string }) => p.start_date && p.end_date
        );
        if (validProgram) {
          setHasProgram(true);
          setProgramId(validProgram.id);

          // Fetch event types scoped to this program
          fetch(`/api/tags?program_id=${validProgram.id}`)
            .then((res) => res.json())
            .then((tagData) => {
              const tags: SubjectTag[] = (tagData.tags ?? []).filter(
                (t: SubjectTag) => ['Skills', 'Subjects', 'Event Type', 'Event Types'].includes(t.category)
              );
              setAvailableSubjects(tags);
            })
            .catch(() => setAvailableSubjects([]))
            .finally(() => setSubjectsLoading(false));
        } else {
          setHasProgram(false);
          setSubjectsLoading(false);
        }
      })
      .catch(() => {
        setHasProgram(false);
        setSubjectsLoading(false);
      })
      .finally(() => setProgramLoading(false));
  }, []);

  // Drag-to-paint state for availability grid
  const isDragging = useRef(false);
  const dragMode = useRef<'select' | 'deselect'>('select');

  const handleFieldChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const toggleSkill = useCallback((skill: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
    setErrors((prev) => ({ ...prev, skills: undefined }));
  }, []);

  const toggleSlot = useCallback((key: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setErrors((prev) => ({ ...prev, availability: undefined }));
  }, []);

  const applySlot = useCallback((key: string, mode: 'select' | 'deselect') => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (mode === 'select') next.add(key);
      else next.delete(key);
      return next;
    });
    setErrors((prev) => ({ ...prev, availability: undefined }));
  }, []);

  // Mouse handlers for drag-to-paint
  const handleCellMouseDown = useCallback(
    (key: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const isSelected = selectedSlots.has(key);
      dragMode.current = isSelected ? 'deselect' : 'select';
      applySlot(key, dragMode.current);
    },
    [selectedSlots, applySlot]
  );

  const handleCellMouseEnter = useCallback(
    (key: string) => () => {
      if (isDragging.current) {
        applySlot(key, dragMode.current);
      }
    },
    [applySlot]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Touch handlers for mobile drag-to-paint
  const handleTouchStart = useCallback(
    (key: string) => (e: React.TouchEvent) => {
      isDragging.current = true;
      const isSelected = selectedSlots.has(key);
      dragMode.current = isSelected ? 'deselect' : 'select';
      applySlot(key, dragMode.current);
    },
    [selectedSlots, applySlot]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const key = el?.getAttribute('data-slot-key');
      if (key) {
        applySlot(key, dragMode.current);
      }
    },
    [applySlot]
  );

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const clearAllSlots = useCallback(() => {
    setSelectedSlots(new Set());
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (selectedSkills.size === 0) newErrors.skills = 'Please select at least one event type';
    if (selectedSlots.size === 0) newErrors.availability = 'Please select your availability';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, selectedSkills, selectedSlots]);

  // Submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setSubmitState('loading');
      setSubmitError('');

      const availability = buildAvailability(selectedSlots);
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        skills: Array.from(selectedSkills),
        availability_json: availability,
        program_id: programId,
      };

      try {
        const res = await fetch('/api/intake/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Submission failed (${res.status})`);
        }

        setSubmitState('success');
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setSubmitState('error');
      }
    },
    [form, selectedSkills, selectedSlots, validate]
  );

  const resetForm = useCallback(() => {
    setForm({ first_name: '', last_name: '', email: '', phone: '' });
    setSelectedSkills(new Set());
    setSelectedSlots(new Set());
    setErrors({});
    setSubmitState('idle');
    setSubmitError('');
  }, []);

  // ── Success Screen ─────────────────────────────────────

  if (submitState === 'success') {
    return (
      <div className="dark min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
          <div className="rounded-xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-8">
              Your information has been submitted successfully. Our team will review your availability
              and be in touch soon.
            </p>
            <Tooltip text="Reset form and submit another response">
              <button
                onClick={resetForm}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Submit Another Response
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────

  return (
    <div
      className="dark min-h-screen bg-background text-foreground"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Staff Intake Form</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please provide your contact information, event types, and weekly availability.
          </p>
        </div>

        {/* Program check banner */}
        {!programLoading && !hasProgram && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 text-center">
            <p className="text-sm text-amber-300 font-medium">
              This form is not yet available. The scheduling program has not been configured.
            </p>
            <p className="text-xs text-amber-400/70 mt-1">
              Please contact your administrator to set up program time blocks first.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* ── Contact Information ─────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg mb-6">
            <h2 className="text-lg font-semibold mb-4">Contact Information</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* First Name */}
              <div>
                <label htmlFor="first_name" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  First Name <span className="text-red-400">*</span>
                </label>
                <Tooltip text="Enter your first name" className="w-full">
                  <input
                    id="first_name"
                    type="text"
                    value={form.first_name}
                    onChange={handleFieldChange('first_name')}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.first_name ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Jane"
                  />
                </Tooltip>
                {errors.first_name && <p className="mt-1 text-xs text-red-400">{errors.first_name}</p>}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="last_name" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <Tooltip text="Enter your last name" className="w-full">
                  <input
                    id="last_name"
                    type="text"
                    value={form.last_name}
                    onChange={handleFieldChange('last_name')}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.last_name ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Doe"
                  />
                </Tooltip>
                {errors.last_name && <p className="mt-1 text-xs text-red-400">{errors.last_name}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <Tooltip text="Enter your email address" className="w-full">
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={handleFieldChange('email')}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.email ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="jane@example.com"
                  />
                </Tooltip>
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Phone
                </label>
                <Tooltip text="Enter your phone number (optional)" className="w-full">
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleFieldChange('phone')}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="(555) 123-4567"
                  />
                </Tooltip>
              </div>
            </div>
          </div>

          {/* ── Event Types ──────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg mb-6">
            <h2 className="text-lg font-semibold mb-1">Event Types</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Select all areas you are qualified to teach. <span className="text-red-400">*</span>
            </p>

            {subjectsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading event types...
              </div>
            ) : availableSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No event types have been created yet. An administrator needs to add event type tags first.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availableSubjects.map((subject) => {
                  const checked = selectedSkills.has(subject.name);
                  return (
                    <Tooltip key={subject.id} text={`Toggle ${subject.name} event type`}>
                      <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                          checked
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSkill(subject.name)}
                          className="sr-only"
                        />
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            checked ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          }`}
                        >
                          {checked && (
                            <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                        {subject.emoji && <span>{subject.emoji}</span>}
                        {subject.name}
                      </label>
                    </Tooltip>
                  );
                })}
              </div>
            )}
            {errors.skills && <p className="mt-2 text-xs text-red-400">{errors.skills}</p>}
          </div>

          {/* ── Weekly Availability Grid ────────────────── */}
          <div className={`rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg mb-6 ${!hasProgram && !programLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-start justify-between mb-1 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/20 shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Weekly Availability</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click or drag to select your available time blocks. <span className="text-red-400">*</span>
                  </p>
                </div>
              </div>
              {selectedSlots.size > 0 && (
                <Tooltip text="Clear all selected time blocks">
                  <button
                    type="button"
                    onClick={clearAllSlots}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
                  >
                    Clear All
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm border border-border bg-background" />
                Unavailable
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-green-500/70" />
                Available
              </div>
            </div>

            {/* Grid */}
            <div
              className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6"
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="min-w-[480px]">
                {/* Day headers */}
                <div className="grid gap-px" style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}>
                  <div /> {/* empty corner */}
                  {DAYS.map((day) => (
                    <div key={day.key} className="py-2 text-center text-xs font-medium text-muted-foreground">
                      <span className="hidden sm:inline">{day.label}</span>
                      <span className="sm:hidden">{day.short}</span>
                    </div>
                  ))}
                </div>

                {/* Time rows */}
                <div className="grid gap-px rounded-lg border border-border overflow-hidden" style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}>
                  {TIME_SLOTS.map((slot) => (
                    <div key={slot} className="contents">
                      {/* Time label */}
                      <div className="flex items-center justify-end pr-2 text-[10px] sm:text-xs text-muted-foreground bg-card h-7 sm:h-8 border-b border-border">
                        {formatTime(slot)}
                      </div>
                      {/* Day cells — no Tooltip wrapper to preserve CSS Grid layout */}
                      {DAYS.map((day) => {
                        const key = `${day.key}-${slot}`;
                        const isSelected = selectedSlots.has(key);
                        return (
                          <div
                            key={key}
                            data-slot-key={key}
                            onMouseDown={handleCellMouseDown(key)}
                            onMouseEnter={handleCellMouseEnter(key)}
                            onTouchStart={handleTouchStart(key)}
                            title={`Toggle ${day.label} ${formatTime(slot)}`}
                            className={`h-7 sm:h-8 border-b border-l border-border cursor-pointer select-none transition-colors ${
                              isSelected
                                ? 'bg-green-500/60 hover:bg-green-500/50'
                                : 'bg-background hover:bg-accent/40'
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {errors.availability && <p className="mt-2 text-xs text-red-400">{errors.availability}</p>}

            {/* Selected summary */}
            {selectedSlots.size > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {selectedSlots.size} time block{selectedSlots.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* ── Error Banner ────────────────────────────── */}
          {submitState === 'error' && submitError && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          {/* ── Submit ──────────────────────────────────── */}
          <div className="flex justify-end">
            <Tooltip text="Submit your intake form">
              <button
                type="submit"
                disabled={submitState === 'loading' || !hasProgram}
                className="rounded-lg bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitState === 'loading' ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit'
                )}
              </button>
            </Tooltip>
          </div>
        </form>
      </div>
    </div>
  );
}
