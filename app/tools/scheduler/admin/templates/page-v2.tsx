'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical, Pencil, Trash2, X, Clock, Calendar, Repeat } from 'lucide-react';
import { useProgram } from '../ProgramContext';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  instructor?: string;
  venue?: string;
  grade?: string;
  tags?: string[];
  color: string;
  // New fields for repeat functionality
  repeatMode?: 'none' | 'weekly' | 'biweekly' | 'custom';
  repeatWeeks?: number; // For custom repeat
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
const HOUR_HEIGHT = 72;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 16;
const TIME_COL_WIDTH = 72;

const TEMPLATE_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
];

// Mock autocomplete data
const INSTRUCTOR_SUGGESTIONS = [
  'Ms. Chen',
  'Mr. Park',
  'Ms. Rivera',
  'Mr. Johnson',
  'Ms. Davis',
  'Mr. Lee',
];

const VENUE_SUGGESTIONS = [
  'Room A1',
  'Room B2',
  'Auditorium',
  'Piano Lab',
  'Music Hall',
  'Choir Room',
  'Virtual Studio',
];

const GRADE_SUGGESTIONS = [
  'K',
  'K-1',
  'K-2',
  '1',
  '1-2',
  '2',
  '2-3',
  '3',
  '3-4',
  '4',
  '4-5',
  '5',
  '5-6',
  '6',
  'All',
];

const NAME_SUGGESTIONS = [
  'Strings Fundamentals',
  'Piano Basics',
  'Advanced Piano',
  'Brass Ensemble',
  'Percussion Workshop',
  'Choir Practice',
  'Music Theory',
  'Composition Class',
];

const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', name: 'Strings K-2', instructor: 'Ms. Chen', venue: 'Room A1', grade: 'K-2', tags: ['strings', 'beginner'], color: TEMPLATE_COLORS[0] },
  { id: 't2', name: 'Piano Advanced', instructor: 'Ms. Rivera', venue: 'Piano Lab', grade: '4-6', tags: ['piano', 'advanced'], color: TEMPLATE_COLORS[1] },
  { id: 't3', name: 'Brass Ensemble', instructor: 'Mr. Park', venue: 'Auditorium', grade: '5-6', tags: ['brass', 'ensemble'], color: TEMPLATE_COLORS[2] },
];

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

function hourToTimeString(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeStringToHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

// ──────────────────────────────────────────────────────────────
// Autocomplete Input Component
// ──────────────────────────────────────────────────────────────

function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);

  useEffect(() => {
    if (value && focused) {
      const lower = value.toLowerCase();
      const matches = suggestions.filter((s) =>
        s.toLowerCase().includes(lower)
      );
      setFiltered(matches.slice(0, 5));
    } else {
      setFiltered([]);
    }
  }, [value, focused, suggestions]);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
      />
      {filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((suggestion, idx) => (
            <Tooltip key={idx} text={`Select: ${suggestion}`}>
              <button
                onClick={() => {
                  onChange(suggestion);
                  setFiltered([]);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
              >
                {suggestion}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Components
// ──────────────────────────────────────────────────────────────

function TemplateCard({ template, onDragStart }: { template: Template; onDragStart: (t: Template) => void }) {
  return (
    <Tooltip text={`Drag to schedule: ${template.name}`}>
      <div
        draggable
        onDragStart={() => onDragStart(template)}
        className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
        style={{ borderLeft: `4px solid ${template.color}` }}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{template.name}</p>
            {template.instructor && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{template.instructor}</p>
            )}
            {template.grade && (
              <p className="text-xs text-slate-400 truncate">{template.grade}</p>
            )}
            {template.repeatMode && template.repeatMode !== 'none' && (
              <div className="flex items-center gap-1 mt-1">
                <Repeat className="w-3 h-3 text-violet-500" />
                <span className="text-xs text-violet-600 font-medium">
                  {template.repeatMode === 'weekly'
                    ? 'Weekly'
                    : template.repeatMode === 'biweekly'
                      ? 'Biweekly'
                      : `Every ${template.repeatWeeks} weeks`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Tooltip>
  );
}

function PlacedTemplateBlock({
  placed,
  template,
  onSelect,
  onResize,
  onDelete,
  isSelected,
}: {
  placed: PlacedTemplate;
  template: Template;
  onSelect: () => void;
  onResize: (newStart: number, newDuration: number) => void;
  onDelete: () => void;
  isSelected: boolean;
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
      const hourAtMouse = DAY_START_HOUR + relativeY / HOUR_HEIGHT;
      const snappedHour = snapToQuarterHour(Math.max(DAY_START_HOUR, Math.min(DAY_END_HOUR, hourAtMouse)));

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
    [resizing, placed, onResize],
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

  const top = (placed.startHour - DAY_START_HOUR) * HOUR_HEIGHT;
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
      <Tooltip text={`${template.name} — ${formatHour(placed.startHour)} to ${formatHour(placed.startHour + placed.durationHours)}`}>
        <>
          <div
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart('top', e)}
            style={{ backgroundColor: template.color }}
          />
          <div className="px-2 py-1.5">
            <p className="text-xs font-bold leading-tight" style={{ color: template.color }}>
              {formatHour(placed.startHour)} – {formatHour(placed.startHour + placed.durationHours)}
            </p>
            <p className="text-xs font-semibold text-slate-900 leading-tight truncate mt-0.5">
              {template.name}
            </p>
            {height > 48 && template.instructor && (
              <p className="text-xs text-slate-600 leading-tight truncate mt-0.5">{template.instructor}</p>
            )}
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart('bottom', e)}
            style={{ backgroundColor: template.color }}
          />
          {isSelected && (
            <Tooltip text="Delete this template">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="absolute top-1 right-1 p-1 rounded bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </Tooltip>
          )}
        </>
      </Tooltip>
    </div>
  );
}

function EditPanel({
  placed,
  template,
  onClose,
  onUpdate,
}: {
  placed: PlacedTemplate;
  template: Template;
  onClose: () => void;
  onUpdate: (updates: Partial<Template>) => void;
}) {
  const [localTemplate, setLocalTemplate] = useState(template);
  const [startTime, setStartTime] = useState(hourToTimeString(placed.startHour));
  const [endTime, setEndTime] = useState(
    hourToTimeString(placed.startHour + placed.durationHours)
  );

  const handleSave = () => {
    onUpdate(localTemplate);
    onClose();
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Edit Template</h3>
        <Tooltip text="Close panel">
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      <div className="space-y-4">
        {/* Name with Autocomplete */}
        <AutocompleteInput
          label="Name"
          value={localTemplate.name}
          onChange={(val) => setLocalTemplate((t) => ({ ...t, name: val }))}
          suggestions={NAME_SUGGESTIONS}
          placeholder="e.g., Strings Fundamentals"
        />

        {/* Instructor with Autocomplete */}
        <AutocompleteInput
          label="Instructor (optional)"
          value={localTemplate.instructor ?? ''}
          onChange={(val) => setLocalTemplate((t) => ({ ...t, instructor: val }))}
          suggestions={INSTRUCTOR_SUGGESTIONS}
          placeholder="Leave blank for auto-assign"
        />

        {/* Venue with Autocomplete */}
        <AutocompleteInput
          label="Venue (optional)"
          value={localTemplate.venue ?? ''}
          onChange={(val) => setLocalTemplate((t) => ({ ...t, venue: val }))}
          suggestions={VENUE_SUGGESTIONS}
          placeholder="Leave blank for auto-assign"
        />

        {/* Grade with Autocomplete */}
        <AutocompleteInput
          label="Grade (optional)"
          value={localTemplate.grade ?? ''}
          onChange={(val) => setLocalTemplate((t) => ({ ...t, grade: val }))}
          suggestions={GRADE_SUGGESTIONS}
          placeholder="e.g., K-2, 3-5"
        />

        {/* Time Input Section */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-700">Time</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Day: {DAYS[placed.dayIndex]}
          </p>
        </div>

        {/* Repeat Options */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-700">Repeat</span>
          </div>

          <div className="space-y-2">
            <Tooltip text="This template appears only once">
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="repeat"
                  checked={!localTemplate.repeatMode || localTemplate.repeatMode === 'none'}
                  onChange={() =>
                    setLocalTemplate((t) => ({ ...t, repeatMode: 'none' }))
                  }
                  className="text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">No Repeat</span>
              </label>
            </Tooltip>

            <Tooltip text="Repeat this template every week">
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="repeat"
                  checked={localTemplate.repeatMode === 'weekly'}
                  onChange={() =>
                    setLocalTemplate((t) => ({ ...t, repeatMode: 'weekly' }))
                  }
                  className="text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Every Week</span>
              </label>
            </Tooltip>

            <Tooltip text="Repeat this template every other week">
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="repeat"
                  checked={localTemplate.repeatMode === 'biweekly'}
                  onChange={() =>
                    setLocalTemplate((t) => ({ ...t, repeatMode: 'biweekly' }))
                  }
                  className="text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Every Other Week</span>
              </label>
            </Tooltip>

            <Tooltip text="Set a custom repeat interval">
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="repeat"
                  checked={localTemplate.repeatMode === 'custom'}
                  onChange={() =>
                    setLocalTemplate((t) => ({
                      ...t,
                      repeatMode: 'custom',
                      repeatWeeks: 3,
                    }))
                  }
                  className="text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Custom</span>
              </label>
            </Tooltip>

            {localTemplate.repeatMode === 'custom' && (
              <div className="ml-6 mt-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Repeat every (weeks):
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={localTemplate.repeatWeeks ?? 3}
                  onChange={(e) =>
                    setLocalTemplate((t) => ({
                      ...t,
                      repeatWeeks: parseInt(e.target.value) || 3,
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="pt-4 border-t border-slate-200">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Tags (comma-separated, optional)
          </label>
          <input
            type="text"
            value={localTemplate.tags?.join(', ') ?? ''}
            onChange={(e) =>
              setLocalTemplate((t) => ({
                ...t,
                tags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="e.g., strings, beginner"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button variant="primary" onClick={handleSave} className="w-full" tooltip="Save all changes">
            Save Changes
          </Button>
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
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [placedTemplates, setPlacedTemplates] = useState<PlacedTemplate[]>([]);
  const [draggingTemplate, setDraggingTemplate] = useState<Template | null>(null);
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null);

  const handleDragStart = (template: Template) => {
    setDraggingTemplate(template);
  };

  const handleDrop = (dayIndex: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingTemplate) return;

    const gridRect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - gridRect.top;
    const hourAtMouse = DAY_START_HOUR + relativeY / HOUR_HEIGHT;
    const startHour = snapToQuarterHour(Math.max(DAY_START_HOUR, Math.min(DAY_END_HOUR - 1, hourAtMouse)));

    const newPlaced: PlacedTemplate = {
      id: `placed-${Date.now()}-${Math.random()}`,
      templateId: draggingTemplate.id,
      dayIndex,
      startHour,
      durationHours: 1,
    };

    setPlacedTemplates((prev) => [...prev, newPlaced]);
    setDraggingTemplate(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleResizePlaced = (placedId: string, newStart: number, newDuration: number) => {
    setPlacedTemplates((prev) =>
      prev.map((p) => (p.id === placedId ? { ...p, startHour: newStart, durationHours: newDuration } : p)),
    );
  };

  const handleDeletePlaced = (placedId: string) => {
    setPlacedTemplates((prev) => prev.filter((p) => p.id !== placedId));
    setSelectedPlacedId(null);
  };

  const handleUpdateTemplate = (templateId: string, updates: Partial<Template>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, ...updates } : t)),
    );
  };

  const handleCreateTemplate = () => {
    const newTemplate: Template = {
      id: `t-${Date.now()}`,
      name: 'New Template',
      color: TEMPLATE_COLORS[templates.length % TEMPLATE_COLORS.length],
      repeatMode: 'none',
    };
    setTemplates((prev) => [...prev, newTemplate]);
  };

  const selectedPlaced = placedTemplates.find((p) => p.id === selectedPlacedId);
  const selectedTemplate = selectedPlaced ? templates.find((t) => t.id === selectedPlaced.templateId) : null;

  if (!selectedProgramId) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">Select a program to manage templates.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white px-8 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Template Builder</h1>
          <p className="text-sm text-slate-500 mt-1">
            Drag templates onto the weekly grid. Resize by dragging edges. Click to edit details.
          </p>
        </div>
        <Tooltip text="Create a new template">
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleCreateTemplate}>
            New Template
          </Button>
        </Tooltip>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Template Library */}
        <div className="w-64 bg-white border-r border-slate-200 p-4 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Template Library</h3>
          <div className="space-y-2">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} onDragStart={handleDragStart} />
            ))}
          </div>
        </div>

        {/* Week Grid */}
        <div className="flex-1 overflow-auto bg-white">
          <div className="inline-flex min-w-full">
            {/* Time column */}
            <div className="shrink-0" style={{ width: TIME_COL_WIDTH }}>
              <div className="h-12 border-b border-slate-200" />
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, i) => {
                const hour = DAY_START_HOUR + i;
                return (
                  <div
                    key={hour}
                    className="relative border-b border-slate-100"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className="absolute -top-2 right-3 text-xs font-medium text-slate-500">
                      {formatHour(hour)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex-1 min-w-[180px] border-l border-slate-200">
                {/* Day header */}
                <div className="h-12 border-b border-slate-200 flex items-center justify-center">
                  <span className="text-sm font-semibold text-slate-700">{day}</span>
                </div>

                {/* Schedule grid */}
                <div
                  className="schedule-grid relative"
                  style={{ height: (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT }}
                  onDrop={(e) => handleDrop(dayIndex, e)}
                  onDragOver={handleDragOver}
                >
                  {/* Hour rows */}
                  {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, i) => (
                    <div
                      key={i}
                      className="border-b border-slate-100"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

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
                          onSelect={() => setSelectedPlacedId(placed.id)}
                          onResize={(newStart, newDuration) =>
                            handleResizePlaced(placed.id, newStart, newDuration)
                          }
                          onDelete={() => handleDeletePlaced(placed.id)}
                          isSelected={selectedPlacedId === placed.id}
                        />
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Panel */}
        {selectedPlaced && selectedTemplate && (
          <EditPanel
            placed={selectedPlaced}
            template={selectedTemplate}
            onClose={() => setSelectedPlacedId(null)}
            onUpdate={(updates) => handleUpdateTemplate(selectedTemplate.id, updates)}
          />
        )}
      </div>
    </div>
  );
}
