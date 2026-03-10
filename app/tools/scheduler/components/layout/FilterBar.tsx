'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  User,
  MapPin,
  CircleDot,
  GraduationCap,
  CalendarDays,
  Tag,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Badge } from '../ui/Badge';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  tooltip: string;
  options: FilterOption[];
}

export type ActiveFilters = Record<string, string[]>;

interface FilterBarProps {
  filters?: FilterConfig[];
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Default filter definitions
// ---------------------------------------------------------------------------

const defaultFilters: FilterConfig[] = [
  {
    key: 'instructor',
    label: 'Instructor',
    icon: User,
    tooltip: 'Filter by instructor',
    options: [],
  },
  {
    key: 'venue',
    label: 'Venue',
    icon: MapPin,
    tooltip: 'Filter by venue',
    options: [],
  },
  {
    key: 'status',
    label: 'Status',
    icon: CircleDot,
    tooltip: 'Filter by session status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'canceled', label: 'Canceled' },
      { value: 'completed', label: 'Completed' },
    ],
  },
  {
    key: 'grade',
    label: 'Grade Group',
    icon: GraduationCap,
    tooltip: 'Filter by grade group',
    options: [
      { value: 'Grade K-1', label: 'Grades K-1' },
      { value: 'Grade 1-2', label: 'Grades 1-2' },
      { value: 'Grade 2-3', label: 'Grades 2-3' },
      { value: 'Grade 3-4', label: 'Grades 3-4' },
      { value: 'Grade 4-5', label: 'Grades 4-5' },
      { value: 'Grade 4-6', label: 'Grades 4-6' },
      { value: 'Grade 5-6', label: 'Grades 5-6' },
      { value: 'All Grades', label: 'All Grades' },
    ],
  },
  {
    key: 'eventType',
    label: 'Event Type',
    icon: CalendarDays,
    tooltip: 'Filter by event type',
    options: [
      { value: 'strings', label: 'Strings' },
      { value: 'brass', label: 'Brass' },
      { value: 'piano', label: 'Piano' },
      { value: 'percussion', label: 'Percussion' },
      { value: 'choral', label: 'Choral' },
    ],
  },
  {
    key: 'tags',
    label: 'Tags',
    icon: Tag,
    tooltip: 'Filter by event tags',
    options: [
      { value: 'ensemble', label: 'Ensemble' },
      { value: 'solo', label: 'Solo' },
      { value: 'beginner', label: 'Beginner' },
      { value: 'advanced', label: 'Advanced' },
      { value: 'recital-prep', label: 'Recital Prep' },
      { value: 'workshop', label: 'Workshop' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Dropdown sub-component
// ---------------------------------------------------------------------------

function FilterDropdown({
  filter,
  selected,
  onToggle,
}: {
  filter: FilterConfig;
  selected: string[];
  onToggle: (filterKey: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const Icon = filter.icon;
  const hasSelections = selected.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Tooltip text={filter.tooltip}>
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
            hasSelections
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${hasSelections ? 'text-blue-500' : 'text-slate-500'}`} />
          <span>{filter.label}</span>
          {hasSelections && (
            <Badge variant="count" color="blue" className="ml-0.5">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${
            open ? 'rotate-180' : ''
          } ${hasSelections ? 'text-blue-400' : 'text-slate-400'}`} />
        </button>
      </Tooltip>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 max-h-64 overflow-y-auto">
          {filter.options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <Tooltip key={option.value} text={`${isSelected ? 'Remove' : 'Add'} ${filter.label}: ${option.label}`} position="right">
                <button
                  onClick={() => onToggle(filter.key, option.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-slate-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="truncate">{option.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active filter pills
// ---------------------------------------------------------------------------

function FilterPill({
  filterLabel,
  value,
  onRemove,
}: {
  filterLabel: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
      <span className="text-blue-400 mr-0.5">{filterLabel}:</span>
      {value}
      <Tooltip text={`Remove ${filterLabel}: ${value}`}>
        <button
          onClick={onRemove}
          className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </Tooltip>
    </span>
  );
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

export function FilterBar({
  filters = defaultFilters,
  activeFilters,
  onFiltersChange,
  className = '',
}: FilterBarProps) {
  const activeCount = Object.values(activeFilters).reduce(
    (sum, vals) => sum + vals.length,
    0,
  );

  const handleToggle = useCallback(
    (filterKey: string, value: string) => {
      const current = activeFilters[filterKey] ?? [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      const next = { ...activeFilters };
      if (updated.length > 0) {
        next[filterKey] = updated;
      } else {
        delete next[filterKey];
      }
      onFiltersChange(next);
    },
    [activeFilters, onFiltersChange],
  );

  const handleRemovePill = useCallback(
    (filterKey: string, value: string) => {
      const current = activeFilters[filterKey] ?? [];
      const updated = current.filter((v) => v !== value);
      const next = { ...activeFilters };
      if (updated.length > 0) {
        next[filterKey] = updated;
      } else {
        delete next[filterKey];
      }
      onFiltersChange(next);
    },
    [activeFilters, onFiltersChange],
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  // Build a lookup for filter labels
  const filterLabelMap = Object.fromEntries(
    filters.map((f) => [f.key, f.label]),
  );

  return (
    <div className={`bg-white border-b border-slate-200 ${className}`}>
      {/* Filter buttons row */}
      <div className="flex items-center gap-2.5 px-6 py-2.5">
        {filters.map((filter) => (
          <FilterDropdown
            key={filter.key}
            filter={filter}
            selected={activeFilters[filter.key] ?? []}
            onToggle={handleToggle}
          />
        ))}

        {activeCount > 0 && (
          <Tooltip text="Remove all active filters">
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
              <Badge variant="count" color="blue" className="ml-0.5">
                {activeCount}
              </Badge>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Active filter pills row (only shown when filters are active) */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 px-6 pb-2.5 flex-wrap">
          {Object.entries(activeFilters).map(([key, values]) =>
            values.map((value) => (
              <FilterPill
                key={`${key}-${value}`}
                filterLabel={filterLabelMap[key] ?? key}
                value={value}
                onRemove={() => handleRemovePill(key, value)}
              />
            )),
          )}
        </div>
      )}
    </div>
  );
}
