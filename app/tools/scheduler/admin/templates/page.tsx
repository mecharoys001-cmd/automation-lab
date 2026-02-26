'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useProgram } from '../ProgramContext';
import Tooltip from '../../components/Tooltip';
import type { SessionTemplate, Venue, TemplateType, RotationMode } from '@/types/database';

// ── Constants ────────────────────────────────────────────────

const TEMPLATE_TYPES: { value: TemplateType; label: string; description: string; color: string }[] = [
  { value: 'fully_defined', label: 'Fully Defined', description: 'Admin sets everything: instructor, venue, time, day, grades, tags. Nothing auto-assigned.', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'tagged_slot', label: 'Tagged Slot', description: 'Admin sets day, time, venue, grades, and tags. Instructor auto-assigned by scheduler based on matching skills to tags + availability.', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'auto_assign', label: 'Auto-Assign', description: 'Admin sets day, time, venue, grades. No specific tag requirement. Scheduler picks best available instructor.', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'time_block', label: 'Time Block', description: 'Admin sets day, time, venue only. Scheduler assigns grades, instructor, and event types.', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
];

const ROTATION_MODES: { value: RotationMode; label: string; description: string }[] = [
  { value: 'consistent', label: 'Consistent', description: 'Same instructor assigned every week' },
  { value: 'rotate', label: 'Rotate', description: 'Rotate through qualified instructors across weeks' },
];

// ── Helpers ──────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS = [1, 2, 3, 4, 5] as const; // Mon-Fri for visual grid

const GRID_COLORS = [
  'bg-blue-500/30 border-blue-500/50 text-blue-200',
  'bg-emerald-500/30 border-emerald-500/50 text-emerald-200',
  'bg-violet-500/30 border-violet-500/50 text-violet-200',
  'bg-amber-500/30 border-amber-500/50 text-amber-200',
  'bg-rose-500/30 border-rose-500/50 text-rose-200',
  'bg-cyan-500/30 border-cyan-500/50 text-cyan-200',
  'bg-pink-500/30 border-pink-500/50 text-pink-200',
  'bg-teal-500/30 border-teal-500/50 text-teal-200',
];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

function calcDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

type TemplateWithVenue = SessionTemplate & { venue?: Venue | null };

interface FormData {
  template_type: TemplateType;
  rotation_mode: RotationMode;
  day_of_week: number;
  grade_groups: string;
  start_time: string;
  end_time: string;
  venue_id: string;
  required_skills: string;
  sort_order: string;
}

const EMPTY_FORM: FormData = {
  template_type: 'fully_defined',
  rotation_mode: 'consistent',
  day_of_week: 1,
  grade_groups: '',
  start_time: '12:00',
  end_time: '13:00',
  venue_id: '',
  required_skills: '',
  sort_order: '0',
};

// ── Skeleton loaders ─────────────────────────────────────────

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-muted/30" />
      ))}
    </div>
  );
}

// ── Skill badge ──────────────────────────────────────────────

function SkillBadge({ skill }: { skill: string }) {
  return (
    <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
      {skill}
    </span>
  );
}

// ── Status dot ───────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${active ? 'bg-green-400' : 'bg-red-400'}`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Weekly Visual Grid ───────────────────────────────────────

function WeeklyGrid({ templates }: { templates: TemplateWithVenue[] }) {
  const activeTemplates = templates.filter((t) => t.is_active);

  // Determine time range from templates, or default 12:00-15:00
  const { minTime, maxTime } = useMemo(() => {
    if (activeTemplates.length === 0) return { minTime: 720, maxTime: 900 }; // 12:00-15:00
    let min = Infinity;
    let max = -Infinity;
    for (const t of activeTemplates) {
      const s = timeToMinutes(t.start_time);
      const e = timeToMinutes(t.end_time);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    // Round down/up to nearest 30-min
    min = Math.floor(min / 30) * 30;
    max = Math.ceil(max / 30) * 30;
    return { minTime: min, maxTime: max };
  }, [activeTemplates]);

  const totalSlots = (maxTime - minTime) / 30;
  const timeLabels = Array.from({ length: totalSlots + 1 }, (_, i) =>
    minutesToTime(minTime + i * 30),
  );

  // Grade group color map
  const gradeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const t of activeTemplates) {
      const key = t.grade_groups.join(',');
      if (!map.has(key)) {
        map.set(key, GRID_COLORS[idx % GRID_COLORS.length]);
        idx++;
      }
    }
    return map;
  }, [activeTemplates]);

  if (activeTemplates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        No active templates to display in the weekly grid.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-[600px]"
          style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(5, 1fr)',
            gridTemplateRows: `32px repeat(${totalSlots}, 40px)`,
          }}
        >
          {/* Header row: empty corner + day names */}
          <div className="bg-muted/50 border-b border-r border-border" />
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-muted/50 border-b border-border flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {DAY_NAMES[day]}
            </div>
          ))}

          {/* Time rows */}
          {Array.from({ length: totalSlots }).map((_, slotIdx) => (
            <>
              {/* Time label */}
              <div
                key={`time-${slotIdx}`}
                className="border-r border-b border-border flex items-start justify-end pr-2 pt-0.5 text-[10px] text-muted-foreground"
              >
                {timeLabels[slotIdx]}
              </div>
              {/* Day columns */}
              {WEEKDAYS.map((day) => {
                const slotStart = minTime + slotIdx * 30;
                const slotEnd = slotStart + 30;

                // Find templates that START in this slot
                const starting = activeTemplates.filter((t) => {
                  if (t.day_of_week !== day) return false;
                  const tStart = timeToMinutes(t.start_time);
                  return tStart >= slotStart && tStart < slotEnd;
                });

                // Find templates that SPAN this slot but don't start here (for background)
                const spanning = activeTemplates.filter((t) => {
                  if (t.day_of_week !== day) return false;
                  const tStart = timeToMinutes(t.start_time);
                  const tEnd = timeToMinutes(t.end_time);
                  return tStart < slotStart && tEnd > slotStart;
                });

                return (
                  <div
                    key={`${day}-${slotIdx}`}
                    className="border-b border-border relative"
                    style={{ borderLeft: '1px solid hsl(var(--border))' }}
                  >
                    {starting.map((t) => {
                      const duration = calcDuration(t.start_time, t.end_time);
                      const heightSlots = duration / 30;
                      const colorClass = gradeColorMap.get(t.grade_groups.join(',')) || GRID_COLORS[0];
                      const offset = timeToMinutes(t.start_time) - slotStart;
                      const offsetPx = (offset / 30) * 40;

                      return (
                        <div
                          key={t.id}
                          className={`absolute left-0.5 right-0.5 rounded border text-[10px] leading-tight px-1 py-0.5 overflow-hidden z-10 ${colorClass}`}
                          style={{
                            top: `${offsetPx}px`,
                            height: `${heightSlots * 40 - 2}px`,
                          }}
                          title={`${t.grade_groups.join(', ')} | ${formatTime(t.start_time)}-${formatTime(t.end_time)}${t.venue ? ` | ${t.venue.name}` : ''}`}
                        >
                          <div className="font-medium truncate">{t.grade_groups.join(', ')}</div>
                          <div className="opacity-70 truncate">
                            {formatTime(t.start_time)}-{formatTime(t.end_time)}
                          </div>
                        </div>
                      );
                    })}
                    {spanning.length > 0 && starting.length === 0 && (
                      <div className="absolute inset-0 opacity-0" />
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function TemplatesPage() {
  const { selectedProgramId } = useProgram();

  const [templates, setTemplates] = useState<TemplateWithVenue[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch templates ─────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates?program_id=${selectedProgramId}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  // ── Fetch venues ────────────────────────────────────────────

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch('/api/venues');
      if (!res.ok) return;
      const { venues: venueData } = await res.json();
      setVenues(venueData ?? []);
    } catch {
      // silently fail — venue select will be empty
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchVenues();
  }, [fetchTemplates, fetchVenues]);

  // ── Filtered templates ──────────────────────────────────────

  const filtered = useMemo(() => {
    if (dayFilter === 'all') return templates;
    return templates.filter((t) => t.day_of_week === dayFilter);
  }, [templates, dayFilter]);

  // ── Create template ─────────────────────────────────────────

  const handleCreate = async () => {
    if (!selectedProgramId) return;
    setSaving(true);
    setError(null);
    try {
      const gradeGroups = formData.grade_groups
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const requiredSkills = formData.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const duration = calcDuration(formData.start_time, formData.end_time);

      const body = {
        program_id: selectedProgramId,
        template_type: formData.template_type,
        rotation_mode: formData.rotation_mode,
        day_of_week: formData.day_of_week,
        grade_groups: gradeGroups,
        start_time: formData.start_time,
        end_time: formData.end_time,
        duration_minutes: duration,
        venue_id: formData.venue_id || null,
        required_skills: requiredSkills.length > 0 ? requiredSkills : null,
        sort_order: parseInt(formData.sort_order, 10) || 0,
        is_active: true,
      };

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create template');

      setShowForm(false);
      setFormData(EMPTY_FORM);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  // ── Update template ─────────────────────────────────────────

  const handleUpdate = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const gradeGroups = editForm.grade_groups
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const requiredSkills = editForm.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const duration = calcDuration(editForm.start_time, editForm.end_time);

      const body = {
        template_type: editForm.template_type,
        rotation_mode: editForm.rotation_mode,
        day_of_week: editForm.day_of_week,
        grade_groups: gradeGroups,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        duration_minutes: duration,
        venue_id: editForm.venue_id || null,
        required_skills: requiredSkills.length > 0 ? requiredSkills : null,
        sort_order: parseInt(editForm.sort_order, 10) || 0,
      };

      const res = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update template');

      setEditingId(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete template ─────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');

      setDeleteConfirm(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  // ── Toggle active ───────────────────────────────────────────

  const handleToggleActive = async (template: TemplateWithVenue) => {
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !template.is_active }),
      });
      if (!res.ok) throw new Error('Failed to toggle template');
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle template');
    }
  };

  // ── Generate schedule ───────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedProgramId) return;
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/scheduler/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: selectedProgramId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGenerateResult({ success: true, message: 'Schedule generated successfully.' });
    } catch (err) {
      setGenerateResult({
        success: false,
        message: err instanceof Error ? err.message : 'Generation failed',
      });
    } finally {
      setGenerating(false);
    }
  };

  // ── Start editing ───────────────────────────────────────────

  const startEditing = (template: TemplateWithVenue) => {
    setEditingId(template.id);
    setEditForm({
      template_type: template.template_type ?? 'fully_defined',
      rotation_mode: template.rotation_mode ?? 'consistent',
      day_of_week: template.day_of_week,
      grade_groups: template.grade_groups.join(', '),
      start_time: template.start_time.slice(0, 5),
      end_time: template.end_time.slice(0, 5),
      venue_id: template.venue_id ?? '',
      required_skills: (template.required_skills ?? []).join(', '),
      sort_order: String(template.sort_order ?? 0),
    });
  };

  // ── No program selected ────────────────────────────────────

  if (!selectedProgramId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Session Templates</h1>
          <p className="text-muted-foreground mt-1">
            Define recurring weekly session patterns. The auto-scheduler uses these to generate concrete sessions.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          Select a program to manage templates.
        </div>
      </div>
    );
  }

  const inputClass =
    'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const selectClass =
    'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const btnClass =
    'px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors';
  const btnPrimaryClass =
    'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Session Templates</h1>
          <p className="text-muted-foreground mt-1">
            Define recurring weekly session patterns. The auto-scheduler uses these to generate concrete sessions.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Tooltip text="Add a new session template">
            <button
              onClick={() => {
                setShowForm(true);
                setFormData(EMPTY_FORM);
              }}
              className={btnPrimaryClass}
            >
              Create Template
            </button>
          </Tooltip>
          <Tooltip text="Generate sessions from active templates">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`${btnPrimaryClass} ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {generating ? 'Generating...' : 'Generate Schedule'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Generate result */}
      {generateResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            generateResult.success
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {generateResult.message}
          <Tooltip text="Dismiss this message" position="bottom">
            <button
              onClick={() => setGenerateResult(null)}
              className="ml-3 text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </Tooltip>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
          <Tooltip text="Dismiss this error" position="bottom">
            <button
              onClick={() => setError(null)}
              className="ml-3 text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </Tooltip>
        </div>
      )}

      {/* Database migration note */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-300">
        <div className="font-semibold mb-1">Database Setup</div>
        <div className="text-xs opacity-90 mb-2">
          If you encounter errors saving templates, run this SQL migration:
        </div>
        <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto">
          ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT &apos;fully_defined&apos;;{'\n'}
          ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS rotation_mode TEXT DEFAULT &apos;consistent&apos;;
        </pre>
      </div>

      {/* ── Weekly Visual Grid ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Weekly Overview</h2>
        {loading ? (
          <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
        ) : (
          <WeeklyGrid templates={templates} />
        )}
      </section>

      {/* ── Create Template Form (inline) ─────────────────────── */}
      {showForm && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">New Template</h2>
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {/* Template Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Template Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATE_TYPES.map((type) => (
                  <Tooltip key={type.value} text={type.description}>
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, template_type: type.value }))}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        formData.template_type === type.value
                          ? `${type.color} border-current`
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs opacity-70 mt-1 line-clamp-2">{type.description}</div>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Rotation Mode (only for tagged_slot and auto_assign) */}
            {(formData.template_type === 'tagged_slot' || formData.template_type === 'auto_assign') && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Instructor Assignment</label>
                <div className="flex gap-2">
                  {ROTATION_MODES.map((mode) => (
                    <Tooltip key={mode.value} text={mode.description}>
                      <button
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, rotation_mode: mode.value }))}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          formData.rotation_mode === mode.value
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-border bg-card hover:bg-muted/50'
                        }`}
                      >
                        {mode.label}
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Day of week */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Day of Week</label>
                <Tooltip text="Select which day this session occurs">
                  <select
                    value={formData.day_of_week}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, day_of_week: parseInt(e.target.value, 10) }))
                    }
                    className={`w-full ${selectClass}`}
                  >
                    {DAY_NAMES.map((name, idx) => (
                      <option key={idx} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Tooltip>
              </div>

              {/* Grade groups — hidden for time_block */}
              {formData.template_type !== 'time_block' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Grade Groups <span className="opacity-60">(comma-separated)</span>
                  </label>
                  <Tooltip text="Enter grade groups, separated by commas">
                    <input
                      type="text"
                      placeholder="e.g. K-2, 3-5"
                      value={formData.grade_groups}
                      onChange={(e) => setFormData((f) => ({ ...f, grade_groups: e.target.value }))}
                      className={`w-full ${inputClass}`}
                    />
                  </Tooltip>
                </div>
              )}

              {/* Start time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                <Tooltip text="Set session start time">
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData((f) => ({ ...f, start_time: e.target.value }))}
                    className={`w-full ${inputClass}`}
                  />
                </Tooltip>
              </div>

              {/* End time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">End Time</label>
                <Tooltip text="Set session end time">
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData((f) => ({ ...f, end_time: e.target.value }))}
                    className={`w-full ${inputClass}`}
                  />
                </Tooltip>
              </div>

              {/* Duration (auto-calculated, read-only) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Duration <span className="opacity-60">(auto)</span>
                </label>
                <div className={`w-full ${inputClass} bg-muted/30 cursor-default`}>
                  {calcDuration(formData.start_time, formData.end_time)} min
                </div>
              </div>

              {/* Venue */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Venue</label>
                <Tooltip text="Assign a venue for this session">
                  <select
                    value={formData.venue_id}
                    onChange={(e) => setFormData((f) => ({ ...f, venue_id: e.target.value }))}
                    className={`w-full ${selectClass}`}
                  >
                    <option value="">No venue</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.space_type})
                      </option>
                    ))}
                  </select>
                </Tooltip>
              </div>

              {/* Required skills — hidden for auto_assign and time_block */}
              {formData.template_type !== 'auto_assign' && formData.template_type !== 'time_block' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Required Skills <span className="opacity-60">(comma-separated)</span>
                  </label>
                  <Tooltip text="Enter required instructor skills, separated by commas">
                    <input
                      type="text"
                      placeholder="e.g. drums, guitar"
                      value={formData.required_skills}
                      onChange={(e) => setFormData((f) => ({ ...f, required_skills: e.target.value }))}
                      className={`w-full ${inputClass}`}
                    />
                  </Tooltip>
                </div>
              )}

              {/* Sort order */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Sort Order</label>
                <Tooltip text="Set display order priority">
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData((f) => ({ ...f, sort_order: e.target.value }))}
                    className={`w-full ${inputClass}`}
                  />
                </Tooltip>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Tooltip text="Discard new template">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormData(EMPTY_FORM);
                  }}
                  className={btnClass}
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip text="Save new template">
                <button
                  onClick={handleCreate}
                  disabled={saving || (formData.template_type !== 'time_block' && !formData.grade_groups.trim())}
                  className={`${btnPrimaryClass} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Saving...' : 'Create'}
                </button>
              </Tooltip>
            </div>
          </div>
        </section>
      )}

      {/* ── Template List ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold">All Templates</h2>
          <Tooltip text="Filter templates by day of week">
            <select
              value={dayFilter === 'all' ? 'all' : String(dayFilter)}
              onChange={(e) =>
                setDayFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
              }
              className={selectClass}
            >
              <option value="all">All Days</option>
              {DAY_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </Tooltip>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {templates.length === 0
                ? 'No templates yet. Create one to define your weekly schedule pattern.'
                : 'No templates match the selected day filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Day</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Grade Groups</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Duration</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Venue</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Required Skills</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((template) => {
                    const isEditing = editingId === template.id;
                    const isDeleting = deleteConfirm === template.id;

                    if (isEditing) {
                      return (
                        <tr
                          key={template.id}
                          className="border-b border-border last:border-0 bg-muted/10"
                        >
                          {/* Day */}
                          <td className="px-4 py-2">
                            <Tooltip text="Change the day of week">
                              <select
                                value={editForm.day_of_week}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    day_of_week: parseInt(e.target.value, 10),
                                  }))
                                }
                                className={`w-20 ${selectClass} py-1 text-xs`}
                              >
                                {DAY_NAMES.map((name, idx) => (
                                  <option key={idx} value={idx}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </Tooltip>
                          </td>
                          {/* Type */}
                          <td className="px-4 py-2">
                            {(() => {
                              const typeInfo = TEMPLATE_TYPES.find(t => t.value === (editForm.template_type ?? 'fully_defined'));
                              return (
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${typeInfo?.color ?? 'bg-muted/20 text-muted-foreground border-border'}`}>
                                  {typeInfo?.label ?? 'Fully Defined'}
                                </span>
                              );
                            })()}
                          </td>
                          {/* Grade Groups */}
                          <td className="px-4 py-2">
                            <Tooltip text="Edit grade groups">
                              <input
                                type="text"
                                value={editForm.grade_groups}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, grade_groups: e.target.value }))
                                }
                                className={`w-full max-w-[160px] ${inputClass} py-1 text-xs`}
                              />
                            </Tooltip>
                          </td>
                          {/* Time */}
                          <td className="px-4 py-2">
                            <div className="flex gap-1 items-center">
                              <Tooltip text="Change start time">
                                <input
                                  type="time"
                                  value={editForm.start_time}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, start_time: e.target.value }))
                                  }
                                  className={`w-[100px] ${inputClass} py-1 text-xs`}
                                />
                              </Tooltip>
                              <span className="text-muted-foreground text-xs">-</span>
                              <Tooltip text="Change end time">
                                <input
                                  type="time"
                                  value={editForm.end_time}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, end_time: e.target.value }))
                                  }
                                  className={`w-[100px] ${inputClass} py-1 text-xs`}
                                />
                              </Tooltip>
                            </div>
                          </td>
                          {/* Duration */}
                          <td className="px-4 py-2 text-muted-foreground text-xs hidden md:table-cell">
                            {calcDuration(editForm.start_time, editForm.end_time)} min
                          </td>
                          {/* Venue */}
                          <td className="px-4 py-2 hidden lg:table-cell">
                            <Tooltip text="Change assigned venue">
                              <select
                                value={editForm.venue_id}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, venue_id: e.target.value }))
                                }
                                className={`w-full max-w-[140px] ${selectClass} py-1 text-xs`}
                              >
                                <option value="">None</option>
                                {venues.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>
                            </Tooltip>
                          </td>
                          {/* Required Skills */}
                          <td className="px-4 py-2 hidden xl:table-cell">
                            <Tooltip text="Edit required skills">
                              <input
                                type="text"
                                value={editForm.required_skills}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, required_skills: e.target.value }))
                                }
                                className={`w-full max-w-[140px] ${inputClass} py-1 text-xs`}
                              />
                            </Tooltip>
                          </td>
                          {/* Active */}
                          <td className="px-4 py-2">
                            <StatusDot active={template.is_active} />
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <Tooltip text="Save changes">
                                <button
                                  onClick={() => handleUpdate(template.id)}
                                  disabled={saving}
                                  className={`${btnClass} ${saving ? 'opacity-50' : ''}`}
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </Tooltip>
                              <Tooltip text="Discard changes">
                                <button
                                  onClick={() => setEditingId(null)}
                                  className={btnClass}
                                >
                                  Cancel
                                </button>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={template.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {DAY_NAMES[template.day_of_week] ?? template.day_of_week}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const typeInfo = TEMPLATE_TYPES.find(t => t.value === (template.template_type ?? 'fully_defined'));
                            return (
                              <Tooltip text={typeInfo?.description ?? ''}>
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${typeInfo?.color ?? 'bg-muted/20 text-muted-foreground border-border'}`}>
                                  {typeInfo?.label ?? 'Fully Defined'}
                                </span>
                              </Tooltip>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {template.grade_groups.map((g) => (
                              <span
                                key={g}
                                className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatTime(template.start_time)} - {formatTime(template.end_time)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {template.duration_minutes} min
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {template.venue?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {template.required_skills && template.required_skills.length > 0
                              ? template.required_skills.map((s) => (
                                  <SkillBadge key={s} skill={s} />
                                ))
                              : <span className="text-muted-foreground">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Tooltip text={template.is_active ? 'Deactivate template' : 'Activate template'}>
                            <button onClick={() => handleToggleActive(template)}>
                              <StatusDot active={template.is_active} />
                            </button>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDeleting ? (
                            <div className="flex gap-1 justify-end items-center">
                              <span className="text-xs text-red-400 mr-1">Delete?</span>
                              <Tooltip text="Confirm deletion">
                                <button
                                  onClick={() => handleDelete(template.id)}
                                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-colors"
                                >
                                  Yes
                                </button>
                              </Tooltip>
                              <Tooltip text="Cancel deletion">
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className={btnClass}
                                >
                                  No
                                </button>
                              </Tooltip>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              <Tooltip text="Edit this template">
                                <button
                                  onClick={() => startEditing(template)}
                                  className={btnClass}
                                >
                                  Edit
                                </button>
                              </Tooltip>
                              <Tooltip text="Delete this template">
                                <button
                                  onClick={() => setDeleteConfirm(template.id)}
                                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                                >
                                  Delete
                                </button>
                              </Tooltip>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Count footer */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {templates.length} template{templates.length !== 1 ? 's' : ''}
          </p>
        )}
      </section>
    </div>
  );
}
