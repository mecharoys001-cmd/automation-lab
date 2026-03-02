'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical, Pencil, Trash2, X } from 'lucide-react';
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
}

interface PlacedTemplate {
  id: string;
  templateId: string;
  dayIndex: number; // 0=Mon, 1=Tue, etc.
  startHour: number; // decimal hours (e.g., 9.0 = 9:00 AM, 13.5 = 1:30 PM)
  durationHours: number;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOUR_HEIGHT = 72; // px per hour
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 16; // 4 PM
const TIME_COL_WIDTH = 72;

const TEMPLATE_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
];

// Mock template library
const INITIAL_TEMPLATES: Template[] = [
  { id: 't1', name: 'Strings K-2', instructor: 'Ms. Chen', venue: 'Room A1', grade: 'K-2', tags: ['strings', 'beginner'], color: TEMPLATE_COLORS[0] },
  { id: 't2', name: 'Piano Advanced', instructor: 'Ms. Rivera', venue: 'Piano Lab', grade: '4-6', tags: ['piano', 'advanced'], color: TEMPLATE_COLORS[1] },
  { id: 't3', name: 'Brass Ensemble', instructor: 'Mr. Park', venue: 'Auditorium', grade: '5-6', tags: ['brass', 'ensemble'], color: TEMPLATE_COLORS[2] },
  { id: 't4', name: 'Percussion Workshop', instructor: 'Mr. Johnson', venue: 'Music Hall', grade: '3-4', tags: ['percussion'], color: TEMPLATE_COLORS[3] },
  { id: 't5', name: 'Choir Practice', instructor: 'Ms. Davis', venue: 'Choir Room', grade: 'All', tags: ['choral'], color: TEMPLATE_COLORS[4] },
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
      {/* Top resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => handleResizeStart('top', e)}
        style={{ backgroundColor: template.color }}
      />

      {/* Content */}
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

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => handleResizeStart('bottom', e)}
        style={{ backgroundColor: template.color }}
      />

      {/* Delete button (only when selected) */}
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
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
          <input
            type="text"
            value={localTemplate.name}
            onChange={(e) => setLocalTemplate((t) => ({ ...t, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Instructor */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Instructor (optional)</label>
          <input
            type="text"
            value={localTemplate.instructor ?? ''}
            onChange={(e) => setLocalTemplate((t) => ({ ...t, instructor: e.target.value }))}
            placeholder="Leave blank for auto-assign"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Venue */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Venue (optional)</label>
          <input
            type="text"
            value={localTemplate.venue ?? ''}
            onChange={(e) => setLocalTemplate((t) => ({ ...t, venue: e.target.value }))}
            placeholder="Leave blank for auto-assign"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Grade */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Grade (optional)</label>
          <input
            type="text"
            value={localTemplate.grade ?? ''}
            onChange={(e) => setLocalTemplate((t) => ({ ...t, grade: e.target.value }))}
            placeholder="e.g., K-2, 3-5"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tags (comma-separated, optional)</label>
          <input
            type="text"
            value={localTemplate.tags?.join(', ') ?? ''}
            onChange={(e) =>
              setLocalTemplate((t) => ({
                ...t,
                tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              }))
            }
            placeholder="e.g., strings, beginner"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Time Info (read-only) */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs font-medium text-slate-700 mb-1">Schedule</p>
          <p className="text-sm text-slate-600">
            {DAYS[placed.dayIndex]}<br />
            {formatHour(placed.startHour)} – {formatHour(placed.startHour + placed.durationHours)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Drag edges to resize
          </p>
        </div>

        {/* Save Button */}
        <Button variant="primary" onClick={handleSave} className="w-full">
          Save Changes
        </Button>
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
  const [newTemplateModalOpen, setNewTemplateModalOpen] = useState(false);

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
      durationHours: 1, // default 1 hour
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
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setNewTemplateModalOpen(false);
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
