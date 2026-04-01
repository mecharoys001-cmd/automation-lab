'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AvailabilityJson, DayOfWeek } from '@/types/database';
import { Tooltip } from '../components/ui/Tooltip';

// ── Inline Toast Component (React-rendered, visible to QA) ────

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function Toaster({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [toast?.id, onDismiss]);

  return (
    <div data-testid="toaster" className="fixed bottom-4 right-4 z-[99999]">
      <div aria-live="assertive" role="status" data-testid="toast-live-region">
        {toast ? toast.message : ''}
      </div>
      {toast && (
        <div
          role="alert"
          data-testid="toast"
          data-toast-type={toast.type}
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
            toast.type === 'success' ? 'bg-emerald-500 success' : 'bg-red-500'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}

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
  phone?: string;
  skills?: string;
  availability?: string;
}

// ── Component ──────────────────────────────────────────────

export default function IntakePage() {
  return (
    <Suspense fallback={<div className="dark min-h-screen bg-background text-foreground flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <IntakeForm />
    </Suspense>
  );
}

function IntakeForm() {
  const searchParams = useSearchParams();
  const urlProgramId = searchParams.get('program') ?? searchParams.get('program_id');

  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  // Honeypot field — invisible to humans, bots auto-fill it
  const [honeypot, setHoneypot] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  // React-rendered toast state
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastCounter = useRef(0);
  const fireToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type, id: ++toastCounter.current });
  }, []);

  // Dynamic subjects from API
  const [availableSubjects, setAvailableSubjects] = useState<SubjectTag[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  // Program existence check — form disabled until a program with time blocks exists
  const [hasProgram, setHasProgram] = useState(false);
  const [programLoading, setProgramLoading] = useState(true);
  const [programId, setProgramId] = useState<string | null>(null);
  const [programError, setProgramError] = useState<'none' | 'missing_param' | 'not_configured'>('none');

  useEffect(() => {
    // First fetch programs, then use the program ID to fetch tags
    fetch('/api/programs')
      .then((res) => res.json())
      .then((data) => {
        const programs = data.programs ?? [];
        // Require program_id in the URL — external staff won't have session/cookie context
        if (!urlProgramId) {
          setHasProgram(false);
          setProgramError('missing_param');
          setSubjectsLoading(false);
          setProgramLoading(false);
          return;
        }
        const targetProgram = programs.find(
          (p: { id: string; start_date?: string; end_date?: string }) =>
            p.id === urlProgramId && p.start_date && p.end_date
        );
        if (targetProgram) {
          setHasProgram(true);
          setProgramId(targetProgram.id);

          // Fetch event types scoped to this program
          fetch(`/api/tags?program_id=${targetProgram.id}`)
            .then((res) => res.json())
            .then((tagData) => {
              const tags: SubjectTag[] = (tagData.tags ?? []).filter(
                (t: SubjectTag) => t.category === 'Event Type'
              );
              setAvailableSubjects(tags);
            })
            .catch(() => setAvailableSubjects([]))
            .finally(() => setSubjectsLoading(false));
        } else {
          setHasProgram(false);
          setProgramError('not_configured');
          setSubjectsLoading(false);
        }
      })
      .catch(() => {
        setHasProgram(false);
        setProgramError('not_configured');
        setSubjectsLoading(false);
      })
      .finally(() => setProgramLoading(false));
  }, [urlProgramId]);

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

  // Keyboard handler for availability grid cells
  const handleCellKeyDown = useCallback(
    (key: string, dayIdx: number, slotIdx: number) => (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleSlot(key);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        let nextDay = dayIdx;
        let nextSlot = slotIdx;
        if (e.key === 'ArrowRight') nextDay = Math.min(dayIdx + 1, DAYS.length - 1);
        else if (e.key === 'ArrowLeft') nextDay = Math.max(dayIdx - 1, 0);
        else if (e.key === 'ArrowDown') nextSlot = Math.min(slotIdx + 1, TIME_SLOTS.length - 1);
        else if (e.key === 'ArrowUp') nextSlot = Math.max(slotIdx - 1, 0);
        const nextKey = `${DAYS[nextDay].key}-${TIME_SLOTS[nextSlot]}`;
        const nextEl = document.querySelector<HTMLElement>(`[data-slot-key="${nextKey}"]`);
        nextEl?.focus();
      }
    },
    [toggleSlot]
  );

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

  // Validation helpers
  const isValidEmail = (v: string): boolean =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim());

  const isValidPhone = (v: string): boolean => {
    const trimmed = v.trim();
    if (!trimmed) return true; // optional field
    if (!/^[0-9\s\-()+.]+$/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  };

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(form.email)) {
      newErrors.email = 'Please enter a valid email address (e.g. name@example.com)';
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      newErrors.phone = 'Please enter a valid phone number (e.g. (555) 123-4567)';
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

      // Honeypot check — silently "succeed" if a bot filled the hidden field
      if (honeypot) {
        setSubmitState('success');
        return;
      }

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
        fireToast('Your information has been submitted successfully!', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setSubmitError(message);
        setSubmitState('error');
        fireToast(message, 'error');
        // Scroll error banner into view so user sees the feedback
        setTimeout(() => {
          document.getElementById('submit-error-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    },
    [form, selectedSkills, selectedSlots, validate, honeypot, programId, fireToast]
  );

  const resetForm = useCallback(() => {
    setForm({ first_name: '', last_name: '', email: '', phone: '' });
    setHoneypot('');
    setSelectedSkills(new Set());
    setSelectedSlots(new Set());
    setErrors({});
    setSubmitState('idle');
    setSubmitError('');
  }, []);

  // ── Success Screen ─────────────────────────────────────

  if (submitState === 'success') {
    return (
      <div className="dark min-h-screen bg-background text-foreground" data-submit-state="success">
        <Toaster toast={toast} onDismiss={() => setToast(null)} />
        <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
          <div data-testid="submission-success" className="rounded-xl border border-border bg-card p-8 text-center shadow-lg success">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-8 w-8 text-green-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
    <main
      role="main"
      className="dark min-h-screen bg-background text-foreground"
      data-submit-state={submitState}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Toaster toast={toast} onDismiss={() => setToast(null)} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 id="intake-form-heading" className="text-2xl font-bold sm:text-3xl">Staff Intake Form</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please provide your contact information, event types, and weekly availability.
          </p>
        </div>

        {/* Program check banner */}
        {!programLoading && !hasProgram && programError === 'missing_param' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-6 text-center">
            <p className="text-sm text-red-800 font-medium">
              This form link is incomplete.
            </p>
            <p className="text-xs text-red-800/70 mt-1">
              Please ask your administrator for the correct intake form URL with a program parameter.
            </p>
          </div>
        )}
        {!programLoading && !hasProgram && programError === 'not_configured' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 text-center">
            <p className="text-sm text-amber-800 font-medium">
              This form is not yet available. The scheduling program has not been configured.
            </p>
            <p className="text-xs text-amber-800/70 mt-1">
              Please contact your administrator to set up program time blocks first.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} aria-labelledby="intake-form-heading" noValidate>
          {/* Disable all form fields when no valid program is configured */}
          <fieldset disabled={!hasProgram && !programLoading} className="contents">
          {/* Honeypot — hidden from humans, caught by bots */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* ── Contact Information ─────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg mb-6">
            <h2 className="text-lg font-semibold mb-4">Contact Information</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* First Name */}
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-muted-foreground mb-1.5">
                  First Name <span className="text-red-700">*</span>
                </label>
                <Tooltip text="Enter your first name" className="w-full">
                  <input
                    id="first_name"
                    type="text"
                    required
                    autoComplete="given-name"
                    aria-required="true"
                    aria-invalid={!!errors.first_name}
                    aria-describedby={errors.first_name ? 'first_name-error' : undefined}
                    value={form.first_name}
                    onChange={handleFieldChange('first_name')}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.first_name ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Jane"
                  />
                </Tooltip>
                <p id="first_name-error" role="alert" aria-live="assertive" className="mt-1 text-xs text-red-700">{errors.first_name ?? ''}</p>
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Last Name <span className="text-red-700">*</span>
                </label>
                <Tooltip text="Enter your last name" className="w-full">
                  <input
                    id="last_name"
                    type="text"
                    required
                    autoComplete="family-name"
                    aria-required="true"
                    aria-invalid={!!errors.last_name}
                    aria-describedby={errors.last_name ? 'last_name-error' : undefined}
                    value={form.last_name}
                    onChange={handleFieldChange('last_name')}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.last_name ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Doe"
                  />
                </Tooltip>
                <p id="last_name-error" role="alert" aria-live="assertive" className="mt-1 text-xs text-red-700">{errors.last_name ?? ''}</p>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Email <span className="text-red-700">*</span>
                </label>
                <Tooltip text="Enter your email address" className="w-full">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    value={form.email}
                    onChange={handleFieldChange('email')}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.email ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="jane@example.com"
                  />
                </Tooltip>
                <p id="email-error" role="alert" aria-live="assertive" className="mt-1 text-xs text-red-700">{errors.email ?? ''}</p>
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Phone
                </label>
                <Tooltip text="Enter your phone number (optional)" className="w-full">
                  <input
                    id="phone"
                    type="tel"
                    pattern="[0-9\s\-\(\)\+\.]{7,20}"
                    title="Phone number (7-20 characters: digits, spaces, dashes, parentheses, +, .)"
                    autoComplete="tel"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
                    value={form.phone}
                    onChange={(e) => {
                      const filtered = e.target.value.replace(/[^0-9\s\-()+.]/g, '');
                      setForm((prev) => ({ ...prev, phone: filtered }));
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    onBlur={() => {
                      if (form.phone.trim() && !isValidPhone(form.phone)) {
                        setErrors((prev) => ({ ...prev, phone: 'Please enter a valid phone number (e.g. (555) 123-4567)' }));
                      }
                    }}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      errors.phone ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                </Tooltip>
                <p id="phone-error" role="alert" aria-live="assertive" className="mt-1 text-xs text-red-700">{errors.phone ?? ''}</p>
                <p id="phone-hint" className="mt-0.5 text-[11px] text-muted-foreground">Format: (555) 123-4567</p>
              </div>
            </div>
          </div>

          {/* ── Event Types ──────────────────────────────────── */}
          <fieldset className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg mb-6" aria-describedby={errors.skills ? 'skills-error' : undefined}>
            <legend className="text-lg font-semibold mb-1">Event Types</legend>
            <p className="text-xs text-muted-foreground mb-4">
              Select all areas you are qualified to teach. <span className="text-red-700">*</span>
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
                        htmlFor={`event-type-${subject.id}`}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-3 text-sm transition-colors min-h-[44px] ${
                          checked
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`event-type-${subject.id}`}
                          name={`event_type_${subject.name.toLowerCase().replace(/\s+/g, '_')}`}
                          value={subject.name}
                          checked={checked}
                          onChange={() => toggleSkill(subject.name)}
                          className="sr-only"
                        />
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors ${
                            checked ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          }`}
                        >
                          {checked && (
                            <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
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
            <p id="skills-error" role="alert" aria-live="assertive" className="mt-2 text-xs text-red-700">{errors.skills ?? ''}</p>
          </fieldset>

          {/* ── Weekly Availability Grid ────────────────── */}
          <div className={`rounded-xl border border-border bg-card p-5 sm:p-6 shadow-lg mb-6 ${!hasProgram && !programLoading ? 'opacity-50 pointer-events-none' : ''}`} role="group" aria-label="Weekly Availability" aria-describedby={errors.availability ? 'availability-error' : undefined}>
            <div className="flex items-start justify-between mb-1 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/20 shrink-0">
                  <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Weekly Availability</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click or drag to select your available time blocks. <span className="text-red-700">*</span>
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
                {/* Grid with headers and time rows */}
                <div role="grid" aria-label="Weekly availability" className="grid gap-px rounded-lg border border-border overflow-hidden" style={{ gridTemplateColumns: '72px repeat(5, 1fr)' }}>
                  {/* Day headers */}
                  <div role="row" className="contents">
                    <div role="columnheader" className="py-2 bg-card" /> {/* empty corner */}
                    {DAYS.map((day) => (
                      <div key={day.key} role="columnheader" className="py-2 text-center text-xs font-medium text-muted-foreground bg-card">
                        <span className="hidden sm:inline">{day.label}</span>
                        <span className="sm:hidden">{day.short}</span>
                      </div>
                    ))}
                  </div>
                  {TIME_SLOTS.map((slot, slotIdx) => (
                    <div key={slot} role="row" className="contents">
                      {/* Time label */}
                      <div role="rowheader" className="flex items-center justify-end pr-2 text-[10px] sm:text-xs text-muted-foreground bg-card h-7 sm:h-8 border-b border-border">
                        {formatTime(slot)}
                      </div>
                      {/* Day cells — no Tooltip wrapper to preserve CSS Grid layout */}
                      {DAYS.map((day, dayIdx) => {
                        const key = `${day.key}-${slot}`;
                        const isSelected = selectedSlots.has(key);
                        return (
                          <div
                            key={key}
                            role="gridcell"
                            tabIndex={slotIdx === 0 && dayIdx === 0 ? 0 : -1}
                            aria-checked={isSelected}
                            aria-label={`${day.label} ${formatTime(slot)} – ${isSelected ? 'available' : 'unavailable'}`}
                            data-slot-key={key}
                            onMouseDown={handleCellMouseDown(key)}
                            onMouseEnter={handleCellMouseEnter(key)}
                            onTouchStart={handleTouchStart(key)}
                            onKeyDown={handleCellKeyDown(key, dayIdx, slotIdx)}
                            title={`Toggle ${day.label} ${formatTime(slot)}`}
                            className={`h-7 sm:h-8 border-b border-l border-border cursor-pointer select-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:z-10 ${
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

            <p id="availability-error" role="alert" aria-live="assertive" className="mt-2 text-xs text-red-700">{errors.availability ?? ''}</p>

            {/* Selected summary */}
            {selectedSlots.size > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {selectedSlots.size} time block{selectedSlots.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* ── Validation summary ────────────────────── */}
          <div role="alert" aria-live="assertive" className={Object.values(errors).some(Boolean) ? 'mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700' : ''}>
            {Object.values(errors).some(Boolean) && `Please fix ${Object.values(errors).filter(Boolean).length} error(s) above before submitting.`}
          </div>

          {/* ── Error Banner ────────────────────────────── */}
          <div id="submit-error-banner" role="alert" aria-live="assertive" className={submitState === 'error' && submitError ? 'mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700' : ''}>
            {submitState === 'error' && submitError ? (
              <>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {submitError}
              </>
            ) : ''}
          </div>

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
          </fieldset>
        </form>
      </div>
    </main>
  );
}
