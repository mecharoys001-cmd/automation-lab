'use client';

import { useState, useMemo } from 'react';
import {
  Search, GripVertical, Pencil, Trash2, Loader2,
  Clock, MapPin, User, SlidersHorizontal, ChevronDown, X,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Pill } from '../ui/Pill';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Minimal template shape that works for both the Event Templates page (SessionTemplate)
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
  /** Subject display name. For table mode. */
  subject?: string;
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
  /** Display mode: 'table' for Event Templates page, 'draggable' for Schedule Builder. */
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
                : 'Search events\u2026')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={mode === 'draggable'
                ? 'w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                : 'w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer"
            style={mode === 'draggable'
              ? {
                  backgroundColor: filtersOpen ? '#EFF6FF' : '#FFFFFF',
                  borderColor: filtersOpen ? '#3B82F6' : '#E2E8F0',
                  color: filtersOpen ? '#2563EB' : '#334155',
                }
              : {
                  backgroundColor: filtersOpen ? '#EFF6FF' : '#FFFFFF',
                  borderColor: filtersOpen ? '#3B82F6' : '#E2E8F0',
                  color: filtersOpen ? '#2563EB' : '#334155',
                }
            }
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
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            <span className="ml-2 text-sm text-slate-500">Loading events&hellip;</span>
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
            ? 'No events match your search or filters.'
            : mode === 'table'
              ? 'No event templates yet. Click \u201cNew Event Template\u201d to create your first template.'
              : 'No events yet. Click \u201cCreate Template\u201d to add one.'}
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
// Table View (Event Templates page)
// ──────────────────────────────────────────────────────────────

type SortColumn = 'name' | 'subject' | 'day' | 'time' | 'instructor' | 'venue' | 'cycle' | 'status';
type SortDirection = 'asc' | 'desc';

function TableView({
  items,
  onEdit,
  onDelete,
}: {
  items: TemplateListItem[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;

    return [...items].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortColumn) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'subject':
          aVal = a.subject || '';
          bVal = b.subject || '';
          break;
        case 'day':
          aVal = a.dayLabel || '';
          bVal = b.dayLabel || '';
          break;
        case 'time':
          aVal = a.timeLabel || '';
          bVal = b.timeLabel || '';
          break;
        case 'instructor':
          aVal = a.instructor || '';
          bVal = b.instructor || '';
          break;
        case 'venue':
          aVal = a.venue || '';
          bVal = b.venue || '';
          break;
        case 'cycle':
          aVal = a.cycleLabel || '';
          bVal = b.cycleLabel || '';
          break;
        case 'status':
          aVal = a.isActive !== false ? 'Active' : 'Inactive';
          bVal = b.isActive !== false ? 'Active' : 'Inactive';
          break;
      }

      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, sortColumn, sortDirection]);

  const columns: { key: SortColumn; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'subject', label: 'Subject' },
    { key: 'day', label: 'Day' },
    { key: 'time', label: 'Time' },
    { key: 'instructor', label: 'Instructor' },
    { key: 'venue', label: 'Venue' },
    { key: 'cycle', label: 'Cycle' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
            {columns.map(({ key, label }) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: sortColumn === key ? '#3B82F6' : '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                className="hover:bg-slate-50 transition-colors"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {label}
                  {sortColumn === key && (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5" />
                    )
                  )}
                </div>
              </th>
            ))}
            {/* Grade Groups column (non-sortable) */}
            <th
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
              Grade Groups
            </th>
            {/* Actions column (non-sortable) */}
            <th
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
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((t) => (
            <tr
              key={t.id}
              style={{ borderBottom: '1px solid #F1F5F9' }}
              className="hover:bg-slate-50 transition-colors"
            >
              {/* Name */}
              <td style={{ padding: '12px 16px', fontSize: 14, color: '#0F172A', fontWeight: 600 }}>
                {t.name || '\u2014'}
              </td>
              {/* Subject */}
              <td style={{ padding: '12px 16px', fontSize: 14, color: '#334155' }}>
                {t.subject || '\u2014'}
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
              {/* Grade Groups */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(t.gradeGroups ?? []).map((g) => (
                    <Pill key={g} variant="grade">{g}</Pill>
                  ))}
                </div>
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
        <h2 className="text-base font-semibold text-slate-800">Event Library</h2>
        <Tooltip text={`${items.length} event${items.length === 1 ? '' : 's'} saved`}>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-xl bg-slate-200 text-xs font-medium text-slate-600">
            {items.length}
          </span>
        </Tooltip>
      </div>

      {/* Event cards */}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', item.id);
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
            className="group rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all border hover:shadow-md"
            style={{
              backgroundColor: `${item.color ?? '#3B82F6'}20`,
              borderColor: `${item.color ?? '#3B82F6'}40`,
              borderLeft: `3px solid ${item.color ?? '#3B82F6'}`,
            }}
          >
            {/* Top row: name + grip */}
            <div className="flex items-start gap-2">
              <Tooltip text="Drag to schedule">
                <span className="inline-flex mt-0.5 shrink-0"><GripVertical className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: item.color ?? '#3B82F6' }} /></span>
              </Tooltip>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold leading-tight block truncate" style={{ color: item.color ?? '#3B82F6' }}>{item.name}</span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <Tooltip text={`Edit ${item.name}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(item.id); }}
                      onDragStart={(e) => e.stopPropagation()}
                      draggable={false}
                      className="p-1 rounded hover:bg-white/30 text-slate-500 hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
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
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        deletingId === item.id
                          ? 'text-slate-500 cursor-not-allowed'
                          : 'hover:bg-white/30 text-slate-500 hover:text-red-400'
                      }`}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Bottom row: schedule + instructor meta */}
            <div className="flex items-center gap-2 mt-1.5 ml-[26px]">
              <span className="text-xs font-medium text-slate-700">{item.scheduleLabel ?? item.timeLabel}</span>
              {item.cycleBadge && (
                <Tooltip text={item.cycleBadge.tooltip}>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none bg-indigo-500/20 text-indigo-300 whitespace-nowrap">
                    {item.cycleBadge.label}
                  </span>
                </Tooltip>
              )}
              {item.instructor && (
                <span className="text-xs text-slate-600 truncate">
                  {item.instructor}
                  {item.instructorRotation && <span className="ml-1 text-violet-400">(R)</span>}
                </span>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No events yet. Click &ldquo;Create Template&rdquo; to add one.
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
