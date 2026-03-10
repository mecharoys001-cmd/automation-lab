'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical, Pencil, Trash2, X, ChevronDown, Save, Send, Loader2, Check, AlertTriangle, Wand2, Zap, RefreshCw, Shuffle, Clock, Coffee, Info, Lock, Calendar } from 'lucide-react';
import { useProgram } from '../ProgramContext';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { VenueToggle } from '../../components/ui/VenueToggle';
import { TemplateList } from '../../components/templates/TemplateList';
import type { TemplateListItem } from '../../components/templates/TemplateList';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  gradeLevel?: string;

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
  /** Maps from DB required_skills */
  subjects?: string[] | null;
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
  /** Which week this placement belongs to (0-indexed). Default 0. */
  weekIndex: number;
  /** The venue this placement was assigned to (may differ from template's venueId). */
  venueId?: string | null;
}

interface Conflict {
  id: string;
  type: 'venue' | 'instructor';
  message: string;
  placedIds: string[];
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOUR_HEIGHT = 60;
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

const LANE_BACKGROUNDS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

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
  const hasTime = db.start_time != null && db.end_time != null;
  const timeSlot = hasTime
    ? { start: (db.start_time as string).slice(0, 5), end: (db.end_time as string).slice(0, 5) }
    : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const venue = db.venue as Record<string, any> | null;

  return {
    id: db.id as string,
    name: (() => {
      const subject = (db.required_skills as string[] | null)?.[0] ?? '';
      const grade = gradeGroups.join(', ');
      if (subject && grade) return `${subject} - ${grade}`;
      if (subject) return subject;
      if (grade) return grade;
      return 'Untitled Template';
    })(),
    gradeLevel: gradeGroups[0] ?? '',
    instructor: '',
    venue: (venue?.name as string) ?? '',
    days: db.day_of_week != null ? [db.day_of_week as number] : [],
    timeSlot,
    instructorRotation: db.rotation_mode === 'rotate',
    color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
    weekCycleLength: (db.week_cycle_length as number | null) ?? null,
    weekInCycle: (db.week_in_cycle as number | null) ?? null,
    // Preserve DB fields for round-trip fidelity
    gradeGroups,
    instructorId: (db.instructor_id as string | null) ?? null,
    venueId: (db.venue_id as string | null) ?? null,
    templateType: (db.template_type as string) ?? 'fully_defined',
    subjects: (db.required_skills as string[] | null) ?? null,
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
    required_skills: t.subjects ?? null,
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

/** Build a short display name that includes subject AND grade for distinguishing blocks. */
function getBlockDisplayName(template: Template): string {
  const subject = template.subjects?.join(', ') || template.name;
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
  venues,
}: {
  template: Template;
  isNew: boolean;
  onSave: (t: Template) => void;
  onClose: () => void;
  isSaving?: boolean;
  venues?: { id: string; name: string }[];
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
            <div>
              <label className="block text-[13px] font-medium text-slate-900 mb-1.5">Venue</label>
              <Tooltip text="Assign a room or location for this template" className="block">
                <div className="relative">
                  <select
                    value={local.venueId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const name = venues?.find((v) => v.id === id)?.name ?? '';
                      setLocal((prev) => ({ ...prev, venueId: id, venue: name }));
                    }}
                    className="w-full h-10 bg-white rounded-lg border border-slate-200 px-3 pr-10 text-[13px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No venue</option>
                    {(venues ?? []).map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </Tooltip>
            </div>
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
              value={local.subjects?.[0] ?? ''}
              onChange={(v) => update('subjects', v ? [v] : [])}
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
  onDragStart,
  onDragEnd,
  isSelected,
  isDragging,
  dayStartHour,
  dayEndHour,
  hasConflict,
  conflictMessages,
}: {
  placed: PlacedTemplate;
  template: Template;
  onSelect: () => void;
  onResize: (newStart: number, newDuration: number) => void;
  onDelete: () => void;
  onDragStart: (placedId: string, templateId: string) => void;
  onDragEnd: () => void;
  isSelected: boolean;
  isDragging: boolean;
  dayStartHour: number;
  dayEndHour: number;
  hasConflict?: boolean;
  conflictMessages?: string[];
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/placed-event', JSON.stringify({ placedId: placed.id, templateId: template.id }));
        e.dataTransfer.effectAllowed = 'move';
        // Create ghost image
        const ghost = document.getElementById('drag-ghost');
        if (ghost) {
          ghost.style.display = 'block';
          e.dataTransfer.setDragImage(ghost, 60, 16);
          requestAnimationFrame(() => { ghost.style.display = 'none'; });
        }
        onDragStart(placed.id, template.id);
      }}
      onDragEnd={onDragEnd}
      className={`absolute left-0.5 right-0.5 rounded-md overflow-hidden group cursor-grab transition-shadow flex flex-col justify-start ${
        isDragging ? 'opacity-30' : ''
      } ${
        hasConflict
          ? 'ring-2 ring-red-500 shadow-lg'
          : isSelected
            ? 'ring-2 ring-blue-500 shadow-lg'
            : 'hover:shadow-md'
      }`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 24)}px`,
        backgroundColor: hasConflict ? '#FEF2F2' : `${template.color}20`,
        borderLeft: `3px solid ${hasConflict ? '#EF4444' : template.color}`,
      }}
      title={hasConflict && conflictMessages?.length ? conflictMessages.join('\n') : undefined}
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

      <Tooltip text={hasConflict && conflictMessages?.length ? conflictMessages.join(' | ') : template.timeSlot ? `Fixed time: ${formatHour(timeStringToHour(template.timeSlot.start))} – ${formatHour(timeStringToHour(template.timeSlot.end))} (drag to change day)` : `Drag to move · Click to edit`}>
        <div className="px-1.5 py-0.5 overflow-hidden" style={{ textDecoration: 'none' }}>
          <div className="flex items-start gap-0.5">
            <GripVertical className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 shrink-0 mt-0.5 cursor-grab" />
            <p className={`${height < 45 ? 'text-[9px]' : 'text-[11px]'} font-bold text-slate-900 leading-tight truncate flex-1`}>
              {getBlockDisplayName(template)}
            </p>
            {template.timeSlot && (
              <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
            )}
          </div>
          <div className="flex items-center gap-0.5 mt-0.5">
            {hasConflict && (
              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
            )}
            <p className={`${height < 45 ? 'text-[9px]' : 'text-[11px]'} font-bold leading-tight flex-1 truncate`} style={{ color: hasConflict ? '#EF4444' : template.color }}>
              {formatHour(placed.startHour)} – {formatHour(placed.startHour + placed.durationHours)}
            </p>
            {template.weekCycleLength != null && template.weekCycleLength >= 2 && (
              <Tooltip text={`Runs on Week ${(template.weekInCycle ?? 0) + 1} of a ${template.weekCycleLength}-week cycle`}>
                <span className="inline-flex items-center px-0.5 py-0 rounded text-[8px] font-bold leading-tight bg-indigo-100 text-indigo-600 whitespace-nowrap">
                  W{(template.weekInCycle ?? 0) + 1}/{template.weekCycleLength}
                </span>
              </Tooltip>
            )}
          </div>
          {height > 40 && template.subjects && template.subjects.length > 0 && template.subjects.join(', ') !== template.name && (
            <p className="text-[10px] text-slate-700 leading-tight truncate">
              {template.subjects.join(', ')}
            </p>
          )}
          {height > 50 && template.gradeLevel && (
            <p className="text-[9px] text-slate-600 leading-tight truncate">
              {template.gradeLevel}
            </p>
          )}
          {height > 50 && template.instructor && (
            <p className="text-[9px] text-slate-600 leading-tight truncate">{template.instructor}</p>
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
        {getBlockDisplayName(template)}
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
  const [draggingPlacedId, setDraggingPlacedId] = useState<string | null>(null);
  const [dropConflict, setDropConflict] = useState<'none' | 'venue' | 'instructor' | 'lunch' | 'fixed-time'>('none');

  // ── Venue scoping ──
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);

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
  const [hasSessions, setHasSessions] = useState(true); // assume true to hide CTA until checked

  // ── Day schedule time range ──
  const [dayStartHour, setDayStartHour] = useState(DEFAULT_DAY_START);
  const [dayEndHour, setDayEndHour] = useState(DEFAULT_DAY_END);
  const [showDaySettings, setShowDaySettings] = useState(false);

  // ── Lunch break ──
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [lunchStart, setLunchStart] = useState(12); // hour (e.g. 12 = noon)
  const [lunchEnd, setLunchEnd] = useState(13);     // hour (e.g. 13 = 1 PM)

  // ── Multi-week ──
  const [totalWeeks, setTotalWeeks] = useState(1);

  // ── Conflict detection ──
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showConflictPanel, setShowConflictPanel] = useState(false);

  const conflictingPlacedIds = new Set(conflicts.flatMap((c) => c.placedIds));

  const detectConflicts = useCallback(
    (placements: PlacedTemplate[], tpls: Template[]): Conflict[] => {
      const found: Conflict[] = [];

      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          const p1 = placements[i];
          const p2 = placements[j];

          // Must be on same day and same week
          if (p1.dayIndex !== p2.dayIndex || (p1.weekIndex ?? 0) !== (p2.weekIndex ?? 0)) continue;

          const t1 = tpls.find((t) => t.id === p1.templateId);
          const t2 = tpls.find((t) => t.id === p2.templateId);
          if (!t1 || !t2) continue;

          // Check time overlap
          const p1End = p1.startHour + p1.durationHours;
          const p2End = p2.startHour + p2.durationHours;
          const overlaps = p1.startHour < p2End && p2.startHour < p1End;
          if (!overlaps) continue;

          const dayName = DAYS[p1.dayIndex] ?? `Day ${p1.dayIndex}`;

          // Venue conflict: same venue (use placed.venueId if available)
          const v1 = p1.venueId ?? t1.venueId;
          const v2 = p2.venueId ?? t2.venueId;
          if (v1 && v2 && v1 === v2) {
            const venueName = t1.venue || t2.venue || 'Unknown venue';
            found.push({
              id: `venue-${p1.id}-${p2.id}`,
              type: 'venue',
              message: `Venue conflict: "${venueName}" on ${dayName} — ${t1.name} & ${t2.name} overlap`,
              placedIds: [p1.id, p2.id],
            });
          }

          // Instructor conflict: same instructor (check across all venues)
          if (t1.instructorId && t2.instructorId && t1.instructorId === t2.instructorId) {
            const instrName = t1.instructor || 'Unknown instructor';
            found.push({
              id: `instructor-${p1.id}-${p2.id}`,
              type: 'instructor',
              message: `Instructor conflict: ${instrName} on ${dayName} — ${t1.name} & ${t2.name} overlap`,
              placedIds: [p1.id, p2.id],
            });
          }
        }
      }

      return found;
    },
    [],
  );

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
      const data = await res.json();
      const dbPlacements = data.placements;
      if (Array.isArray(dbPlacements) && dbPlacements.length > 0) {
        setPlacedTemplates(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dbPlacements.map((p: any) => ({
            id: p.id ?? `placed-${Date.now()}-${Math.random()}`,
            templateId: p.template_id,
            dayIndex: p.day_index,
            startHour: p.start_hour,
            durationHours: p.duration_hours,
            weekIndex: p.week_index ?? 0,
            venueId: p.venue_id ?? null,
          })),
        );
        // Restore total weeks from saved data
        if (typeof data.total_weeks === 'number' && data.total_weeks >= 1) {
          setTotalWeeks(data.total_weeks);
        } else {
          // Infer from max weekIndex in placements
          const maxWeek = Math.max(0, ...dbPlacements.map((p: any) => p.week_index ?? 0));
          if (maxWeek > 0) setTotalWeeks(maxWeek + 1);
        }
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

  // ── Fetch venues for venue selector ──

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch(`/api/venues`);
      if (!res.ok) return;
      const { venues: dbVenues } = await res.json();
      setVenues((dbVenues ?? []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })));
    } catch {
      // Non-critical
    }
  }, []);

  // Auto-select all venues on first load only
  const venuesInitialized = useRef(false);
  useEffect(() => {
    if (venues.length > 0 && !venuesInitialized.current) {
      venuesInitialized.current = true;
      setSelectedVenues(venues.map((v) => v.id));
    }
  }, [venues]);

  useEffect(() => {
    fetchTemplates();
    fetchPlacements();
    fetchBufferSettings();
    fetchVenues();

    // Check if any sessions exist (for "Go to Calendar" CTA)
    if (selectedProgramId) {
      fetch(`/api/sessions?program_id=${selectedProgramId}&limit=1`)
        .then((r) => r.json())
        .then((d) => setHasSessions((d.sessions ?? []).length > 0))
        .catch(() => {});
    }
  }, [fetchTemplates, fetchPlacements, fetchBufferSettings, fetchVenues, selectedProgramId]);

  // Re-run conflict detection when templates change (e.g. venue/instructor edits) or after initial load
  useEffect(() => {
    setConflicts(detectConflicts(placedTemplates, templates));
  }, [templates, placedTemplates, detectConflicts]);

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
          total_weeks: totalWeeks,
          placements: placedTemplates.map((p) => ({
            templateId: p.templateId,
            dayIndex: p.dayIndex,
            startHour: p.startHour,
            durationHours: p.durationHours,
            weekIndex: p.weekIndex ?? 0,
            venueId: p.venueId ?? null,
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
      // Persist placements to DB first so scheduler engine has latest data
      const saveRes = await fetch('/api/templates/placements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: selectedProgramId,
          total_weeks: totalWeeks,
          placements: placedTemplates.map((p) => ({
            templateId: p.templateId,
            dayIndex: p.dayIndex,
            startHour: p.startHour,
            durationHours: p.durationHours,
            weekIndex: p.weekIndex ?? 0,
            venueId: p.venueId ?? null,
          })),
        }),
      });
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save placements');
      }
      setIsDirty(false);

      const res = await fetch('/api/templates/placements/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: selectedProgramId,
          total_weeks: totalWeeks,
          placements: placedTemplates.map((p) => ({
            templateId: p.templateId,
            dayIndex: p.dayIndex,
            startHour: p.startHour,
            durationHours: p.durationHours,
            weekIndex: p.weekIndex ?? 0,
            venueId: p.venueId ?? null,
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
    setIsAutoFilling(true);
    const newPlacements: PlacedTemplate[] = [];
    let totalPlaced = 0;

    // ── Fetch instructor data for availability-aware scheduling ──
    interface InstructorData {
      id: string;
      first_name: string;
      last_name: string;
      skills: string[] | null;
      availability_json: Record<string, { start: string; end: string }[]> | null;
      is_active: boolean;
    }
    let allInstructors: InstructorData[] = [];
    try {
      const res = await fetch('/api/instructors?is_active=true');
      if (res.ok) {
        const data = await res.json();
        allInstructors = data.instructors ?? [];
      }
    } catch { /* Non-critical — falls back to no-instructor-awareness */ }

    // ── Fetch full venue data for availability/capacity checks ──
    interface VenueData {
      id: string;
      name: string;
      availability_json: Record<string, { start: string; end: string }[]> | null;
      max_concurrent_bookings: number | null;
      buffer_minutes: number | null;
    }
    let allVenueData: VenueData[] = [];
    try {
      const res = await fetch('/api/venues');
      if (res.ok) {
        const data = await res.json();
        allVenueData = data.venues ?? [];
      }
    } catch { /* Falls back to basic venue list */ }

    // ── Helpers ──
    const timeStringToHour = (t: string): number => {
      const [h, m] = t.split(':').map(Number);
      return h + m / 60;
    };

    const hourToTimeString = (h: number): string => {
      const hours = Math.floor(h);
      const mins = Math.round((h - hours) * 60);
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const DAY_INDEX_TO_NAME: Record<number, string> = {
      0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday', 4: 'friday',
    };

    const getTimeRange = (dayIdx: number) => {
      if (settings.usePerDayTimes && settings.perDayTimes[dayIdx]?.enabled) {
        const custom = settings.perDayTimes[dayIdx];
        return { start: timeStringToHour(custom.startTime), end: timeStringToHour(custom.endTime) };
      }
      return { start: timeStringToHour(settings.startTime), end: timeStringToHour(settings.endTime) };
    };

    const overlapsLunchBlock = (start: number, dur: number): boolean => {
      if (!lunchEnabled) return false;
      const end = start + dur;
      return !(end <= lunchStart || start >= lunchEnd);
    };

    const getDuration = (t: Template): number => {
      if (t.timeSlot) {
        return timeStringToHour(t.timeSlot.end) - timeStringToHour(t.timeSlot.start);
      }
      return 0.75; // default 45 min
    };

    const isGradeUsed = (templateId: string, weekIdx: number): boolean => {
      return [...placedTemplates, ...newPlacements].some(
        p => p.templateId === templateId && (p.weekIndex ?? 0) === weekIdx
      );
    };

    const hasVenueConflict = (venueId: string, dayIdx: number, weekIdx: number, start: number, end: number): boolean => {
      const venueData = allVenueData.find(v => v.id === venueId);
      const maxConcurrent = venueData?.max_concurrent_bookings ?? 1;
      const buffer = (venueData?.buffer_minutes ?? 0) / 60; // convert to hours

      // Count overlapping bookings at this venue
      let overlaps = 0;
      for (const p of [...placedTemplates, ...newPlacements]) {
        if (p.dayIndex !== dayIdx || (p.weekIndex ?? 0) !== weekIdx) continue;
        const pVenueId = p.venueId ?? templates.find(t => t.id === p.templateId)?.venueId;
        if (pVenueId !== venueId) continue;
        const pStart = p.startHour - buffer;
        const pEnd = p.startHour + p.durationHours + buffer;
        if (start < pEnd && end > pStart) overlaps++;
      }
      return overlaps >= maxConcurrent;
    };

    const hasInstructorConflict = (instructorId: string | null | undefined, dayIdx: number, weekIdx: number, start: number, end: number): boolean => {
      if (!instructorId) return false;
      for (const p of [...placedTemplates, ...newPlacements]) {
        if (p.dayIndex !== dayIdx || (p.weekIndex ?? 0) !== weekIdx) continue;
        const pTemplate = templates.find(t => t.id === p.templateId);
        if (!pTemplate || pTemplate.instructorId !== instructorId) continue;
        const pEnd = p.startHour + p.durationHours;
        if (start < pEnd && p.startHour < end) return true;
      }
      return false;
    };

    // ── Instructor availability checking ──

    /** Check if an instructor is available on a given grid day at a given time range */
    const isInstructorAvailable = (instructor: InstructorData, gridDayIdx: number, startHour: number, endHour: number): boolean => {
      if (!instructor.availability_json) return true; // No availability = always available
      const dayName = DAY_INDEX_TO_NAME[gridDayIdx];
      if (!dayName) return false;
      const blocks = instructor.availability_json[dayName];
      if (!blocks || blocks.length === 0) return false;

      const startStr = hourToTimeString(startHour);
      const endStr = hourToTimeString(endHour);

      // At least one block must fully contain the session
      return blocks.some(block => block.start <= startStr && block.end >= endStr);
    };

    /** Find qualified instructors for a template's required skills */
    const getQualifiedInstructors = (template: Template): InstructorData[] => {
      const required = template.subjects ?? [];
      if (required.length === 0) return allInstructors; // No skill requirement = anyone

      return allInstructors.filter(inst => {
        const skills = inst.skills ?? [];
        return required.every(req =>
          skills.some(s => s.toLowerCase() === req.toLowerCase())
        );
      });
    };

    /** Check if a venue is available on a given day/time (from venue availability_json) */
    const isVenueAvailable = (venueId: string, gridDayIdx: number, startHour: number, endHour: number): boolean => {
      const venue = allVenueData.find(v => v.id === venueId);
      if (!venue?.availability_json) return true; // No restrictions
      const dayName = DAY_INDEX_TO_NAME[gridDayIdx];
      if (!dayName) return false;
      const blocks = venue.availability_json[dayName];
      if (!blocks || blocks.length === 0) return false;

      const startStr = hourToTimeString(startHour);
      const endStr = hourToTimeString(endHour);
      return blocks.some(block => block.start <= startStr && block.end >= endStr);
    };

    /** Count how many qualified instructors are available at a given slot */
    const countAvailableInstructors = (
      qualifiedInstructors: InstructorData[],
      gridDayIdx: number,
      weekIdx: number,
      startHour: number,
      endHour: number
    ): number => {
      return qualifiedInstructors.filter(inst => {
        if (!isInstructorAvailable(inst, gridDayIdx, startHour, endHour)) return false;
        // Also check they're not already booked in our placements
        if (hasInstructorConflict(inst.id, gridDayIdx, weekIdx, startHour, endHour)) return false;
        return true;
      }).length;
    };

    // ── Find valid slots with instructor-awareness ──
    const findAllValidSlots = (
      template: Template,
      dayIdx: number,
      weekIdx: number,
      range: { start: number; end: number }
    ): Array<{ venueId: string; start: number; score: number }> => {
      const dur = getDuration(template);
      const validSlots: Array<{ venueId: string; start: number; score: number }> = [];
      const candidateVenues = template.venueId ? [template.venueId] : venues.map(v => v.id);
      const qualifiedInstructors = getQualifiedInstructors(template);

      for (const venueId of candidateVenues) {
        for (let t = range.start; t + dur <= range.end; t += 0.25) {
          if (overlapsLunchBlock(t, dur)) continue;
          if (hasVenueConflict(venueId, dayIdx, weekIdx, t, t + dur)) continue;
          if (!isVenueAvailable(venueId, dayIdx, t, t + dur)) continue;

          // Check template's pre-assigned instructor conflict
          if (template.instructorId) {
            if (hasInstructorConflict(template.instructorId, dayIdx, weekIdx, t, t + dur)) continue;
          }

          // Score: how many qualified instructors can teach at this time?
          const availCount = countAvailableInstructors(qualifiedInstructors, dayIdx, weekIdx, t, t + dur);

          // If no qualified instructor can teach here, this slot is invalid
          // (unless there are no skill requirements at all)
          if (qualifiedInstructors.length > 0 && availCount === 0) continue;

          // Score: prefer slots with MORE available instructors (more flexibility)
          // Secondary: prefer earlier times (slight bonus)
          const score = (availCount * 100) - t;
          validSlots.push({ venueId, start: t, score });
        }
      }

      return validSlots;
    };

    console.log('[AutoFill] Instructor-aware constraint scheduler');
    console.log('Templates:', templates.length, 'Instructors:', allInstructors.length, 'Weeks:', totalWeeks);

    const AUTO_FILL_DAY_TO_GRID: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

    for (let weekIdx = 0; weekIdx < totalWeeks; weekIdx++) {
      for (const autoFillDayIdx of settings.selectedDays) {
        const dayIndex = AUTO_FILL_DAY_TO_GRID[autoFillDayIdx];
        if (dayIndex === undefined) continue;

        const range = getTimeRange(autoFillDayIdx);
        console.log(`[Week ${weekIdx}] [Day ${autoFillDayIdx}] Range: ${range.start}-${range.end}`);

        // Get templates for this day that haven't been placed yet this week
        const dayTemplates = templates.filter(t => 
          t.isActive !== false && 
          (t.days.length === 0 || t.days.includes(autoFillDayIdx)) &&
          !isGradeUsed(t.id, weekIdx)
        );

        console.log(`  Day templates: ${dayTemplates.length}`);

        // Sort by constraint level (most constrained first):
        // 1. Fixed-time templates first
        // 2. Then by fewest qualified instructors (hardest to schedule)
        // 3. Then by fewest venue options
        const sorted = [...dayTemplates].sort((a, b) => {
          if (a.timeSlot && !b.timeSlot) return -1;
          if (!a.timeSlot && b.timeSlot) return 1;
          const aInstructors = getQualifiedInstructors(a).length;
          const bInstructors = getQualifiedInstructors(b).length;
          if (aInstructors !== bInstructors) return aInstructors - bInstructors;
          const aVenues = a.venueId ? 1 : venues.length;
          const bVenues = b.venueId ? 1 : venues.length;
          return aVenues - bVenues;
        });

        // Place each template
        for (const t of sorted) {
          if (t.timeSlot) {
            // Fixed-time templates: only check at the exact time
            const fixedStart = timeStringToHour(t.timeSlot.start);
            const dur = getDuration(t);
            const fixedEnd = fixedStart + dur;
            
            // Skip if fixed time is outside the auto-fill time range
            if (fixedStart < range.start || fixedEnd > range.end) {
              console.log(`  ✗ ${t.gradeGroups?.join(',') || t.name} skipped (fixed time ${fixedStart}-${fixedEnd} outside range ${range.start}-${range.end})`);
              continue;
            }
            
            const candidateVenues = t.venueId ? [t.venueId] : venues.map(v => v.id);

            for (const venueId of candidateVenues) {
              if (!overlapsLunchBlock(fixedStart, dur) &&
                  !hasVenueConflict(venueId, dayIndex, weekIdx, fixedStart, fixedStart + dur) &&
                  isVenueAvailable(venueId, dayIndex, fixedStart, fixedStart + dur) &&
                  !hasInstructorConflict(t.instructorId, dayIndex, weekIdx, fixedStart, fixedStart + dur)) {
                newPlacements.push({
                  id: `placed-${Date.now()}-${Math.random()}`,
                  templateId: t.id,
                  dayIndex,
                  startHour: fixedStart,
                  durationHours: dur,
                  weekIndex: weekIdx,
                  venueId,
                });
                totalPlaced++;
                console.log(`  ✓ ${t.gradeGroups?.join(',') || t.name} at ${fixedStart} (${venues.find(v => v.id === venueId)?.name})`);
                break;
              }
            }
          } else {
            // Flexible templates: find all valid slots, pick best by score
            const validSlots = findAllValidSlots(t, dayIndex, weekIdx, range);
            if (validSlots.length > 0) {
              // Pick slot with highest score (most instructor coverage, then earliest)
              validSlots.sort((a, b) => b.score - a.score);
              const slot = validSlots[0];
              const dur = getDuration(t);
              newPlacements.push({
                id: `placed-${Date.now()}-${Math.random()}`,
                templateId: t.id,
                dayIndex,
                startHour: slot.start,
                durationHours: dur,
                weekIndex: weekIdx,
                venueId: slot.venueId,
              });
              totalPlaced++;
              const avail = countAvailableInstructors(
                getQualifiedInstructors(t), dayIndex, weekIdx, slot.start, slot.start + dur
              );
              console.log(`  ✓ ${t.gradeGroups?.join(',') || t.name} at ${slot.start} (${venues.find(v => v.id === slot.venueId)?.name}) [${avail} instructors available]`);
            } else {
              const qualified = getQualifiedInstructors(t);
              console.warn(`  ✗ ${t.gradeGroups?.join(',') || t.name} - no valid slots (${qualified.length} qualified instructors, ${t.subjects?.join(',') || 'no skills'})`);
            }
          }
        }
      }
    }

    console.log(`[AutoFill] Complete: placed ${totalPlaced}/${templates.length * totalWeeks} template-slots`);

    if (newPlacements.length === 0) {
      setToast({ message: 'No valid slots found', type: 'error', id: Date.now() });
      setIsAutoFilling(false);
      return;
    }

    const mergedPlacements = [...placedTemplates, ...newPlacements];
    setPlacedTemplates(mergedPlacements);
    setShowAutoFillModal(false);
    setIsAutoFilling(false);

    // Auto-save placements to DB so the scheduler engine can use them
    if (selectedProgramId) {
      try {
        const res = await fetch('/api/templates/placements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: selectedProgramId,
            total_weeks: totalWeeks,
            placements: mergedPlacements.map((p) => ({
              templateId: p.templateId,
              dayIndex: p.dayIndex,
              startHour: p.startHour,
              durationHours: p.durationHours,
              weekIndex: p.weekIndex ?? 0,
              venueId: p.venueId ?? null,
            })),
          }),
        });
        if (res.ok) {
          setIsDirty(false);
          setToast({ message: `Auto-filled ${totalPlaced} sessions (saved)`, type: 'success', id: Date.now() });
        } else {
          setIsDirty(true);
          setToast({ message: `Auto-filled ${totalPlaced} sessions (save failed — click Save to retry)`, type: 'error', id: Date.now() });
        }
      } catch {
        setIsDirty(true);
        setToast({ message: `Auto-filled ${totalPlaced} sessions (save failed — click Save to retry)`, type: 'error', id: Date.now() });
      }
    } else {
      setIsDirty(true);
      setToast({ message: `Auto-filled ${totalPlaced} sessions`, type: 'success', id: Date.now() });
    }
  };
  // ── Drag & Drop ──

  const handleDragStart = (template: Template) => {
    setDraggingTemplate(template);
    setDraggingPlacedId(null);
  };

  const handlePlacedDragStart = (placedId: string, templateId: string) => {
    const t = templates.find((tmpl) => tmpl.id === templateId);
    if (t) {
      setDraggingTemplate(t);
      setDraggingPlacedId(placedId);
    }
  };

  const handleDragEnd = () => {
    setDraggingTemplate(null);
    setDraggingPlacedId(null);
    setDropPreview(null);
    setDropConflict('none');
  };

  const handleDragOver = (dayIndex: number, weekIdx: number, e: React.DragEvent) => {
    e.preventDefault();

    // Compute duration from template's time slot or default to 1h
    let durationHours = 1;
    let fixedStartHour: number | null = null;
    if (draggingTemplate?.timeSlot) {
      const start = timeStringToHour(draggingTemplate.timeSlot.start);
      const end = timeStringToHour(draggingTemplate.timeSlot.end);
      if (end > start) {
        durationHours = end - start;
        fixedStartHour = start;
      }
    }

    let snappedHour: number;
    if (fixedStartHour !== null) {
      // Template has a fixed time: always snap to it
      snappedHour = fixedStartHour;
    } else {
      // Free placement: follow mouse
      const gridRect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - gridRect.top;
      const hourAtMouse = dayStartHour + relativeY / HOUR_HEIGHT;
      snappedHour = snapToQuarterHour(Math.max(dayStartHour, Math.min(dayEndHour - 1, hourAtMouse)));
    }

    // Check lunch overlap
    if (overlapsLunch(snappedHour, durationHours, lunchEnabled, lunchStart, lunchEnd)) {
      e.dataTransfer.dropEffect = 'none';
      setDropPreview({ dayIndex, hour: snappedHour });
      setDropConflict('lunch');
      return;
    }

    // Check for conflicts at drop target
    const endHour = snappedHour + durationHours;
    const dropVenueId = draggingTemplate?.venueId ?? null;
    let conflictType: 'none' | 'venue' | 'instructor' | 'lunch' | 'fixed-time' = 'none';

    // Venue conflict
    const venueConflict = placedTemplates.find((p) => {
      if (draggingPlacedId && p.id === draggingPlacedId) return false; // skip self
      if (p.dayIndex !== dayIndex || p.weekIndex !== weekIdx) return false;
      const pVenueId = p.venueId ?? templates.find((t) => t.id === p.templateId)?.venueId ?? null;
      if (pVenueId !== dropVenueId) return false;
      const pEnd = p.startHour + p.durationHours;
      return snappedHour < pEnd && p.startHour < endHour;
    });
    if (venueConflict) conflictType = 'venue';

    // Instructor conflict
    if (!conflictType && draggingTemplate?.instructorId) {
      const instructorConflict = placedTemplates.find((p) => {
        if (draggingPlacedId && p.id === draggingPlacedId) return false;
        if (p.dayIndex !== dayIndex || p.weekIndex !== weekIdx) return false;
        const pTemplate = templates.find((t) => t.id === p.templateId);
        if (!pTemplate || pTemplate.instructorId !== draggingTemplate.instructorId) return false;
        const pEnd = p.startHour + p.durationHours;
        return snappedHour < pEnd && p.startHour < endHour;
      });
      if (instructorConflict) conflictType = 'instructor';
    }

    setDropConflict(conflictType);
    e.dataTransfer.dropEffect = draggingPlacedId ? 'move' : 'copy';
    setDropPreview({ dayIndex, hour: snappedHour });
  };

  const handleDragLeave = () => {
    setDropPreview(null);
    setDropConflict('none');
  };

  const handleDrop = (dayIndex: number, weekIdx: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropPreview(null);
    setDropConflict('none');

    // Check if this is a move of an existing placed event
    let movingPlacedId: string | null = draggingPlacedId;
    let templateToPlace = draggingTemplate;

    // Also check dataTransfer for placed event data (in case drag started from PlacedTemplateBlock)
    const placedData = e.dataTransfer.getData('application/placed-event');
    if (placedData) {
      try {
        const parsed = JSON.parse(placedData);
        movingPlacedId = parsed.placedId;
        templateToPlace = templateToPlace ?? templates.find((t) => t.id === parsed.templateId) ?? null;
      } catch { /* ignore */ }
    }

    if (!templateToPlace) {
      templateToPlace = templates.find((t) => t.id === e.dataTransfer.getData('text/plain')) ?? null;
    }
    if (!templateToPlace) return;

    // Only prevent duplicates for NEW placements (not moves)
    if (!movingPlacedId) {
      const hasGrades = templateToPlace.gradeLevel || (templateToPlace.gradeGroups && templateToPlace.gradeGroups.length > 0);
      const alreadyPlaced = hasGrades && placedTemplates.some(
        (p) => p.templateId === templateToPlace!.id && p.weekIndex === weekIdx,
      );
      if (alreadyPlaced) {
        setToast({ message: 'This event is already scheduled this week', type: 'error', id: Date.now() });
        setDraggingTemplate(null);
        setDraggingPlacedId(null);
        return;
      }
    }

    // Compute duration and check for fixed start time
    let durationHours = 1;
    let fixedStartHour: number | null = null;
    if (templateToPlace.timeSlot) {
      const start = timeStringToHour(templateToPlace.timeSlot.start);
      const end = timeStringToHour(templateToPlace.timeSlot.end);
      if (end > start) {
        durationHours = end - start;
        fixedStartHour = start;
      }
    }

    // For moved placed events, preserve original duration
    if (movingPlacedId) {
      const existingPlaced = placedTemplates.find((p) => p.id === movingPlacedId);
      if (existingPlaced) {
        durationHours = existingPlaced.durationHours;
      }
    }

    let startHour: number;
    if (fixedStartHour !== null) {
      // Template has a fixed time: always use it (only day can change)
      startHour = fixedStartHour;
    } else {
      // Free placement: use mouse position
      const gridRect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - gridRect.top;
      const hourAtMouse = dayStartHour + relativeY / HOUR_HEIGHT;
      startHour = snapToQuarterHour(Math.max(dayStartHour, Math.min(dayEndHour - 1, hourAtMouse)));
    }

    // Block placement during lunch
    if (overlapsLunch(startHour, durationHours, lunchEnabled, lunchStart, lunchEnd)) {
      setDraggingTemplate(null);
      setDraggingPlacedId(null);
      return;
    }

    // Conflict detection - skip self when moving
    const endHour = startHour + durationHours;
    const dropVenueId = templateToPlace.venueId ?? null;
    const conflict = placedTemplates.find((p) => {
      if (movingPlacedId && p.id === movingPlacedId) return false; // skip self
      if (p.dayIndex !== dayIndex || p.weekIndex !== weekIdx) return false;
      const pVenueId = p.venueId ?? templates.find((t) => t.id === p.templateId)?.venueId ?? null;
      if (pVenueId !== dropVenueId) return false;
      const pEnd = p.startHour + p.durationHours;
      return startHour < pEnd && p.startHour < endHour;
    });
    if (conflict) {
      const venueName = templateToPlace.venue || venues.find((v) => v.id === templateToPlace!.venueId)?.name || 'this slot';
      setToast({ message: `Conflict: ${venueName} is already booked at this time`, type: 'error', id: Date.now() });
      setDraggingTemplate(null);
      setDraggingPlacedId(null);
      return;
    }

    if (movingPlacedId) {
      // Moving existing placed event: update in place
      setPlacedTemplates((prev) =>
        prev.map((p) =>
          p.id === movingPlacedId
            ? { ...p, dayIndex, startHour, weekIndex: weekIdx }
            : p
        ),
      );
    } else {
      // New placement
      const newPlaced: PlacedTemplate = {
        id: `placed-${Date.now()}-${Math.random()}`,
        templateId: templateToPlace.id,
        dayIndex,
        startHour,
        durationHours,
        weekIndex: weekIdx,
        venueId: templateToPlace.venueId ?? null,
      };
      setPlacedTemplates((prev) => [...prev, newPlaced]);
    }

    setDraggingTemplate(null);
    setDraggingPlacedId(null);
    setIsDirty(true);
  };

  // ── Placed template operations ──

  const handleResizePlaced = (placedId: string, newStart: number, newDuration: number) => {
    // Block resizing into lunch
    if (overlapsLunch(newStart, newDuration, lunchEnabled, lunchStart, lunchEnd)) return;

    // Venue conflict detection
    const placed = placedTemplates.find((p) => p.id === placedId);
    if (placed) {
      const tmpl = templates.find((t) => t.id === placed.templateId);
      if (!tmpl) return; // Early return if template not found
      // Conflict detection - always check, even for templates without assigned venues
      const newEnd = newStart + newDuration;
      const placedVenueId = placed.venueId ?? tmpl.venueId ?? null;
      const conflict = placedTemplates.find((p) => {
        if (p.id === placedId || p.dayIndex !== placed.dayIndex || p.weekIndex !== placed.weekIndex) return false;
        const pVenueId = p.venueId ?? templates.find((t) => t.id === p.templateId)?.venueId ?? null;
        if (pVenueId !== placedVenueId) return false;
        const pEnd = p.startHour + p.durationHours;
        return newStart < pEnd && p.startHour < newEnd;
      });
      if (conflict) {
        const venueName = tmpl.venue || venues.find((v) => v.id === tmpl.venueId)?.name || 'this slot';
        setToast({ message: `Conflict: ${venueName} is already booked at this time`, type: 'error', id: Date.now() });
        return;
      }
    }

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
    // Auto-assign first selected venue
    if (selectedVenues.length === 1) {
      newT.venueId = selectedVenues[0];
      const venue = venues.find((v) => v.id === selectedVenues[0]);
      if (venue) newT.venue = venue.name;
    }
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

  // ── Venue-scoped filtering ──
  const multiLane = selectedVenues.length > 1;

  // Templates: show all that belong to any selected venue (or unassigned)
  const venueFilteredTemplates = selectedVenues.length === 0
    ? templates
    : templates.filter((t) => t.venueId ? selectedVenues.includes(t.venueId) : true);

  // Placements: show all that belong to any selected venue (or unassigned)
  const venueFilteredPlacements = selectedVenues.length === 0
    ? placedTemplates
    : placedTemplates.filter((p) => {
        const effectiveVenueId = p.venueId ?? templates.find((tmpl) => tmpl.id === p.templateId)?.venueId ?? null;
        return effectiveVenueId ? selectedVenues.includes(effectiveVenueId) : true;
      });

  const templateListItems: TemplateListItem[] = venueFilteredTemplates.map((t) => ({
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
    tags: t.subjects ?? [],
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
              Build a weekly schedule template per venue. This pattern will repeat when you publish to the calendar.
            </p>
          </div>
          {conflicts.length > 0 && (
            <Tooltip text={`${conflicts.length} scheduling conflict${conflicts.length === 1 ? '' : 's'} detected — click to view details`}>
              <button
                onClick={() => setShowConflictPanel(!showConflictPanel)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-600">
                  {conflicts.length} Conflict{conflicts.length === 1 ? '' : 's'}
                </span>
                <ChevronDown className={`w-3 h-3 text-red-400 transition-transform ${showConflictPanel ? 'rotate-180' : ''}`} />
              </button>
            </Tooltip>
          )}
          {isDirty && (
            <Tooltip text="You have unsaved changes">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-medium text-amber-600">Unsaved</span>
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Day Schedule Settings */}
          <div className="relative">
            <Tooltip text="Configure day start/end times, lunch breaks, and buffer settings">
              <button
                onClick={() => setShowDaySettings(!showDaySettings)}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer border ${
                  showDaySettings
                    ? 'bg-blue-50 text-blue-600 border-blue-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                }`}
              >
                <Clock className="w-4 h-4" />
                Day Start/End Times
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
              onClick={() => {
                if (conflicts.length > 0) {
                  setToast({
                    message: `Cannot publish: ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} must be resolved first`,
                    type: 'error',
                    id: Date.now(),
                  });
                  return;
                }
                setShowPublishConfirm(true);
              }}
              disabled={isPublishing || isSaving || placedTemplates.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isPublishing ? 'Publishing…' : 'Publish Schedule'}
            </button>
          </Tooltip>
          <div className="flex-1" />
          <Tooltip text="Automatically assign events to empty time slots">
            <button
              onClick={() => setShowAutoFillModal(true)}
              disabled={venueFilteredTemplates.length === 0 || isAutoFilling}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors cursor-pointer bg-violet-500 text-white hover:bg-violet-600 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              Create Schedule
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Conflict panel */}
      {showConflictPanel && conflicts.length > 0 && (
        <div className="bg-red-50 px-8 py-3 border-b border-red-200 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {conflicts.length} Scheduling Conflict{conflicts.length === 1 ? '' : 's'}
            </h3>
            <button
              onClick={() => setShowConflictPanel(false)}
              className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-2 px-3 py-2 bg-white rounded-md border border-red-100 text-sm"
              >
                <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${c.type === 'venue' ? 'bg-red-500' : 'bg-orange-500'}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-1.5">
                    {c.type}
                  </span>
                  <span className="text-slate-700 text-[13px]">{c.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Venue toggle (multi-select, like calendar Week View) */}
      {venues.length > 1 && (
        <div className="bg-white px-8 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Venues</label>
            <button
              onClick={() =>
                setSelectedVenues(
                  selectedVenues.length === venues.length ? [] : venues.map((v) => v.id)
                )
              }
              className="text-[11px] font-medium text-blue-500 hover:text-blue-700 transition-colors cursor-pointer"
            >
              {selectedVenues.length === venues.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <VenueToggle
            venues={venues}
            selectedVenues={selectedVenues}
            onChange={setSelectedVenues}
          />
        </div>
      )}

      {/* Next Step CTA — show when templates are placed but no sessions generated yet */}
      {placedTemplates.length > 0 && !hasSessions && (
        <div className="bg-blue-50 px-8 py-3 border-b border-blue-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Ready to generate your schedule?
                </p>
                <p className="text-xs text-blue-600">
                  Your weekly templates are set up. Head to the Calendar to generate sessions from this pattern.
                </p>
              </div>
            </div>
            <Tooltip text="Go to the Calendar page to generate sessions from your templates">
              <a
                href="/tools/scheduler/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                Go to Calendar
              </a>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Main content: Grid + Sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Weekly Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-8 mt-6 mb-3">
            {/* Template summary bar */}
            {(() => {
              const totalCount = templates.length;
              const dayCounts = [1, 2, 3, 4, 5].map((dow) =>
                templates.filter((t) => t.days.includes(dow)).length
              );
              const placedIds = new Set(placedTemplates.map((p) => p.templateId));
              const placedCount = templates.filter((t) => placedIds.has(t.id)).length;
              const unplacedCount = totalCount - placedCount;
              return totalCount > 0 ? (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">{totalCount} weekly templates:</span>
                  <span>
                    {DAYS_SHORT.map((d, i) => (
                      <span key={d}>{i > 0 ? ' · ' : ''}{d} {dayCounts[i]}</span>
                    ))}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>{placedCount} placed · {unplacedCount} unplaced</span>
                  <Tooltip text="Placed templates have been dragged onto the schedule grid with a specific time and venue. Unplaced templates are in the library but not yet scheduled.">
                    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  </Tooltip>
                </div>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Your Schedule</h2>
              <p className="text-sm text-slate-500">— Drag events from the library to build your schedule</p>
              <Tooltip text="Add another week to the schedule">
                <button
                  onClick={() => {
                    setTotalWeeks((prev) => prev + 1);
                    setIsDirty(true);
                  }}
                  className="ml-auto p-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>
          {Array.from({ length: totalWeeks }, (_, weekIdx) => {
            const weekPlacementCount = venueFilteredPlacements.filter((p) => (p.weekIndex ?? 0) === weekIdx).length;
            return (
          <div key={weekIdx} className="mx-8 mb-8">
            {totalWeeks > 1 && (
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Week {weekIdx + 1} of {totalWeeks}
                  {weekPlacementCount > 0 && (
                    <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                      ({weekPlacementCount} event{weekPlacementCount === 1 ? '' : 's'})
                    </span>
                  )}
                </h3>
                {totalWeeks > 1 && weekIdx === totalWeeks - 1 && (
                  <Tooltip text="Remove this week">
                    <button
                      onClick={() => {
                        setPlacedTemplates((prev) => prev.filter((p) => (p.weekIndex ?? 0) !== weekIdx));
                        setTotalWeeks((prev) => Math.max(1, prev - 1));
                        setIsDirty(true);
                      }}
                      className="p-1 rounded-lg border border-dashed border-red-200 text-red-300 hover:text-red-500 hover:border-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <div className="flex" style={multiLane ? { minWidth: `${TIME_COL_WIDTH + selectedVenues.length * 120 * DAYS.length}px` } : undefined}>
            {/* Time column */}
            <div className="shrink-0 sticky left-0 z-10 bg-white" style={{ width: TIME_COL_WIDTH }}>
              <div className={`border-b border-slate-200 ${multiLane ? '' : 'h-12'}`}>
                <div className="h-12" />
                {multiLane && <div className="border-t border-slate-100 py-1 text-[10px]">&nbsp;</div>}
              </div>
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
              <div key={day} className={`flex-1 border-l border-slate-200 ${multiLane ? '' : 'min-w-[130px]'}`} style={multiLane ? { minWidth: `${selectedVenues.length * 120}px` } : undefined}>
                {/* Day header */}
                <div className="border-b border-slate-200">
                  <div className="h-12 flex items-center justify-center">
                    <Tooltip text={`Drag events here to schedule on ${day}`}>
                      <span className="text-sm font-semibold text-slate-700">{day}</span>
                    </Tooltip>
                  </div>
                  {multiLane && (
                    <div className="flex border-t border-slate-100">
                      {selectedVenues.map((venueId, laneIdx) => {
                        const venueName = venues.find((v) => v.id === venueId)?.name ?? venueId;
                        return (
                          <div
                            key={venueId}
                            className={`flex-1 text-[10px] font-medium text-slate-500 py-0.5 px-1 text-center whitespace-nowrap ${
                              laneIdx < selectedVenues.length - 1 ? 'border-r border-slate-100' : ''
                            }`}
                            style={{ minWidth: 120 }}
                          >
                            {venueName}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Schedule grid */}
                <div
                  className="schedule-grid relative"
                  style={{ height: (dayEndHour - dayStartHour) * HOUR_HEIGHT }}
                  onDrop={(e) => handleDrop(dayIndex, weekIdx, e)}
                  onDragOver={(e) => handleDragOver(dayIndex, weekIdx, e)}
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

                  {/* Valid slot highlight (shown on all day columns when dragging a time-fixed template) */}
                  {draggingTemplate && draggingTemplate.timeSlot && (() => {
                    const tStart = timeStringToHour(draggingTemplate.timeSlot!.start);
                    const tEnd = timeStringToHour(draggingTemplate.timeSlot!.end);
                    if (tEnd <= tStart) return null;
                    const slotTop = (tStart - dayStartHour) * HOUR_HEIGHT;
                    const slotHeight = (tEnd - tStart) * HOUR_HEIGHT;
                    if (slotTop < 0 || tStart >= dayEndHour) return null;
                    return (
                      <div
                        className="absolute left-0 right-0 pointer-events-none border-y-2 border-dashed transition-all duration-150"
                        style={{
                          top: `${slotTop}px`,
                          height: `${slotHeight}px`,
                          borderColor: `${draggingTemplate.color}40`,
                          backgroundColor: `${draggingTemplate.color}08`,
                        }}
                      />
                    );
                  })()}

                  {/* Drop preview ghost */}
                  {dropPreview && dropPreview.dayIndex === dayIndex && draggingTemplate && (() => {
                    let previewDuration = 1;
                    if (draggingTemplate.timeSlot) {
                      const s = timeStringToHour(draggingTemplate.timeSlot.start);
                      const e = timeStringToHour(draggingTemplate.timeSlot.end);
                      if (e > s) previewDuration = e - s;
                    }
                    // If moving an existing placed event, use its duration
                    if (draggingPlacedId) {
                      const existingPlaced = placedTemplates.find((p) => p.id === draggingPlacedId);
                      if (existingPlaced) previewDuration = existingPlaced.durationHours;
                    }

                    // Conflict-aware colors
                    const previewBorderColor = dropConflict === 'venue' || dropConflict === 'instructor'
                      ? '#EF4444'
                      : dropConflict === 'lunch'
                        ? '#F59E0B'
                        : dropConflict === 'fixed-time'
                          ? '#94A3B8'
                          : '#22C55E'; // green = valid
                    const previewBgColor = dropConflict === 'venue' || dropConflict === 'instructor'
                      ? '#FEF2F215'
                      : dropConflict === 'lunch'
                        ? '#FFFBEB15'
                        : dropConflict === 'fixed-time'
                          ? '#F1F5F915'
                          : `${draggingTemplate.color}15`;

                    return (
                      <div
                        className="absolute left-0.5 right-0.5 rounded-md border-2 border-dashed pointer-events-none transition-all duration-75"
                        style={{
                          top: `${(dropPreview.hour - dayStartHour) * HOUR_HEIGHT}px`,
                          height: `${previewDuration * HOUR_HEIGHT}px`,
                          borderColor: previewBorderColor,
                          backgroundColor: previewBgColor,
                        }}
                      >
                        <div className="px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            {dropConflict === 'lunch' && <Coffee className="w-3 h-3 text-amber-500" />}
                            {(dropConflict === 'venue' || dropConflict === 'instructor') && <AlertTriangle className="w-3 h-3 text-red-500" />}
                            {dropConflict === 'fixed-time' && <Lock className="w-3 h-3 text-slate-400" />}
                            <p className="text-[11px] font-bold" style={{
                              color: dropConflict !== 'none' ? previewBorderColor : draggingTemplate.color,
                            }}>
                              {formatHour(dropPreview.hour)}
                              {(draggingTemplate.timeSlot || draggingPlacedId) ? ` – ${formatHour(dropPreview.hour + previewDuration)}` : ''}
                            </p>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500 truncate">
                            {draggingPlacedId ? '↳ Moving' : ''} {getBlockDisplayName(draggingTemplate)}
                          </p>
                          {dropConflict === 'venue' && (
                            <p className="text-[9px] text-red-500 font-medium">Venue conflict</p>
                          )}
                          {dropConflict === 'instructor' && (
                            <p className="text-[9px] text-red-500 font-medium">Instructor conflict</p>
                          )}
                          {dropConflict === 'lunch' && (
                            <p className="text-[9px] text-amber-600 font-medium">Overlaps lunch</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {multiLane ? (
                    /* Multi-lane rendering: split day column into venue lanes */
                    <div className="absolute inset-0 flex">
                      {selectedVenues.map((venueId, laneIdx) => {
                        const lanePlacements = venueFilteredPlacements.filter(
                          (p) => {
                            if (p.dayIndex !== dayIndex || (p.weekIndex ?? 0) !== weekIdx) return false;
                            const t = templates.find((tmpl) => tmpl.id === p.templateId);
                            if (!t) return false;
                            const effectiveVenueId = p.venueId ?? t.venueId ?? null;
                            return effectiveVenueId === venueId || (!effectiveVenueId && laneIdx === 0);
                          },
                        );
                        return (
                          <div
                            key={venueId}
                            className={`relative flex-1 ${
                              laneIdx < selectedVenues.length - 1 ? 'border-r border-slate-100' : ''
                            }`}
                            style={{
                              minWidth: 120,
                              backgroundColor: LANE_BACKGROUNDS[laneIdx % LANE_BACKGROUNDS.length],
                            }}
                          >
                            {lanePlacements.map((placed) => {
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
                                  onDragStart={handlePlacedDragStart}
                                  onDragEnd={handleDragEnd}
                                  isSelected={selectedPlacedId === placed.id}
                                  isDragging={draggingPlacedId === placed.id}
                                  dayStartHour={dayStartHour}
                                  dayEndHour={dayEndHour}
                                  hasConflict={conflictingPlacedIds.has(placed.id)}
                                  conflictMessages={conflicts.filter((c) => c.placedIds.includes(placed.id)).map((c) => c.message)}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Single venue / all venues — original rendering */
                    <>
                      {venueFilteredPlacements
                        .filter((p) => p.dayIndex === dayIndex && (p.weekIndex ?? 0) === weekIdx)
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
                              onDragStart={handlePlacedDragStart}
                              onDragEnd={handleDragEnd}
                              isSelected={selectedPlacedId === placed.id}
                              isDragging={draggingPlacedId === placed.id}
                              dayStartHour={dayStartHour}
                              dayEndHour={dayEndHour}
                              hasConflict={conflictingPlacedIds.has(placed.id)}
                              conflictMessages={conflicts.filter((c) => c.placedIds.includes(placed.id)).map((c) => c.message)}
                            />
                          );
                        })}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
          </div>
            );
          })}
        </div>

        {/* Right: Event Library Sidebar */}
        <div className="w-[360px] shrink-0 bg-slate-50 border-l border-slate-200 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
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
              searchPlaceholder="Search events…"
            />
          </div>
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
          venues={venues}
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
          templates={venueFilteredTemplates}
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
