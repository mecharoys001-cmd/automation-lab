'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  User,
  MapPin,
  CircleDot,
  GraduationCap,
  Tag,
  ChevronDown,
  X,
  Check,
  Loader2,
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
}

export type ActiveFilters = Record<string, string[]>;

interface DynamicFilterBarProps {
  /** Static filters (instructor, venue, status, etc.) */
  staticFilters?: FilterConfig[];
  /** Which tag categories to show as filters (e.g., ['Skills', 'Subject', 'Event Type']) */
  tagCategories?: string[];
  /** Active filter state */
  activeFilters: ActiveFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: ActiveFilters) => void;
  /** CSS classes */
  className?: string;
}

interface TagData {
  id: string;
  name: string;
  emoji?: string | null;
  category: string;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Category icons (can be customized per category)
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Skills: GraduationCap,
  Subject: Tag,
  'Event Type': Tag,
  Administrative: Tag,
  General: Tag,
};

function getCategoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] || Tag;
}

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
          {filter.options.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-slate-400 text-center">
              No options available
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
                        ? 'bg-blue-500 border-blue-500'
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
        >
          <X className="w-3 h-3" />
        </button>
      </Tooltip>
    </span>
  );
}

// ---------------------------------------------------------------------------
// DynamicFilterBar
// ---------------------------------------------------------------------------

export function DynamicFilterBar({
  staticFilters = [],
  tagCategories = [],
  activeFilters,
  onFiltersChange,
  className = '',
}: DynamicFilterBarProps) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Fetch tags from API
  useEffect(() => {
    const fetchTags = async () => {
      if (tagCategories.length === 0) return;
      
      setLoadingTags(true);
      try {
        const res = await fetch('/api/tags');
        if (!res.ok) throw new Error('Failed to load tags');
        const json = await res.json();
        setTags(json.tags ?? []);
      } catch (err) {
        console.error('DynamicFilterBar: Failed to fetch tags:', err);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, [tagCategories.length]);

  // Build dynamic tag filters
  const tagFilters: FilterConfig[] = tagCategories.map(category => {
    const categoryTags = tags.filter(t => t.category === category);
    return {
      key: `tag_${category.toLowerCase().replace(/\s+/g, '_')}`,
      label: category,
      icon: getCategoryIcon(category),
      tooltip: `Filter by ${category}`,
      options: categoryTags.map(tag => ({
        value: tag.name,
        label: tag.name,
        emoji: tag.emoji || undefined,
      })),
    };
  });

  // Combine static and dynamic filters
  const allFilters = [...staticFilters, ...tagFilters];

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

  // Build a lookup for filter labels and emojis
  const filterMetaMap: Record<string, { label: string; options: FilterOption[] }> = Object.fromEntries(
    allFilters.map((f) => [f.key, { label: f.label, options: f.options }]),
  );

  if (loadingTags && tagCategories.length > 0) {
    return (
      <div className={`bg-white border-b border-slate-200 ${className}`}>
        <div className="flex items-center gap-2 px-6 py-3 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading filters...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border-b border-slate-200 ${className}`}>
      {/* Filter buttons row */}
      <div className="flex items-center gap-2.5 px-6 py-2.5 flex-wrap">
        {allFilters.map((filter) => (
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
          {Object.entries(activeFilters).map(([key, values]) => {
            const meta = filterMetaMap[key];
            if (!meta) return null;

            return values.map((value) => {
              const option = meta.options.find(o => o.value === value);
              return (
                <FilterPill
                  key={`${key}-${value}`}
                  filterLabel={meta.label}
                  value={value}
                  emoji={option?.emoji}
                  onRemove={() => handleRemovePill(key, value)}
                />
              );
            });
          })}
        </div>
      )}
    </div>
  );
}
