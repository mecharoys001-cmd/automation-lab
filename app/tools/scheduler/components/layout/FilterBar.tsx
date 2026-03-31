'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  emoji?: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  tooltip: string;
  options: FilterOption[];
  /** Message shown when options array is empty */
  emptyMessage?: string;
  /** Link target for the empty state (e.g. setup page) */
  emptyHref?: string;
  /** Label for the empty state link */
  emptyLinkLabel?: string;
}

export type ActiveFilters = Record<string, string[]>;

interface FilterBarProps {
  filters?: FilterConfig[];
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  className?: string;
  /** Total events before filtering (shows "X of Y" indicator) */
  totalCount?: number;
  /** Events after filtering */
  filteredCount?: number;
}

// ---------------------------------------------------------------------------
// Default filter definitions
// ---------------------------------------------------------------------------

const defaultFilters: FilterConfig[] = [
  {
    key: 'instructor',
    label: 'Staff',
    icon: User,
    tooltip: 'Filter by staff member',
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const Icon = filter.icon;
  const hasSelections = selected.length > 0;

  return (
    <div className="relative">
      <Tooltip text={filter.tooltip}>
        <button
          ref={triggerRef}
          onClick={() => {
            if (!open && triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              setDropdownPos({ top: rect.bottom + 4, left: rect.left });
            }
            setOpen(!open);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
            hasSelections
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${hasSelections ? 'text-blue-600' : 'text-slate-600'}`} />
          <span>{filter.label}</span>
          {hasSelections && (
            <Badge variant="count" color="blue" className="ml-0.5">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${
            open ? 'rotate-180' : ''
          } ${hasSelections ? 'text-blue-600' : 'text-slate-700'}`} />
        </button>
      </Tooltip>

      {/* Dropdown panel — fixed position to escape overflow:hidden parents */}
      {open && (
        <>
          <div className="fixed inset-0 z-[9990]" onClick={() => setOpen(false)} />
          <div
            className="fixed w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-[9991] max-h-64 overflow-y-auto"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
          {filter.options.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-slate-600 text-center">
              <p>{filter.emptyMessage || `No ${filter.label.toLowerCase()} available`}</p>
              {filter.emptyHref && (
                <a
                  href={filter.emptyHref}
                  className="inline-block mt-1.5 text-blue-600 hover:text-blue-700 underline underline-offset-2"
                >
                  {filter.emptyLinkLabel || 'Set up now'}
                </a>
              )}
            </div>
          ) : (
            filter.options.map((option) => {
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
                        ? 'bg-blue-600 border-blue-500'
                        : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {option.emoji && <span className="text-base shrink-0">{option.emoji}</span>}
                    <span className="truncate">{option.label}</span>
                  </button>
                </Tooltip>
              );
            })
          )}
        </div>
        </>
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
  emoji,
  onRemove,
}: {
  filterLabel: string;
  value: string;
  emoji?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
      <span className="text-blue-400 mr-0.5">{filterLabel}:</span>
      {emoji && <span>{emoji}</span>}
      {value}
      <Tooltip text={`Remove ${filterLabel}: ${value}`}>
        <button
          onClick={onRemove}
          className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 transition-colors cursor-pointer"
          aria-label={`Remove filter ${filterLabel}: ${value}`}
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
  totalCount,
  filteredCount,
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

  // Build a lookup for option emojis: { filterKey: { optionValue: emoji } }
  const emojiLookup = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const f of filters) {
      for (const opt of f.options) {
        if (opt.emoji) {
          if (!map[f.key]) map[f.key] = {};
          map[f.key][opt.value] = opt.emoji;
        }
      }
    }
    return map;
  }, [filters]);

  return (
    <div className={`bg-white border-b border-slate-200 relative z-[100] ${className}`}>
      {/* Filter buttons row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 px-3 sm:px-6 py-2.5 overflow-x-auto">
        {filters.map((filter) => (
          <FilterDropdown
            key={filter.key}
            filter={filter}
            selected={activeFilters[filter.key] ?? []}
            onToggle={handleToggle}
          />
        ))}

        {activeCount > 0 && (
          <>
            <Tooltip text="Remove all active filters">
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
                <Badge variant="count" color="blue" className="ml-0.5">
                  {activeCount}
                </Badge>
              </button>
            </Tooltip>
            {totalCount != null && filteredCount != null && (
              <span className="text-[12px] text-slate-600 ml-1">
                Showing {filteredCount} of {totalCount} session{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </>
        )}
      </div>

      {/* Active filter pills row (only shown when filters are active) */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 sm:px-6 pb-2.5 flex-wrap">
          {Object.entries(activeFilters).map(([key, values]) =>
            values.map((value) => (
              <FilterPill
                key={`${key}-${value}`}
                filterLabel={filterLabelMap[key] ?? key}
                value={value}
                emoji={emojiLookup[key]?.[value]}
                onRemove={() => handleRemovePill(key, value)}
              />
            )),
          )}
        </div>
      )}
    </div>
  );
}
