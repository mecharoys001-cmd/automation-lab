'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical, Pencil, Trash2, X, ChevronDown, Save, Send, Loader2, Check, AlertTriangle, Wand2, Zap, RefreshCw, Shuffle, Clock, Coffee, Info } from 'lucide-react';
import { useProgram } from '../ProgramContext';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { TemplateList } from '../../components/templates/TemplateList';
import type { TemplateListItem } from '../../components/templates/TemplateList';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  gradeLevel?: string;
  subject?: string;
  instructor?: string;
  venue?: string;
  days: number[]; // indices into DAYS array
  timeSlot?: { start: string; end: string }; // HH:MM format
  instructorRotation: boolean;
  color: string;
  /** Multi-week cycle length. null or 1 = weekly. 2+ = repeats every N weeks. */
  weekCycleLength: number | null;
  /** 0-indexed week in the cycle. 0 = Week 1, 1 = Week 2, etc. */
  weekInCycle: number | null;
  // ── DB-synced fields (preserved across round-trips) ──
  /** Full grade_groups array from DB (gradeLevel is derived from first element for display) */
  gradeGroups?: string[];
  /** instructor_id from DB */
  instructorId?: string | null;
  /** venue_id from DB */
  venueId?: string | null;
  /** template_type from DB */
  templateType?: string;
  /** required_skills from DB */
  requiredSkills?: string[] | null;
  /** is_active from DB */
  isActive?: boolean;
  /** sort_order from DB */
  sortOrder?: number | null;
}

interface PlacedTemplate {
  id: string;
  templateId: string;
  dayIndex: number;
  startHour: number;
  durationHours: number;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOUR_HEIGHT = 72;
const DEFAULT_DAY_START = 8;
const DEFAULT_DAY_END = 16;
const TIME_COL_WIDTH = 72;

const TEMPLATE_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
];

const GRADE_OPTIONS = ['K', 'K-1', 'K-2', '1', '1-2', '2', '2-3', '3', '3-4', '4', '4-5', '5', '5-6', '6', 'All'];

const SUBJECT_OPTIONS = [
  'Strings', 'Piano', 'Brass', 'Percussion', 'Woodwinds', 'Choir',
  'General Music', 'Music Theory', 'Composition', 'Ensemble',
];

const INSTRUCTOR_OPTIONS = [
  'Ms. Chen', 'Mr. Park', 'Ms. Rivera', 'Mr. Johnson', 'Ms. Davis', 'Mr. Lee',
];

const VENUE_OPTIONS = [
  'Room A1', 'Room B2', 'Auditorium', 'Piano Lab', 'Music Hall', 'Choir Room', 'Virtual Studio',
];

const AUTO_FILL_DAYS_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const AUTO_FILL_WEEKDAY_INDICES = [1, 2, 3, 4, 5]; // Mo–Fr pre-checked
// Maps auto-fill day index (0=Su..6=Sa) to grid dayIndex (0=Mon..4=Fri)
const AUTO_FILL_DAY_TO_GRID: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

function generateTimeOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) continue;
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = m === 0 ? `${displayH}:00 ${period}` : `${displayH}:${String(m).padStart(2, '0')} ${period}`;
      opts.push({ value, label });
    }
  }
  return opts;
}

const TIME_OPTIONS = generateTimeOptions();

// ──────────────────────────────────────────────────────────────
// DB ↔ Frontend conversion helpers
// ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbTemplate(db: Record<string, any>, index: number): Template {
  const gradeGroups: string[] = db.grade_groups ?? [];
  const startTime = ((db.start_time as string) ?? '09:00').slice(0, 5);
  const endTime = ((db.end_time as string) ?? '10:00').slice(0, 5);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const venue = db.venue as Record<string, any> | null;

  return {
    id: db.id as string,
    name: gradeGroups.length > 0
      ? `${gradeGroups.join(', ')} ${formatTimeSlot({ start: startTime, end: endTime })}`
      : 'Untitled Template',
    gradeLevel: gradeGroups[0] ?? '',
    subject: '',
    instructor: '',
    venue: (venue?.name as string) ?? '',
    days: db.day_of_week != null ? [db.day_of_week as number] : [],
    timeSlot: { start: startTime, end: endTime },
    instructorRotation: db.rotation_mode === 'rotate',
    color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
    weekCycleLength: (db.week_cycle_length as number | null) ?? null,
    weekInCycle: (db.week_in_cycle as number | null) ?? null,
    // Preserve DB fields for round-trip fidelity
    gradeGroups,
    instructorId: (db.instructor_id as string | null) ?? null,
    venueId: (db.venue_id as string | null) ?? null,
    templateType: (db.template_type as string) ?? 'fully_defined',
    requiredSkills: (db.required_skills as string[] | null) ?? null,
    isActive: db.is_active !== false,
    sortOrder: (db.sort_order as number | null) ?? null,
  };
}

function toDbPayload(t: Template, programId: string) {
  const startTime = t.timeSlot?.start ?? '09:00';
  const endTime = t.timeSlot?.end ?? '10:00';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

  // Build grade_groups: use full array if available, fall back to single gradeLevel
  const gradeGroups = t.gradeGroups && t.gradeGroups.length > 0
    ? t.gradeGroups
    : t.gradeLevel ? [t.gradeLevel] : [];

  // If gradeLevel was changed in the UI, update the first element of gradeGroups
  if (t.gradeLevel && gradeGroups[0] !== t.gradeLevel) {
    gradeGroups[0] = t.gradeLevel;
  }

  return {
    program_id: programId,
    day_of_week: t.days[0] ?? 1,
    grade_groups: gradeGroups,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: Math.max(durationMinutes, 0),
    rotation_mode: t.instructorRotation ? 'rotate' : 'consistent',
    template_type: t.templateType ?? 'fully_defined',
    is_active: t.isActive !== false,
    week_cycle_length: t.weekCycleLength,
    week_in_cycle: t.weekInCycle,
    // Preserve DB-synced fields
    instructor_id: t.instructorId ?? null,
    venue_id: t.venueId ?? null,
    required_skills: t.requiredSkills ?? null,
    sort_order: t.sortOrder ?? null,
  };
}

// ──────────────────────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────────────────────

function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayH}${period}` : `${displayH}:${String(m).padStart(2, '0')}${period}`;
}

function snapToQuarterHour(hour: number): number {
  return Math.round(hour * 4) / 4;
}

function formatTimeSlot(ts?: { start: string; end: string }): string {
  if (!ts) return '—';
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr);
    const m = mStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === '00' ? `${dh}${period}` : `${dh}:${m}${period}`;
  };
  return `${fmt(ts.start)}–${fmt(ts.end)}`;
}

function formatSchedule(template: Template): string {
  const dayStr = template.days.length === 5
    ? 'Mon–Fri'
    : template.days.map((d) => DAYS_SHORT[d]).join('/');
  const time = formatTimeSlot(template.timeSlot);
  return dayStr ? `${dayStr} ${time}` : time;
}

/** Build a short display name that includes subject/skill AND grade for distinguishing blocks. */
function getBlockDisplayName(template: Template): string {
  const subject = template.subject || template.name;
  const grade = template.gradeLevel;
  if (grade) {
    return `${subject} - Grade ${grade}`;
  }
  return subject;
}

function timeStringToHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

/** Check if a given hour (or fractional hour) falls within the lunch break window. */
function isLunchHour(hour: number, lunchEnabled: boolean, lunchStart: number, lunchEnd: number): boolean {
  if (!lunchEnabled) return false;
  return hour >= lunchStart && hour < lunchEnd;
}

/** Check if a placed block overlaps with lunch break at all. */
function overlapsLunch(startHour: number, durationHours: number, lunchEnabled: boolean, lunchStart: number, lunchEnd: number): boolean {
  if (!lunchEnabled) return false;
  const endHour = startHour + durationHours;
  return startHour < lunchEnd && endHour > lunchStart;
}

function emptyTemplate(): Template {
  return {
    id: '',
    name: '',
    gradeLevel: '',
    subject: '',
    instructor: '',
    venue: '',
    days: [],
    timeSlot: { start: '09:00', end: '10:00' },
    instructorRotation: false,
    color: '',
    weekCycleLength: null,
    weekInCycle: null,
  };
}

// ──────────────────────────────────────────────────────────────
// Toast Notification
// ──────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {isSuccess ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Form Field Components
// ──────────────────────────────────────────────────────────────

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tooltip?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-900 mb-1.5">{label}</label>
      <Tooltip text={tooltip ?? label} className="block">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </Tooltip>
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  tooltip?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-900 mb-1.5">{label}</label>
      <Tooltip text={tooltip ?? label} className="block">
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 pr-10 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{placeholder ?? `Select ${label.toLowerCase()}`}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </Tooltip>
    </div>
  );
}

function DayChips({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (idx: number) => {
    onChange(
      selected.includes(idx) ? selected.filter((d) => d !== idx) : [...selected, idx].sort(),
    );
  };

  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-900 mb-1.5">{label}</label>
      <div className="flex gap-1.5 flex-wrap">
        {DAYS_SHORT.map((day, idx) => {
          const active = selected.includes(idx);
          return (
            <Tooltip key={day} text={active ? `Remove ${day}` : `Add ${day}`}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                className={`h-10 px-3.5 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {day}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function TimeSlotInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { start: string; end: string };
  onChange: (v: { start: string; end: string }) => void;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-900 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <Tooltip text="Start time" className="flex-1">
          <input
            type="time"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </Tooltip>
        <span className="text-[13px] text-slate-400">to</span>
        <Tooltip text="End time" className="flex-1">
          <input
            type="time"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </Tooltip>
      </div>
    </div>
  );
}

function RotationToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-900 mb-1.5">{label}</label>
      <div className="flex items-center gap-3 h-10">
        <Tooltip text={enabled ? 'Disable instructor rotation' : 'Enable instructor rotation'}>
          <button
            type="button"
            onClick={() => onChange(!enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              enabled ? 'bg-blue-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </Tooltip>
        <span className="text-[13px] text-slate-600">{enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
    </div>
  );
}

function WeekCycleInput({
  cycleLength,
  weekInCycle,
  onCycleLengthChange,
  onWeekInCycleChange,
}: {
  cycleLength: number | null;
  weekInCycle: number | null;
  onCycleLengthChange: (v: number | null) => void;
  onWeekInCycleChange: (v: number | null) => void;
}) {
  const isMultiWeek = cycleLength !== null && cycleLength >= 2;

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[13px] font-medium text-slate-900">Week Cycle</label>
        <Tooltip text="Templates in a multi-week cycle repeat every N weeks. Week 1 templates run on the 1st, (N+1)th, (2N+1)th… occurrence from the program start date.">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 cursor-help">?</span>
        </Tooltip>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-3">
        <Tooltip text="Template runs every week">
          <button
            type="button"
            onClick={() => {
              onCycleLengthChange(null);
              onWeekInCycleChange(null);
            }}
            className={`flex-1 h-10 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
              !isMultiWeek
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Weekly
          </button>
        </Tooltip>
        <Tooltip text="Template repeats on a multi-week rotation (e.g. every 2 weeks)">
          <button
            type="button"
            onClick={() => {
              if (!isMultiWeek) {
                onCycleLengthChange(2);
                onWeekInCycleChange(0);
              }
            }}
            className={`flex-1 h-10 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
              isMultiWeek
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Multi-week
          </button>
        </Tooltip>
      </div>

      {/* Multi-week config */}
      {isMultiWeek && (
        <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex-1">
            <Tooltip text="How many weeks before the pattern repeats (2–8)" className="block">
              <label className="block text-[12px] font-medium text-slate-600 mb-1">Cycle length</label>
              <select
                value={cycleLength}
                onChange={(e) => {
                  const newLen = parseInt(e.target.value, 10);
                  onCycleLengthChange(newLen);
                  // Clamp weekInCycle if it exceeds new length
                  if ((weekInCycle ?? 0) >= newLen) {
                    onWeekInCycleChange(0);
                  }
                }}
                className="w-full h-9 bg-white rounded-lg border border-slate-200 px-3 pr-8 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n} weeks</option>
                ))}
              </select>
            </Tooltip>
          </div>
          <div className="flex-1">
            <Tooltip text="Which week of the cycle this template is active" className="block">
              <label className="block text-[12px] font-medium text-slate-600 mb-1">Active on</label>
              <select
                value={weekInCycle ?? 0}
                onChange={(e) => onWeekInCycleChange(parseInt(e.target.value, 10))}
                className="w-full h-9 bg-white rounded-lg border border-slate-200 px-3 pr-8 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Array.from({ length: cycleLength }, (_, i) => (
                  <option key={i} value={i}>Week {i + 1}</option>
                ))}
              </select>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Edit Modal
// ──────────────────────────────────────────────────────────────

function EditTemplateModal({
  template,
  isNew,
  onSave,
  onClose,
  isSaving,
}: {
  template: Template;
  isNew: boolean;
  onSave: (t: Template) => void;
  onClose: () => void;
  isSaving?: boolean;
}) {
  const [local, setLocal] = useState<Template>({ ...template });

  const update = <K extends keyof Template>(key: K, val: Template[K]) => {
    setLocal((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    onSave(local);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <Tooltip text="Click to close">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      </Tooltip>

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? 'Create Template' : 'Edit Template'}
          </h2>
          <Tooltip text="Close">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {/* Left Column */}
            <FormInput
              label="Template Name"
              value={local.name}
              onChange={(v) => update('name', v)}
              placeholder="e.g., Weekly Strings K-2"
              tooltip="Enter a name to identify this template"
            />
            <FormSelect
              label="Venue"
              value={local.venue ?? ''}
              onChange={(v) => update('venue', v)}
              options={VENUE_OPTIONS}
              tooltip="Assign a room or location for this template"
            />
            <FormSelect
              label="Grade Level"
              value={local.gradeLevel ?? ''}
              onChange={(v) => update('gradeLevel', v)}
              options={GRADE_OPTIONS}
              tooltip="Select the target grade level or range"
            />
            <DayChips
              label="Day of Week"
              selected={local.days}
              onChange={(v) => update('days', v)}
            />
            <FormSelect
              label="Subject"
              value={local.subject ?? ''}
              onChange={(v) => update('subject', v)}
              options={SUBJECT_OPTIONS}
              tooltip="Choose the music subject for this template"
            />
            <TimeSlotInput
              label="Time Slot"
              value={local.timeSlot ?? { start: '09:00', end: '10:00' }}
              onChange={(v) => update('timeSlot', v)}
            />
            <FormSelect
              label="Instructor"
              value={local.instructor ?? ''}
              onChange={(v) => update('instructor', v)}
              options={INSTRUCTOR_OPTIONS}
              tooltip="Assign an instructor to this template"
            />
            <RotationToggle
              label="Instructor Rotation"
              enabled={local.instructorRotation}
              onChange={(v) => update('instructorRotation', v)}
            />
            <WeekCycleInput
              cycleLength={local.weekCycleLength}
              weekInCycle={local.weekInCycle}
              onCycleLengthChange={(v) => update('weekCycleLength', v)}
              onWeekInCycleChange={(v) => update('weekInCycle', v)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} tooltip="Discard changes and close">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving} tooltip={isNew ? 'Create new template' : 'Save template changes'}>
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </span>
            ) : isNew ? 'Create Template' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Auto-Fill Schedule Modal
// ──────────────────────────────────────────────────────────────

interface PerDayTimeRange {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface AutoFillSettings {
  startTime: string;
  endTime: string;
  selectedDays: number[]; // indices into AUTO_FILL_DAYS_LABELS (0=Su..6=Sa)
  strategy: 'fill_gaps' | 'spread_evenly';
  priorityTags: string[];
  schedulePattern: 'same' | 'rotating' | 'random';
  rotationOrder: string[]; // template IDs in rotation order
  usePerDayTimes: boolean;
  perDayTimes: Record<number, PerDayTimeRange>; // keyed by AUTO_FILL day index (0=Su..6=Sa)
}

function AutoFillModal({
  onFill,
  onClose,
  isFilling,
  templates,
}: {
  onFill: (settings: AutoFillSettings) => void;
  onClose: () => void;
  isFilling: boolean;
  templates: Template[];
}) {
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('15:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([...AUTO_FILL_WEEKDAY_INDICES]);
  const [strategy, setStrategy] = useState<'fill_gaps' | 'spread_evenly'>('fill_gaps');
  const [priorityTags, setPriorityTags] = useState<string[]>([]);
  const [schedulePattern, setSchedulePattern] = useState<'same' | 'rotating' | 'random'>('same');
  const [rotationOrder, setRotationOrder] = useState<string[]>(() => templates.map((t) => t.id));
  const [usePerDayTimes, setUsePerDayTimes] = useState(false);
  const [perDayTimes, setPerDayTimes] = useState<Record<number, PerDayTimeRange>>(() => {
    const initial: Record<number, PerDayTimeRange> = {};
    for (const idx of AUTO_FILL_WEEKDAY_INDICES) {
      initial[idx] = { enabled: true, startTime: '08:00', endTime: '15:00' };
    }
    return initial;
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort(),
    );
  };

  const toggleTag = (tag: string) => {
    setPriorityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const updatePerDayTime = (dayIdx: number, field: keyof PerDayTimeRange, value: string | boolean) => {
    setPerDayTimes((prev) => ({
      ...prev,
      [dayIdx]: { ...prev[dayIdx], [field]: value },
    }));
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) return;
    setRotationOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(targetIdx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const handleFill = () => {
    onFill({
      startTime,
      endTime,
      selectedDays,
      strategy,
      priorityTags,
      schedulePattern,
      rotationOrder,
      usePerDayTimes,
      perDayTimes,
    });
  };

  const timeSelectClasses = "w-full h-9 bg-white rounded-lg border border-slate-200 px-2.5 pr-10 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Tooltip text="Click to close">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      </Tooltip>

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-100">
              <Wand2 className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Auto-Fill Schedule</h2>
          </div>
          <Tooltip text="Close">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Day Selection */}
          <div>
            <label className="block text-[13px] font-medium text-slate-900 mb-1.5">Days</label>
            <div className="flex gap-1.5">
              {AUTO_FILL_DAYS_LABELS.map((day, idx) => {
                const active = selectedDays.includes(idx);
                return (
                  <Tooltip key={day} text={active ? `Remove ${day}` : `Add ${day}`}>
                    <button
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`h-9 w-10 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-violet-500 text-white border-violet-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {day}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Time Range with Per-Day Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-medium text-slate-900">Time Range</label>
              <Tooltip text={usePerDayTimes ? 'Use the same time range for all days' : 'Set different time ranges for each day'}>
                <button
                  type="button"
                  onClick={() => setUsePerDayTimes(!usePerDayTimes)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    usePerDayTimes
                      ? 'bg-violet-100 text-violet-700 border-violet-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {usePerDayTimes ? 'Custom per day' : 'Same every day'}
                </button>
              </Tooltip>
            </div>

            {!usePerDayTimes ? (
              <div className="flex items-center gap-2">
                <Tooltip text="Start time for auto-fill" className="flex-1">
                  <div className="relative">
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 pr-10 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      {TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </Tooltip>
                <span className="text-[13px] text-slate-400">to</span>
                <Tooltip text="End time for auto-fill" className="flex-1">
                  <div className="relative">
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 pr-10 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      {TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </Tooltip>
              </div>
            ) : (
              <div className="space-y-1.5 bg-slate-50 rounded-lg p-3 border border-slate-100">
                {AUTO_FILL_DAYS_LABELS.map((dayLabel, idx) => {
                  if (!selectedDays.includes(idx)) return null;
                  const dayConf = perDayTimes[idx] ?? { enabled: true, startTime: '08:00', endTime: '15:00' };
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <Tooltip text={dayConf.enabled ? `Disable ${dayLabel}` : `Enable ${dayLabel}`}>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dayConf.enabled}
                            onChange={(e) => updatePerDayTime(idx, 'enabled', e.target.checked)}
                            className="w-3.5 h-3.5 accent-violet-500 rounded"
                          />
                        </label>
                      </Tooltip>
                      <span className={`w-8 text-[12px] font-semibold ${dayConf.enabled ? 'text-slate-700' : 'text-slate-400'}`}>
                        {dayLabel}
                      </span>
                      <Tooltip text={`Start time for ${dayLabel}`} className="flex-1">
                        <div className="relative">
                          <select
                            value={dayConf.startTime}
                            onChange={(e) => updatePerDayTime(idx, 'startTime', e.target.value)}
                            disabled={!dayConf.enabled}
                            className={`${timeSelectClasses} disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {TIME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </Tooltip>
                      <span className="text-[11px] text-slate-400">–</span>
                      <Tooltip text={`End time for ${dayLabel}`} className="flex-1">
                        <div className="relative">
                          <select
                            value={dayConf.endTime}
                            onChange={(e) => updatePerDayTime(idx, 'endTime', e.target.value)}
                            disabled={!dayConf.enabled}
                            className={`${timeSelectClasses} disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {TIME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </Tooltip>
                    </div>
                  );
                })}
                {selectedDays.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">Select days above to configure times</p>
                )}
              </div>
            )}
          </div>

          {/* Schedule Pattern */}
          <div>
            <label className="block text-[13px] font-medium text-slate-900 mb-1.5">Schedule Pattern</label>
            <div className="space-y-2">
              <Tooltip text="Cycle through all templates within each day, same order every day">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule-pattern"
                    checked={schedulePattern === 'same'}
                    onChange={() => setSchedulePattern('same')}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <div>
                    <span className="text-[13px] font-medium text-slate-900">Same every day</span>
                    <p className="text-xs text-slate-500">Cycle through all templates in the same order each day</p>
                  </div>
                </label>
              </Tooltip>
              <Tooltip text="Cycle through all templates within each day, shifting the start point each day for variety">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule-pattern"
                    checked={schedulePattern === 'rotating'}
                    onChange={() => setSchedulePattern('rotating')}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <div>
                    <span className="text-[13px] font-medium text-slate-900">Rotating</span>
                    <p className="text-xs text-slate-500">Shifts starting template each day (Day 1: A→B→C, Day 2: B→C→A)</p>
                  </div>
                </label>
              </Tooltip>
              <Tooltip text="Randomly assign templates to time slots each day">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule-pattern"
                    checked={schedulePattern === 'random'}
                    onChange={() => setSchedulePattern('random')}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-slate-900">Random</span>
                    <Shuffle className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </label>
              </Tooltip>
            </div>

            {/* Drag-to-reorder rotation list */}
            {schedulePattern === 'rotating' && templates.length > 0 && (
              <div className="mt-3">
                <Tooltip text="Drag to reorder the rotation sequence">
                  <p className="text-xs text-slate-500 mb-1.5">Drag to set rotation order:</p>
                </Tooltip>
                <div className="space-y-1 bg-slate-50 rounded-lg p-2 border border-slate-100 max-h-[160px] overflow-y-auto">
                  {rotationOrder.map((templateId, idx) => {
                    const tmpl = templates.find((t) => t.id === templateId);
                    if (!tmpl) return null;
                    return (
                      <div
                        key={templateId}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-colors cursor-grab active:cursor-grabbing ${
                          dragIdx === idx
                            ? 'bg-violet-50 border-violet-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tmpl.color }}
                        />
                        <span className="text-[12px] font-medium text-slate-700 truncate">{tmpl.name}</span>
                        <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">#{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fill Strategy */}
          <div>
            <label className="block text-[13px] font-medium text-slate-900 mb-1.5">Fill Strategy</label>
            <div className="space-y-2">
              <Tooltip text="Place templates in every available time slot with no gaps">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="fill-strategy"
                    checked={strategy === 'fill_gaps'}
                    onChange={() => setStrategy('fill_gaps')}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <div>
                    <span className="text-[13px] font-medium text-slate-900">Fill all gaps</span>
                    <p className="text-xs text-slate-500">Place templates in every available time slot</p>
                  </div>
                </label>
              </Tooltip>
              <Tooltip text="Distribute templates with spacing between them for a balanced schedule">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="fill-strategy"
                    checked={strategy === 'spread_evenly'}
                    onChange={() => setStrategy('spread_evenly')}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <div>
                    <span className="text-[13px] font-medium text-slate-900">Spread evenly</span>
                    <p className="text-xs text-slate-500">Distribute templates with spacing between them</p>
                  </div>
                </label>
              </Tooltip>
            </div>
          </div>

          {/* Priority Tags */}
          <div>
            <label className="block text-[13px] font-medium text-slate-900 mb-1.5">
              Prioritize Tags <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SUBJECT_OPTIONS.map((tag) => {
                const active = priorityTags.includes(tag);
                return (
                  <Tooltip key={tag} text={active ? `Remove priority for ${tag}` : `Prioritize ${tag}`}>
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-violet-100 text-violet-700 border-violet-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tag}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose} tooltip="Cancel auto-fill">
            Cancel
          </Button>
          <Tooltip text="Fill empty time slots with templates">
            <button
              onClick={handleFill}
              disabled={isFilling || selectedDays.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-blue-500 text-white hover:bg-blue-600 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFilling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Filling…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Auto-Fill
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Placed Template Block (on week grid)
// ──────────────────────────────────────────────────────────────

function PlacedTemplateBlock({
  placed,
  template,
  onSelect,
  onResize,
  onDelete,
  isSelected,
  dayStartHour,
  dayEndHour,
}: {
  placed: PlacedTemplate;
  template: Template;
  onSelect: () => void;
  onResize: (newStart: number, newDuration: number) => void;
  onDelete: () => void;
  isSelected: boolean;
  dayStartHour: number;
  dayEndHour: number;
}) {
  const [resizing, setResizing] = useState<'top' | 'bottom' | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = (edge: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(edge);
  };

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizing || !blockRef.current) return;

      const gridRect = blockRef.current.closest('.schedule-grid')?.getBoundingClientRect();
      if (!gridRect) return;

      const relativeY = e.clientY - gridRect.top;
      const hourAtMouse = dayStartHour + relativeY / HOUR_HEIGHT;
      const snappedHour = snapToQuarterHour(Math.max(dayStartHour, Math.min(dayEndHour, hourAtMouse)));

      if (resizing === 'top') {
        const newStart = snappedHour;
        const newDuration = (placed.startHour + placed.durationHours) - newStart;
        if (newDuration >= 0.25) {
          onResize(newStart, newDuration);
        }
      } else {
        const newDuration = snappedHour - placed.startHour;
        if (newDuration >= 0.25) {
          onResize(placed.startHour, newDuration);
        }
      }
    },
    [resizing, placed, onResize, dayStartHour, dayEndHour],
  );

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const top = (placed.startHour - dayStartHour) * HOUR_HEIGHT;
  const height = placed.durationHours * HOUR_HEIGHT;

  return (
    <div
      ref={blockRef}
      className={`absolute left-1 right-1 rounded-md overflow-hidden group cursor-pointer transition-shadow ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'
      }`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 24)}px`,
        backgroundColor: `${template.color}20`,
        borderLeft: `3px solid ${template.color}`,
      }}
      onClick={onSelect}
    >
      {/* Top resize handle */}
      <Tooltip text="Drag to adjust start time">
        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleResizeStart('top', e)}
          style={{ backgroundColor: template.color }}
        />
      </Tooltip>

      <Tooltip text={`Click to edit ${getBlockDisplayName(template)}`}>
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold leading-tight flex-1 truncate" style={{ color: template.color }}>
              {formatHour(placed.startHour)} – {formatHour(placed.startHour + placed.durationHours)}
            </p>
            {template.weekCycleLength != null && template.weekCycleLength >= 2 && (
              <Tooltip text={`Runs on Week ${(template.weekInCycle ?? 0) + 1} of a ${template.weekCycleLength}-week cycle`}>
                <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold leading-none bg-indigo-100 text-indigo-600 whitespace-nowrap">
                  W{(template.weekInCycle ?? 0) + 1}/{template.weekCycleLength}
                </span>
              </Tooltip>
            )}
          </div>
          <p className="text-xs font-bold text-slate-900 leading-tight truncate mt-0.5">
            {template.name}
          </p>
          {template.subject && template.subject !== template.name && (
            <p className="text-[11px] text-slate-700 leading-tight truncate">
              {template.subject}
            </p>
          )}
          {height > 48 && template.gradeLevel && (
            <p className="text-[10px] text-slate-600 leading-tight truncate">
              {template.gradeLevel}
            </p>
          )}
          {height > 48 && template.instructor && (
            <p className="text-[10px] text-slate-600 leading-tight truncate">{template.instructor}</p>
          )}
        </div>
      </Tooltip>

      {/* Bottom resize handle */}
      <Tooltip text="Drag to adjust end time">
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleResizeStart('bottom', e)}
          style={{ backgroundColor: template.color }}
        />
      </Tooltip>

      {/* Delete button — always rendered, visible on hover or when selected */}
      <Tooltip text="Remove from grid">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`absolute top-1 right-1 p-0.5 rounded bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all cursor-pointer ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Drag Ghost Preview
// ──────────────────────────────────────────────────────────────

function DragGhostPreview({
  template,
  visible,
}: {
  template: Template | null;
  visible: boolean;
}) {
  if (!visible || !template) return null;

  return (
    <div
      className="fixed pointer-events-none z-[100] opacity-70"
      id="drag-ghost"
      style={{ display: 'none' }}
    >
      <div
        className="px-3 py-2 rounded-md shadow-lg text-xs font-semibold text-white min-w-[120px]"
        style={{ backgroundColor: template.color }}
      >
        {template.name}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// Day Schedule Settings Panel
// ──────────────────────────────────────────────────────────────

function DayScheduleSettings({
  dayStartHour,
  dayEndHour,
  onStartChange,
  onEndChange,
  lunchEnabled,
  lunchStart,
  lunchEnd,
  onLunchEnabledChange,
  onLunchStartChange,
  onLunchEndChange,
  bufferEnabled,
  bufferMinutes,
  onBufferEnabledChange,
  onBufferMinutesChange,
  onClose,
}: {
  dayStartHour: number;
  dayEndHour: number;
  onStartChange: (hour: number) => void;
  onEndChange: (hour: number) => void;
  lunchEnabled: boolean;
  lunchStart: number;
  lunchEnd: number;
  onLunchEnabledChange: (enabled: boolean) => void;
  onLunchStartChange: (hour: number) => void;
  onLunchEndChange: (hour: number) => void;
  bufferEnabled: boolean;
  bufferMinutes: number;
  onBufferEnabledChange: (enabled: boolean) => void;
  onBufferMinutesChange: (minutes: number) => void;
  onClose: () => void;
}) {
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  const formatOption = (h: number) => {
    if (h === 0) return '12:00 AM';
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return '12:00 PM';
    return `${h - 12}:00 PM`;
  };

  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-slate-900">Day Schedule</h4>
        <Tooltip text="Close schedule settings">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-xs"
          >
            Done
          </button>
        </Tooltip>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Start of Day
          </label>
          <Tooltip text="Set the earliest hour displayed on the schedule grid">
            <select
              value={dayStartHour}
              onChange={(e) => onStartChange(Number(e.target.value))}
              className="w-full h-9 px-3 pr-10 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-white cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat"
            >
              {hourOptions.filter((h) => h < dayEndHour).map((h) => (
                <option key={h} value={h}>{formatOption(h)}</option>
              ))}
            </select>
          </Tooltip>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            End of Day
          </label>
          <Tooltip text="Set the latest hour displayed on the schedule grid">
            <select
              value={dayEndHour}
              onChange={(e) => onEndChange(Number(e.target.value))}
              className="w-full h-9 px-3 pr-10 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-white cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat"
            >
              {hourOptions.filter((h) => h > dayStartHour).map((h) => (
                <option key={h} value={h}>{formatOption(h)}</option>
              ))}
            </select>
          </Tooltip>
        </div>

        {/* Lunch Break */}
        <div className="pt-2 border-t border-slate-100">
          <Tooltip text={lunchEnabled ? 'Disable lunch break' : 'Enable lunch break to block off time on the grid'}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lunchEnabled}
                onChange={(e) => onLunchEnabledChange(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500 rounded"
              />
              <Coffee className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[13px] font-medium text-slate-700">Enable Lunch Break</span>
            </label>
          </Tooltip>

          {lunchEnabled && (
            <div className="mt-2.5 space-y-2 pl-6">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Lunch Start
                </label>
                <Tooltip text="When lunch break begins">
                  <select
                    value={lunchStart}
                    onChange={(e) => onLunchStartChange(Number(e.target.value))}
                    className="w-full h-9 px-2.5 pr-10 border border-slate-200 rounded-md text-[12px] leading-normal text-slate-700 bg-white cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat"
                  >
                    {hourOptions.filter((h) => h >= dayStartHour && h < lunchEnd && h < dayEndHour).map((h) => (
                      <option key={h} value={h}>{formatOption(h)}</option>
                    ))}
                  </select>
                </Tooltip>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Lunch End
                </label>
                <Tooltip text="When lunch break ends">
                  <select
                    value={lunchEnd}
                    onChange={(e) => onLunchEndChange(Number(e.target.value))}
                    className="w-full h-9 px-2.5 pr-10 border border-slate-200 rounded-md text-[12px] leading-normal text-slate-700 bg-white cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat"
                  >
                    {hourOptions.filter((h) => h > lunchStart && h <= dayEndHour).map((h) => (
                      <option key={h} value={h}>{formatOption(h)}</option>
                    ))}
                  </select>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {/* Buffer Time */}
        <div className="pt-2 border-t border-slate-100">
          <Tooltip text={bufferEnabled ? 'Disable buffer time between sessions' : 'Add padding time between all sessions for transitions'}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={bufferEnabled}
                onChange={(e) => onBufferEnabledChange(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500 rounded"
              />
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[13px] font-medium text-slate-700">Enable Buffer Time</span>
            </label>
          </Tooltip>

          {bufferEnabled && (
            <div className="mt-2.5 pl-6">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Buffer Duration (minutes)
              </label>
              <Tooltip text="Minimum padding time between sessions (venues may add extra setup/teardown time)">
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="5"
                  value={bufferMinutes}
                  onChange={(e) => onBufferMinutesChange(Number(e.target.value))}
                  className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-[13px] text-slate-700 bg-white"
                />
              </Tooltip>
              <p className="text-[10px] text-slate-400 mt-1">
                Per-venue setup times can be configured in Staff & Venues
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { selectedProgramId } = useProgram();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [placedTemplates, setPlacedTemplates] = useState<PlacedTemplate[]>([]);
  const [draggingTemplate, setDraggingTemplate] = useState<Template | null>(null);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);
  const [editModalTemplate, setEditModalTemplate] = useState<Template | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [dropPreview, setDropPreview] = useState<{ dayIndex: number; hour: number } | null>(null);

  // ── Template CRUD loading state ──

  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);


  // ── Save / Publish state ──

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Day schedule time range ──
  const [dayStartHour, setDayStartHour] = useState(DEFAULT_DAY_START);
  const [dayEndHour, setDayEndHour] = useState(DEFAULT_DAY_END);
  const [showDaySettings, setShowDaySettings] = useState(false);

  // ── Lunch break ──
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [lunchStart, setLunchStart] = useState(12); // hour (e.g. 12 = noon)
  const [lunchEnd, setLunchEnd] = useState(13);     // hour (e.g. 13 = 1 PM)

  // ── Buffer time ──
  const [bufferEnabled, setBufferEnabled] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState(15);

  // ── Fetch templates from API ──

  const fetchTemplates = useCallback(async () => {
    if (!selectedProgramId) return;
    setIsLoadingTemplates(true);
    try {
      const res = await fetch(`/api/templates?program_id=${encodeURIComponent(selectedProgramId)}&_t=${Date.now()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load templates (${res.status})`);
      }
      const { templates: dbTemplates } = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTemplates((dbTemplates ?? []).map((t: Record<string, any>, i: number) => fromDbTemplate(t, i)));
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load templates',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [selectedProgramId]);

  // ── Fetch saved placements from API ──

  const fetchPlacements = useCallback(async () => {
    if (!selectedProgramId) return;
    try {
      const res = await fetch(`/api/templates/placements?program_id=${encodeURIComponent(selectedProgramId)}&_t=${Date.now()}`);
      if (!res.ok) return; // silently skip if endpoint not available
      const { placements: dbPlacements } = await res.json();
      if (Array.isArray(dbPlacements) && dbPlacements.length > 0) {
        setPlacedTemplates(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dbPlacements.map((p: any) => ({
            id: p.id ?? `placed-${Date.now()}-${Math.random()}`,
            templateId: p.template_id,
            dayIndex: p.day_index,
            startHour: p.start_hour,
            durationHours: p.duration_hours,
          })),
        );
      }
    } catch {
      // Non-critical — placements will just start empty
    }
  }, [selectedProgramId]);

  const fetchBufferSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const enabled = data.settings?.buffer_time_enabled ?? false;
        const minutes = data.settings?.buffer_time_minutes ?? 15;
        setBufferEnabled(enabled);
        setBufferMinutes(minutes);
      }
    } catch {
      // Non-critical — will use defaults
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchPlacements();
    fetchBufferSettings();
  }, [fetchTemplates, fetchPlacements, fetchBufferSettings]);

  // Warn on navigate-away when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Buffer time handlers ──
  const handleBufferEnabledChange = async (enabled: boolean) => {
    setBufferEnabled(enabled);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buffer_time_enabled: enabled,
          buffer_time_minutes: bufferMinutes,
        }),
      });
    } catch {
      // silently fail — UI will reflect the change even if save fails
    }
  };

  const handleBufferMinutesChange = async (minutes: number) => {
    setBufferMinutes(minutes);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buffer_time_enabled: bufferEnabled,
          buffer_time_minutes: minutes,
        }),
      });
    } catch {
      // silently fail
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedProgramId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/templates/placements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: selectedProgramId,
          placements: placedTemplates.map((p) => ({
            templateId: p.templateId,
            dayIndex: p.dayIndex,
            startHour: p.startHour,
            durationHours: p.durationHours,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save schedule');
      }
      setIsDirty(false);
      setToast({ message: 'Weekly schedule saved!', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to save schedule. Please try again.',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishSchedule = async () => {
    if (!selectedProgramId) return;
    setIsPublishing(true);
    setShowPublishConfirm(false);
    try {
      const res = await fetch('/api/templates/placements/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: selectedProgramId,
          placements: placedTemplates.map((p) => ({
            templateId: p.templateId,
            dayIndex: p.dayIndex,
            startHour: p.startHour,
            durationHours: p.durationHours,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to publish schedule');
      }
      const { sessions_created } = await res.json();
      setToast({
        message: `Schedule published! ${sessions_created} session${sessions_created === 1 ? '' : 's'} created.`,
        type: 'success',
        id: Date.now(),
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to publish schedule. Please try again.',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Auto-Fill ──

  const handleAutoFill = async (settings: AutoFillSettings) => {
    if (templates.length === 0) {
      setToast({ message: 'No templates available to fill schedule', type: 'error', id: Date.now() });
      return;
    }

    setIsAutoFilling(true);
    // Brief delay for UX feedback
    await new Promise((r) => setTimeout(r, 500));

    // Map selected auto-fill days to grid dayIndices (only Mon–Fri exist on the grid)
    const gridDays = settings.selectedDays
      .map((d) => AUTO_FILL_DAY_TO_GRID[d])
      .filter((d): d is number => d !== undefined);

    if (gridDays.length === 0) {
      setToast({ message: 'No valid weekdays selected', type: 'error', id: Date.now() });
      setIsAutoFilling(false);
      return;
    }

    // Resolve per-day time ranges: if custom, filter out disabled days
    const getTimeRange = (autoFillDayIdx: number): { start: number; end: number } | null => {
      if (settings.usePerDayTimes) {
        const conf = settings.perDayTimes[autoFillDayIdx];
        if (!conf || !conf.enabled) return null;
        const s = timeStringToHour(conf.startTime);
        const e = timeStringToHour(conf.endTime);
        return e > s ? { start: s, end: e } : null;
      }
      const s = timeStringToHour(settings.startTime);
      const e = timeStringToHour(settings.endTime);
      return e > s ? { start: s, end: e } : null;
    };

    // Validate that at least one day has a valid time range
    const validDays = settings.selectedDays.filter((d) => getTimeRange(d) !== null);
    if (validDays.length === 0) {
      setToast({ message: 'End time must be after start time', type: 'error', id: Date.now() });
      setIsAutoFilling(false);
      return;
    }

    const getTemplateDuration = (t: Template): number => {
      if (t.timeSlot) {
        const s = timeStringToHour(t.timeSlot.start);
        const e = timeStringToHour(t.timeSlot.end);
        if (e > s) return e - s;
      }
      return 1;
    };

    // Build template list based on schedule pattern
    // Both 'same' and 'rotating' cycle through ALL templates within each day.
    // 'same' uses the same order every day; 'rotating' shifts the starting point each day.
    const buildTemplateListForDay = (daySeqIndex: number): Template[] => {
      // Sort templates: priority tags first, then by name
      const sortedTemplates = [...templates].sort((a, b) => {
        const aPri = settings.priorityTags.length > 0 && settings.priorityTags.includes(a.subject ?? '') ? 0 : 1;
        const bPri = settings.priorityTags.length > 0 && settings.priorityTags.includes(b.subject ?? '') ? 0 : 1;
        if (aPri !== bPri) return aPri - bPri;
        return a.name.localeCompare(b.name);
      });

      if (settings.schedulePattern === 'same') {
        // Same order every day — cycles through all templates within each day
        return sortedTemplates;
      }

      if (settings.schedulePattern === 'rotating') {
        // Use rotation order, shifted by daySeqIndex so each day starts at a different template
        const rotationIds = settings.rotationOrder.filter((id) => templates.some((t) => t.id === id));
        if (rotationIds.length === 0) return sortedTemplates;
        const offset = daySeqIndex % rotationIds.length;
        const rotated = [...rotationIds.slice(offset), ...rotationIds.slice(0, offset)];
        return rotated.map((id) => templates.find((t) => t.id === id)!).filter(Boolean);
      }

      if (settings.schedulePattern === 'random') {
        // Fisher-Yates shuffle
        const shuffled = [...sortedTemplates];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      }

      return sortedTemplates;
    };

    const newPlacements: PlacedTemplate[] = [];
    let daysAffected = 0;

    // Track the sequential day index (for rotation)
    let daySeqIndex = 0;

    for (const autoFillDayIdx of settings.selectedDays) {
      const dayIndex = AUTO_FILL_DAY_TO_GRID[autoFillDayIdx];
      if (dayIndex === undefined) continue;

      const range = getTimeRange(autoFillDayIdx);
      if (!range) { daySeqIndex++; continue; }
      const { start: rangeStart, end: rangeEnd } = range;

      // Get all existing placements on this day, sorted by start
      const existingOnDay = [...placedTemplates, ...newPlacements]
        .filter((p) => p.dayIndex === dayIndex)
        .sort((a, b) => a.startHour - b.startHour);

      // Find gaps within the time range
      const gaps: { start: number; end: number }[] = [];
      let cursor = rangeStart;

      for (const p of existingOnDay) {
        const pStart = p.startHour;
        const pEnd = p.startHour + p.durationHours;
        // Only consider placements that overlap the range
        if (pEnd <= rangeStart || pStart >= rangeEnd) continue;

        const gapStart = Math.max(cursor, rangeStart);
        const gapEnd = Math.min(pStart, rangeEnd);
        if (gapEnd > gapStart + 0.2) {
          gaps.push({ start: gapStart, end: gapEnd });
        }
        cursor = Math.max(cursor, pEnd);
      }
      // Trailing gap
      if (cursor < rangeEnd) {
        const gapStart = Math.max(cursor, rangeStart);
        if (rangeEnd > gapStart + 0.2) {
          gaps.push({ start: gapStart, end: rangeEnd });
        }
      }

      if (gaps.length === 0) { daySeqIndex++; continue; }

      const dayTemplates = buildTemplateListForDay(daySeqIndex);
      let dayPlaced = 0;
      // Use a cycling index so templates rotate: Slot1=T0, Slot2=T1, ... wrapping around
      let templateIdx = 0;

      // Helper: find the next template in cycle that fits the available duration
      const pickNextTemplate = (maxDuration: number): Template | null => {
        for (let i = 0; i < dayTemplates.length; i++) {
          const candidate = dayTemplates[(templateIdx + i) % dayTemplates.length];
          if (getTemplateDuration(candidate) <= maxDuration + 0.01) {
            templateIdx = (templateIdx + i + 1) % dayTemplates.length;
            return candidate;
          }
        }
        return null;
      };

      for (const gap of gaps) {
        if (settings.strategy === 'spread_evenly') {
          // Place one template centered in each gap
          const gapDuration = gap.end - gap.start;
          const pick = pickNextTemplate(gapDuration);
          if (!pick) continue;

          const dur = getTemplateDuration(pick);
          // Center the template in the gap, snapped to 15-min
          const offset = Math.floor(((gapDuration - dur) / 2) * 4) / 4;
          newPlacements.push({
            id: `placed-${Date.now()}-${Math.random()}`,
            templateId: pick.id,
            dayIndex,
            startHour: gap.start + offset,
            durationHours: dur,
          });
          dayPlaced++;
        } else {
          // Fill all gaps — pack templates greedily, cycling through the template list
          let currentTime = gap.start;
          while (currentTime < gap.end - 0.2) {
            const remaining = gap.end - currentTime;
            const pick = pickNextTemplate(remaining);
            if (!pick) break;

            const dur = getTemplateDuration(pick);
            newPlacements.push({
              id: `placed-${Date.now()}-${Math.random()}`,
              templateId: pick.id,
              dayIndex,
              startHour: currentTime,
              durationHours: dur,
            });
            currentTime += dur;
            dayPlaced++;
          }
        }
      }

      if (dayPlaced > 0) daysAffected++;
      daySeqIndex++;
    }

    if (newPlacements.length === 0) {
      setToast({ message: 'No empty slots found in the selected time range', type: 'error', id: Date.now() });
      setIsAutoFilling(false);
      return;
    }

    setPlacedTemplates((prev) => [...prev, ...newPlacements]);
    setIsDirty(true);
    setShowAutoFillModal(false);
    setIsAutoFilling(false);
    setToast({
      message: `Auto-filled ${newPlacements.length} session${newPlacements.length === 1 ? '' : 's'} across ${daysAffected} day${daysAffected === 1 ? '' : 's'}`,
      type: 'success',
      id: Date.now(),
    });
  };

  // ── Drag & Drop ──

  const handleDragStart = (template: Template) => {
    setDraggingTemplate(template);
  };

  const handleDragEnd = () => {
    setDraggingTemplate(null);
    setDropPreview(null);
  };

  const handleDragOver = (dayIndex: number, e: React.DragEvent) => {
    e.preventDefault();

    const gridRect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const hourAtMouse = dayStartHour + relativeY / HOUR_HEIGHT;
    const snappedHour = snapToQuarterHour(Math.max(dayStartHour, Math.min(dayEndHour - 1, hourAtMouse)));

    // Compute duration for overlap check
    let durationHours = 1;
    if (draggingTemplate?.timeSlot) {
      const start = timeStringToHour(draggingTemplate.timeSlot.start);
      const end = timeStringToHour(draggingTemplate.timeSlot.end);
      if (end > start) durationHours = end - start;
    }

    if (overlapsLunch(snappedHour, durationHours, lunchEnabled, lunchStart, lunchEnd)) {
      e.dataTransfer.dropEffect = 'none';
      setDropPreview(null);
      return;
    }

    e.dataTransfer.dropEffect = 'copy';
    setDropPreview({ dayIndex, hour: snappedHour });
  };

  const handleDragLeave = () => {
    setDropPreview(null);
  };

  const handleDrop = (dayIndex: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropPreview(null);

    const templateToPlace = draggingTemplate ?? templates.find((t) => t.id === e.dataTransfer.getData('text/plain'));
    if (!templateToPlace) return;

    const gridRect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const hourAtMouse = dayStartHour + relativeY / HOUR_HEIGHT;
    const startHour = snapToQuarterHour(Math.max(dayStartHour, Math.min(dayEndHour - 1, hourAtMouse)));

    // Compute duration from template's time slot or default to 1h
    let durationHours = 1;
    if (templateToPlace.timeSlot) {
      const start = timeStringToHour(templateToPlace.timeSlot.start);
      const end = timeStringToHour(templateToPlace.timeSlot.end);
      if (end > start) durationHours = end - start;
    }

    // Block placement during lunch
    if (overlapsLunch(startHour, durationHours, lunchEnabled, lunchStart, lunchEnd)) {
      setDraggingTemplate(null);
      return;
    }

    const newPlaced: PlacedTemplate = {
      id: `placed-${Date.now()}-${Math.random()}`,
      templateId: templateToPlace.id,
      dayIndex,
      startHour,
      durationHours,
    };

    setPlacedTemplates((prev) => [...prev, newPlaced]);
    setDraggingTemplate(null);
    setIsDirty(true);
  };

  // ── Placed template operations ──

  const handleResizePlaced = (placedId: string, newStart: number, newDuration: number) => {
    // Block resizing into lunch
    if (overlapsLunch(newStart, newDuration, lunchEnabled, lunchStart, lunchEnd)) return;

    setPlacedTemplates((prev) =>
      prev.map((p) => (p.id === placedId ? { ...p, startHour: newStart, durationHours: newDuration } : p)),
    );
    setIsDirty(true);
  };

  const handleDeletePlaced = (placedId: string) => {
    setPlacedTemplates((prev) => prev.filter((p) => p.id !== placedId));
    setSelectedPlacedId(null);
    setIsDirty(true);
  };

  // ── Template CRUD ──

  const handleCreateTemplate = () => {
    const newT = emptyTemplate();
    newT.id = `t-${Date.now()}`;
    newT.color = TEMPLATE_COLORS[templates.length % TEMPLATE_COLORS.length];
    setEditModalTemplate(newT);
    setIsNewTemplate(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditModalTemplate(template);
    setIsNewTemplate(false);
  };

  const handleSaveTemplate = async (updated: Template) => {
    if (!selectedProgramId) return;
    setIsSavingTemplate(true);
    try {
      const payload = toDbPayload(updated, selectedProgramId);

      if (isNewTemplate) {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Failed to create template');
        }
        const { template: created } = await res.json();
        // Use server-generated ID; preserve UI-only fields from form
        const newTemplate: Template = {
          ...updated,
          id: created.id,
          venue: created.venue?.name ?? updated.venue ?? '',
        };
        setTemplates((prev) => [...prev, newTemplate]);
        setToast({ message: 'Template created', type: 'success', id: Date.now() });
      } else {
        const res = await fetch(`/api/templates/${encodeURIComponent(updated.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Failed to update template');
        }
        // Preserve UI-only fields from form, keep server state in sync
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? { ...updated } : t)));
        setToast({ message: 'Template updated', type: 'success', id: Date.now() });
      }

      setEditModalTemplate(null);
      setIsNewTemplate(false);
      setIsDirty(true);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to save template',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setDeletingTemplateId(id);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to delete template');
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      // Also remove all placed instances of this template
      setPlacedTemplates((prev) => prev.filter((p) => p.templateId !== id));
      setIsDirty(true);
      setToast({ message: 'Template deleted', type: 'success', id: Date.now() });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete template',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  if (!selectedProgramId) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">Select a program to manage templates.</p>
      </div>
    );
  }

  const templateListItems: TemplateListItem[] = templates.map((t) => ({
    id: t.id,
    name: getBlockDisplayName(t),
    dayLabel: t.days.length === 5
      ? 'Mon\u2013Fri'
      : t.days.map((d) => DAYS_SHORT[d]).join('/'),
    timeLabel: formatTimeSlot(t.timeSlot),
    gradeGroups: t.gradeLevel ? [t.gradeLevel] : [],
    instructor: t.instructor,
    venue: t.venue,
    instructorRotation: t.instructorRotation,
    color: t.color,
    tags: t.requiredSkills ?? [],
    scheduleLabel: formatSchedule(t),
    cycleBadge: t.weekCycleLength != null && t.weekCycleLength >= 2
      ? {
          label: `W${(t.weekInCycle ?? 0) + 1}/${t.weekCycleLength}`,
          tooltip: `Runs on Week ${(t.weekInCycle ?? 0) + 1} of a ${t.weekCycleLength}-week cycle`,
        }
      : null,
  }));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white px-8 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Schedule Builder</h1>
              <Tooltip text="Step 1: Create event templates (or edit existing ones) &#10;Step 2: Drag them onto the weekly grid to set recurring times &#10;Step 3: Click Publish Schedule to generate calendar sessions">
                <Info className="w-4.5 h-4.5 text-slate-400 hover:text-blue-500 cursor-help transition-colors" />
              </Tooltip>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Build a weekly schedule template. This pattern will repeat when you publish to the calendar.
            </p>
          </div>
          {isDirty && (
            <Tooltip text="You have unsaved changes">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-medium text-amber-600">Unsaved</span>
              </span>
            </Tooltip>
          )}
          {/* Day Schedule Settings */}
          <div className="relative">
            <Tooltip text="Day Start/End Times">
              <button
                onClick={() => setShowDaySettings(!showDaySettings)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                  showDaySettings ? 'bg-blue-50 text-blue-500' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Day Start/End Times</span>
              </button>
            </Tooltip>
            {showDaySettings && (
              <DayScheduleSettings
                dayStartHour={dayStartHour}
                dayEndHour={dayEndHour}
                onStartChange={setDayStartHour}
                onEndChange={setDayEndHour}
                lunchEnabled={lunchEnabled}
                lunchStart={lunchStart}
                lunchEnd={lunchEnd}
                onLunchEnabledChange={setLunchEnabled}
                onLunchStartChange={setLunchStart}
                onLunchEndChange={setLunchEnd}
                bufferEnabled={bufferEnabled}
                bufferMinutes={bufferMinutes}
                onBufferEnabledChange={handleBufferEnabledChange}
                onBufferMinutesChange={handleBufferMinutesChange}
                onClose={() => setShowDaySettings(false)}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip text="Remove all template placements from the weekly grid">
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={placedTemplates.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-white text-red-600 hover:bg-red-50 border border-red-300 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Clear Schedule
            </button>
          </Tooltip>
          <Tooltip text="Automatically assign events to empty time slots">
            <button
              onClick={() => setShowAutoFillModal(true)}
              disabled={templates.length === 0 || isAutoFilling}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-violet-500 text-white hover:bg-violet-600 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              Auto-Fill
            </button>
          </Tooltip>
          <Button
            variant="primary"
            icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            onClick={handleSaveSchedule}
            disabled={!isDirty || isSaving || isPublishing}
            tooltip="Save template placements to weekly schedule"
          >
            {isSaving ? 'Saving…' : 'Save Schedule'}
          </Button>
          <Tooltip text="Generate calendar sessions from template schedule">
            <button
              onClick={() => setShowPublishConfirm(true)}
              disabled={isDirty || isPublishing || isSaving || placedTemplates.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isPublishing ? 'Publishing…' : 'Publish Schedule'}
            </button>
          </Tooltip>
          <div className="w-px h-8 bg-slate-200" />
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateTemplate}
            tooltip="Create a new template"
          >
            Create Template
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Week Grid */}
        <div className="mx-8 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-slate-900">Your Weekly Template</h2>
            <p className="text-sm text-slate-500">— Drag templates from below to build your ideal week</p>
          </div>
        </div>
        <div className="mx-8 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex min-w-full">
            {/* Time column */}
            <div className="shrink-0" style={{ width: TIME_COL_WIDTH }}>
              <div className="h-12 border-b border-slate-200" />
              {Array.from({ length: dayEndHour - dayStartHour }).map((_, i) => {
                const hour = dayStartHour + i;
                const isLunch = isLunchHour(hour, lunchEnabled, lunchStart, lunchEnd);
                return (
                  <div
                    key={hour}
                    className={`relative border-b border-slate-100 ${isLunch ? 'bg-amber-50/60' : ''}`}
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className={`absolute -top-2 right-3 text-xs font-medium ${isLunch ? 'text-amber-500' : 'text-slate-500'}`}>
                      {formatHour(hour)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex-1 min-w-[160px] border-l border-slate-200">
                {/* Day header */}
                <div className="h-12 border-b border-slate-200 flex items-center justify-center">
                  <Tooltip text={`Drag templates here to schedule on ${day}`}>
                    <span className="text-sm font-semibold text-slate-700">{day}</span>
                  </Tooltip>
                </div>

                {/* Schedule grid */}
                <div
                  className="schedule-grid relative"
                  style={{ height: (dayEndHour - dayStartHour) * HOUR_HEIGHT }}
                  onDrop={(e) => handleDrop(dayIndex, e)}
                  onDragOver={(e) => handleDragOver(dayIndex, e)}
                  onDragLeave={handleDragLeave}
                >
                  {/* Hour rows */}
                  {Array.from({ length: dayEndHour - dayStartHour }).map((_, i) => {
                    const hour = dayStartHour + i;
                    const isLunch = isLunchHour(hour, lunchEnabled, lunchStart, lunchEnd);
                    return (
                      <div
                        key={i}
                        className={`border-b border-slate-100 ${isLunch ? 'bg-amber-50/50' : ''}`}
                        style={{ height: HOUR_HEIGHT }}
                      />
                    );
                  })}

                  {/* Lunch overlay */}
                  {lunchEnabled && lunchStart >= dayStartHour && lunchStart < dayEndHour && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none flex items-center justify-center z-[1]"
                      style={{
                        top: `${(lunchStart - dayStartHour) * HOUR_HEIGHT}px`,
                        height: `${(Math.min(lunchEnd, dayEndHour) - lunchStart) * HOUR_HEIGHT}px`,
                      }}
                    >
                      <div className="bg-amber-100 border border-dashed border-amber-300 rounded-md px-3 py-1">
                        <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                          <Coffee className="w-3 h-3" />
                          Lunch
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Drop preview ghost */}
                  {dropPreview && dropPreview.dayIndex === dayIndex && draggingTemplate && (
                    <div
                      className="absolute left-1 right-1 rounded-md border-2 border-dashed pointer-events-none transition-all duration-75"
                      style={{
                        top: `${(dropPreview.hour - dayStartHour) * HOUR_HEIGHT}px`,
                        height: `${HOUR_HEIGHT}px`,
                        borderColor: draggingTemplate.color,
                        backgroundColor: `${draggingTemplate.color}15`,
                      }}
                    >
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-bold" style={{ color: draggingTemplate.color }}>
                          {formatHour(dropPreview.hour)}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 truncate">
                          {getBlockDisplayName(draggingTemplate)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Placed templates */}
                  {placedTemplates
                    .filter((p) => p.dayIndex === dayIndex)
                    .map((placed) => {
                      const template = templates.find((t) => t.id === placed.templateId);
                      if (!template) return null;
                      return (
                        <PlacedTemplateBlock
                          key={placed.id}
                          placed={placed}
                          template={template}
                          onSelect={() => {
                            setSelectedPlacedId(placed.id === selectedPlacedId ? null : placed.id);
                            handleEditTemplate(template);
                          }}
                          onResize={(newStart, newDuration) =>
                            handleResizePlaced(placed.id, newStart, newDuration)
                          }
                          onDelete={() => handleDeletePlaced(placed.id)}
                          isSelected={selectedPlacedId === placed.id}
                          dayStartHour={dayStartHour}
                          dayEndHour={dayEndHour}
                        />
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Template Library */}
        <div className="mx-8 mt-8 mb-8 p-5 bg-slate-50/80 rounded-xl border border-slate-200/60">
          <TemplateList
            mode="draggable"
            templates={templateListItems}
            loading={isLoadingTemplates}
            onEdit={(id) => {
              const t = templates.find((t) => t.id === id);
              if (t) handleEditTemplate(t);
            }}
            onDelete={handleDeleteTemplate}
            onDragStart={(id) => {
              const t = templates.find((t) => t.id === id);
              if (t) handleDragStart(t);
            }}
            onDragEnd={handleDragEnd}
            deletingId={deletingTemplateId}
          />
        </div>
      </div>

      {/* Drag ghost */}
      <DragGhostPreview template={draggingTemplate} visible={!!draggingTemplate} />

      {/* Edit modal */}
      {editModalTemplate && (
        <EditTemplateModal
          template={editModalTemplate}
          isNew={isNewTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setEditModalTemplate(null);
            setIsNewTemplate(false);
          }}
          isSaving={isSavingTemplate}
        />
      )}

      {/* Auto-Fill modal */}
      {showAutoFillModal && (
        <AutoFillModal
          onFill={handleAutoFill}
          onClose={() => {
            setShowAutoFillModal(false);
            setIsAutoFilling(false);
          }}
          isFilling={isAutoFilling}
          templates={templates}
        />
      )}

      {/* Publish confirmation dialog */}
      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <Tooltip text="Click to close">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowPublishConfirm(false)} />
          </Tooltip>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[440px] mx-4">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-900">Publish Schedule</h3>
              <p className="mt-2 text-sm text-slate-600">
                This will generate <span className="font-semibold">{placedTemplates.length} calendar session{placedTemplates.length === 1 ? '' : 's'}</span> from the current template placements. Sessions will be created as drafts for the upcoming week.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to continue?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setShowPublishConfirm(false)} tooltip="Cancel and go back">
                Cancel
              </Button>
              <Tooltip text="Publish schedule and create sessions">
                <button
                  onClick={handlePublishSchedule}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 border border-transparent"
                >
                  <Send className="w-4 h-4" />
                  Publish
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Clear schedule confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <Tooltip text="Click to close">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowClearConfirm(false)} />
          </Tooltip>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[440px] mx-4">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-900">Clear Schedule</h3>
              <p className="mt-2 text-sm text-slate-600">
                Clear all template placements? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setShowClearConfirm(false)} tooltip="Cancel and keep schedule">
                Cancel
              </Button>
              <Tooltip text="Remove all placements from the grid">
                <button
                  onClick={() => {
                    setPlacedTemplates([]);
                    setSelectedPlacedId(null);
                    setIsDirty(true);
                    setShowClearConfirm(false);
                    setToast({ message: 'Schedule cleared', type: 'success', id: Date.now() });
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-red-500 text-white hover:bg-red-600 border border-transparent"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
