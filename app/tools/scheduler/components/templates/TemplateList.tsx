'use client';

import { useState, useMemo } from 'react';
import {
  Search, GripVertical, Pencil, Trash2, Loader2,
  Clock, MapPin, User, SlidersHorizontal, ChevronDown, X,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Pill } from '../ui/Pill';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Minimal template shape that works for both the Classes page (SessionTemplate)
 *  and the Schedule Builder (its local Template type). Each consumer maps its
 *  data into this shape before passing it in. */
export interface TemplateListItem {
  id: string;
  /** Primary display name (e.g. subject or composed label). */
  name: string;
  /** Day-of-week label(s) for display. */
  dayLabel: string;
  /** Formatted time range string, e.g. "9:00 AM – 10:00 AM". */
  timeLabel: string;
  /** Grade groups for pill display. */
  gradeGroups?: string[];
  /** Instructor display name. */
  instructor?: string;
  /** Venue display name. */
  venue?: string;
  /** Template type label (e.g. "Fully Defined"). For table mode. */
  typeLabel?: string;
  /** Cycle label (e.g. "Wk 1/2" or "Weekly"). For table mode. */
  cycleLabel?: string;
  /** Freeform tags for categorization / filtering. */
  tags?: string[];
  /** Whether the template is active. For table mode status badge. */
  isActive?: boolean;
  /** Whether instructor rotates. For draggable mode. */
  instructorRotation?: boolean;
  /** Color swatch for the template. For draggable mode. */
  color?: string;
  /** Schedule summary (e.g. "Mon/Wed 9AM–10AM"). For draggable mode. */
  scheduleLabel?: string;
  /** Week cycle badge text (e.g. "W1/2"). For draggable mode. */
  cycleBadge?: { label: string; tooltip: string } | null;
}

export interface TemplateListProps {
  /** Display mode: 'table' for Classes page, 'draggable' for Schedule Builder. */
  mode: 'table' | 'draggable';
  /** Templates to display (pre-mapped to TemplateListItem). */
  templates: TemplateListItem[];
  /** Whether data is still loading. */
  loading?: boolean;
  /** Called when the edit action is triggered. */
  onEdit?: (id: string) => void;
  /** Called when the delete action is triggered. */
  onDelete?: (id: string) => void;
  /** Called when a draggable row starts being dragged. */
  onDragStart?: (id: string, e: React.DragEvent) => void;
  /** Called when drag ends. */
  onDragEnd?: () => void;
  /** ID of a template currently being deleted (shows spinner). */
  deletingId?: string | null;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Hide the built-in search bar (if parent manages filtering). */
  hideSearch?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Filter constants
// ──────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const TEMPLATE_TYPES = ['Fully Defined', 'Tagged Slot', 'Auto Assign', 'Time Block'] as const;

interface Filters {
  days: Set<string>;
  types: Set<string>;
  grades: Set<string>;
  tags: Set<string>;
  instructor: string; // '' = all
  venue: string;      // '' = all
  activeOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  days: new Set(),
  types: new Set(),
  grades: new Set(),
  tags: new Set(),
  instructor: '',
  venue: '',
  activeOnly: false,
};

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.days.size > 0) n++;
  if (f.types.size > 0) n++;
  if (f.grades.size > 0) n++;
  if (f.tags.size > 0) n++;
  if (f.instructor) n++;
  if (f.venue) n++;
  if (f.activeOnly) n++;
  return n;
}

function matchesFilters(item: TemplateListItem, f: Filters): boolean {
  if (f.days.size > 0) {
    // dayLabel may contain multiple days separated by slashes or commas
    const itemDays = item.dayLabel.split(/[\/,]\s*/);
    if (!itemDays.some((d) => f.days.has(d.trim()))) return false;
  }
  if (f.types.size > 0 && (!item.typeLabel || !f.types.has(item.typeLabel))) return false;
  if (f.grades.size > 0) {
    const g = item.gradeGroups ?? [];
    if (!g.some((grade) => f.grades.has(grade))) return false;
  }
  if (f.tags.size > 0) {
    const t = item.tags ?? [];
    if (!t.some((tag) => f.tags.has(tag))) return false;
  }
  if (f.instructor && item.instructor !== f.instructor) return false;
  if (f.venue && item.venue !== f.venue) return false;
  if (f.activeOnly && item.isActive === false) return false;
  return true;
}

// ──────────────────────────────────────────────────────────────
// Searchable fields
// ──────────────────────────────────────────────────────────────

function matchesSearch(item: TemplateListItem, query: string): boolean {
  const q = query.toLowerCase();
  return [
    item.name,
    item.dayLabel,
    item.instructor,
    item.venue,
    item.typeLabel,
    item.scheduleLabel,
    ...(item.gradeGroups ?? []),
    ...(item.tags ?? []),
  ].some((field) => field?.toLowerCase().includes(q));
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export function TemplateList({
  mode,
  templates,
  loading = false,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  deletingId = null,
  searchPlaceholder,
  hideSearch = false,
}: TemplateListProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Derive unique options from template data
  const filterOptions = useMemo(() => {
    const grades = new Set<string>();
    const tags = new Set<string>();
    const instructors = new Set<string>();
    const venues = new Set<string>();
    for (const t of templates) {
      (t.gradeGroups ?? []).forEach((g) => grades.add(g));
      (t.tags ?? []).forEach((tag) => tags.add(tag));
      if (t.instructor) instructors.add(t.instructor);
      if (t.venue) venues.add(t.venue);
    }
    return {
      grades: Array.from(grades).sort(),
      tags: Array.from(tags).sort(),
      instructors: Array.from(instructors).sort(),
      venues: Array.from(venues).sort(),
    };
  }, [templates]);

  const activeFilterCount = countActiveFilters(filters);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (search.trim() && !matchesSearch(t, search)) return false;
      if (!matchesFilters(t, filters)) return false;
      return true;
    });
  }, [templates, search, filters]);

  const toggleSetItem = (key: 'days' | 'types' | 'grades' | 'tags', value: string) => {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  };

  return (
    <div>
      {/* Search + Filter toggle row */}
      {!hideSearch && (
        <div className="flex items-center gap-2 mb-3">
          <div className="relative" style={mode === 'table' ? { maxWidth: 320, flex: 1 } : { flex: 1 }}>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            />
            <input
              type="text"
              placeholder={searchPlaceholder ?? (mode === 'table'
                ? 'Search by day, instructor, venue, grade...'
                : 'Search templates\u2026')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer"
            style={{
              backgroundColor: filtersOpen ? '#EFF6FF' : '#FFFFFF',
              borderColor: filtersOpen ? '#3B82F6' : '#E2E8F0',
              color: filtersOpen ? '#2563EB' : '#334155',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="inline-flex items-center justify-center text-xs font-semibold rounded-full"
                style={{
                  minWidth: 20, height: 20, padding: '0 6px',
                  backgroundColor: '#3B82F6', color: '#FFFFFF',
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: filtersOpen ? 'rotate(180deg)' : undefined }}
            />
          </button>
        </div>
      )}

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            {/* Day of Week - multi-select */}
            <FilterSection label="Day of Week">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {DAYS_OF_WEEK.map((day) => (
                  <FilterChip
                    key={day}
                    label={day.slice(0, 3)}
                    active={filters.days.has(day)}
                    onClick={() => toggleSetItem('days', day)}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Template Type - multi-select */}
            <FilterSection label="Type">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {TEMPLATE_TYPES.map((type) => (
                  <FilterChip
                    key={type}
                    label={type}
                    active={filters.types.has(type)}
                    onClick={() => toggleSetItem('types', type)}
                  />
                ))}
              </div>
            </FilterSection>

            {/* Grade Level - multi-select */}
            {filterOptions.grades.length > 0 && (
              <FilterSection label="Grade">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {filterOptions.grades.map((g) => (
                    <FilterChip
                      key={g}
                      label={g}
                      active={filters.grades.has(g)}
                      onClick={() => toggleSetItem('grades', g)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Tags - multi-select */}
            {filterOptions.tags.length > 0 && (
              <FilterSection label="Tags">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {filterOptions.tags.map((tag) => (
                    <FilterChip
                      key={tag}
                      label={tag}
                      active={filters.tags.has(tag)}
                      onClick={() => toggleSetItem('tags', tag)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Instructor - single select dropdown */}
            {filterOptions.instructors.length > 0 && (
              <FilterSection label="Instructor">
                <FilterSelect
                  value={filters.instructor}
                  onChange={(v) => setFilters((prev) => ({ ...prev, instructor: v }))}
                  options={filterOptions.instructors}
                  allLabel="All Instructors"
                />
              </FilterSection>
            )}

            {/* Venue - single select dropdown */}
            {filterOptions.venues.length > 0 && (
              <FilterSection label="Venue">
                <FilterSelect
                  value={filters.venue}
                  onChange={(v) => setFilters((prev) => ({ ...prev, venue: v }))}
                  options={filterOptions.venues}
                  allLabel="All Venues"
                />
              </FilterSection>
            )}

            {/* Active Status - toggle */}
            <FilterSection label="Status">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, activeOnly: !prev.activeOnly }))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer"
                style={{
                  backgroundColor: filters.activeOnly ? '#ECFDF5' : '#FFFFFF',
                  borderColor: filters.activeOnly ? '#059669' : '#E2E8F0',
                  color: filters.activeOnly ? '#059669' : '#64748B',
                }}
              >
                {filters.activeOnly ? 'Active Only' : 'Show All'}
              </button>
            </FilterSection>
          </div>

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        mode === 'table' ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-200/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-400">Loading templates&hellip;</span>
          </div>
        )
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div
          className="text-center text-sm text-slate-400"
          style={mode === 'table'
            ? { borderRadius: 12, backgroundColor: '#FFFFFF', padding: 48 }
            : { padding: '32px 16px' }}
        >
          {search.trim() || activeFilterCount > 0
            ? 'No templates match your search or filters.'
            : mode === 'table'
              ? 'No class templates yet. Click \u201cNew Class\u201d to create your first template.'
              : 'No templates yet. Click \u201cCreate Template\u201d to add one.'}
        </div>
      ) : mode === 'table' ? (
        <TableView
          items={filtered}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <DraggableView
          items={filtered}
          onEdit={onEdit}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Table View (Classes page)
// ──────────────────────────────────────────────────────────────

function TableView({
  items,
  onEdit,
  onDelete,
}: {
  items: TemplateListItem[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
            {['Grade Groups', 'Day', 'Time', 'Type', 'Instructor', 'Venue', 'Cycle', 'Status', ''].map((h) => (
              <th
                key={h}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr
              key={t.id}
              style={{ borderBottom: '1px solid #F1F5F9' }}
              className="hover:bg-slate-50 transition-colors"
            >
              {/* Grade Groups */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(t.gradeGroups ?? []).map((g) => (
                    <Pill key={g} variant="grade">{g}</Pill>
                  ))}
                </div>
              </td>
              {/* Day */}
              <td style={{ padding: '12px 16px', fontSize: 14, color: '#0F172A', fontWeight: 500 }}>
                {t.dayLabel}
              </td>
              {/* Time */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#334155' }}>
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {t.timeLabel}
                </div>
              </td>
              {/* Type */}
              <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>
                {t.typeLabel ?? '\u2014'}
              </td>
              {/* Instructor */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#334155' }}>
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {t.instructor ?? '\u2014'}
                </div>
              </td>
              {/* Venue */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#334155' }}>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {t.venue ?? '\u2014'}
                </div>
              </td>
              {/* Cycle */}
              <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748B' }}>
                {t.cycleLabel ?? 'Weekly'}
              </td>
              {/* Status */}
              <td style={{ padding: '12px 16px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 500,
                    backgroundColor: t.isActive !== false ? '#ECFDF5' : '#F1F5F9',
                    color: t.isActive !== false ? '#059669' : '#94A3B8',
                  }}
                >
                  {t.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </td>
              {/* Actions */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {onEdit && (
                    <Tooltip text="Edit template">
                      <button
                        onClick={() => onEdit(t.id)}
                        className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                    </Tooltip>
                  )}
                  {onDelete && (
                    <Tooltip text="Delete template">
                      <button
                        onClick={() => onDelete(t.id)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Draggable View (Schedule Builder)
// ──────────────────────────────────────────────────────────────

function DraggableView({
  items,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  deletingId,
}: {
  items: TemplateListItem[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDragStart?: (id: string, e: React.DragEvent) => void;
  onDragEnd?: () => void;
  deletingId?: string | null;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-slate-900">Saved Templates</h2>
        <Tooltip text={`${items.length} template${items.length === 1 ? '' : 's'} saved`}>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-xl bg-slate-100 text-xs font-medium text-slate-600">
            ({items.length})
          </span>
        </Tooltip>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center bg-slate-50 px-4 py-2.5 border-b border-slate-200">
          <Tooltip text="Template name and color indicator">
            <div className="w-[220px] text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-help">Template Name</div>
          </Tooltip>
          <Tooltip text="Assigned instructor (Rotating = shared across instructors)">
            <div className="flex-1 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-help">Instructor</div>
          </Tooltip>
          <Tooltip text="Days and time slot for this template">
            <div className="w-[180px] text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-help">Schedule</div>
          </Tooltip>
          <Tooltip text="Edit or delete this template">
            <div className="w-[70px] text-xs font-semibold text-slate-500 uppercase tracking-wider text-right cursor-help">Actions</div>
          </Tooltip>
        </div>

        {/* Rows */}
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', item.id);
              // Create a custom drag image
              const ghost = document.createElement('div');
              ghost.textContent = item.name;
              ghost.style.cssText = `
                position: fixed; top: -1000px; left: -1000px;
                padding: 6px 12px; border-radius: 6px; font-size: 12px;
                font-weight: 600; color: white; white-space: nowrap;
                background-color: ${item.color ?? '#3B82F6'}; opacity: 0.9;
              `;
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, 0, 0);
              requestAnimationFrame(() => document.body.removeChild(ghost));
              onDragStart?.(item.id, e);
            }}
            onDragEnd={() => onDragEnd?.()}
            className="flex items-center px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing group"
          >
            {/* Template Name */}
            <div className="w-[220px] flex items-center gap-2">
              <Tooltip text="Drag to schedule">
                <span className="inline-flex"><GripVertical className="w-4 h-4 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" /></span>
              </Tooltip>
              <div className="flex items-center gap-2 min-w-0">
                <Tooltip text="Template color on the schedule grid">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color ?? '#3B82F6' }} />
                </Tooltip>
                <span className="text-[13px] font-medium text-slate-900 truncate">{item.name}</span>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex-1 min-w-0">
              <span className="text-[13px] text-slate-600 truncate block">
                {item.instructor || '\u2014'}
                {item.instructorRotation && (
                  <span className="ml-1.5 text-xs text-violet-600 font-medium">(Rotating)</span>
                )}
              </span>
            </div>

            {/* Schedule */}
            <div className="w-[180px] flex items-center gap-1.5">
              <span className="text-[13px] text-slate-600">{item.scheduleLabel ?? item.timeLabel}</span>
              {item.cycleBadge && (
                <Tooltip text={item.cycleBadge.tooltip}>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none bg-indigo-100 text-indigo-600 whitespace-nowrap">
                    {item.cycleBadge.label}
                  </span>
                </Tooltip>
              )}
            </div>

            {/* Actions */}
            <div className="w-[70px] flex items-center justify-end gap-1">
              {onEdit && (
                <Tooltip text={`Edit ${item.name}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(item.id); }}
                    onDragStart={(e) => e.stopPropagation()}
                    draggable={false}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip text={`Delete ${item.name}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    onDragStart={(e) => e.stopPropagation()}
                    draggable={false}
                    disabled={deletingId === item.id}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      deletingId === item.id
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                    }`}
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No templates yet. Click &quot;Create Template&quot; to add one.
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Filter UI primitives
// ──────────────────────────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="transition-colors cursor-pointer"
      style={{
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 6,
        border: '1px solid',
        borderColor: active ? '#3B82F6' : '#E2E8F0',
        backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
        color: active ? '#2563EB' : '#64748B',
      }}
    >
      {label}
    </button>
  );
}

function FilterSelect({
  value, onChange, options, allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer"
      style={{
        height: 32,
        padding: '0 28px 0 10px',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 6,
        border: '1px solid',
        borderColor: value ? '#3B82F6' : '#E2E8F0',
        backgroundColor: value ? '#EFF6FF' : '#FFFFFF',
        color: value ? '#2563EB' : '#334155',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
