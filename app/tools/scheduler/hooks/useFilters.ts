import { useState, useCallback, useMemo } from 'react';
import type { ActiveFilters } from '../components/layout/DynamicFilterBar';

/**
 * Hook for managing filter state and applying filters to data
 * 
 * @example
 * const { activeFilters, setActiveFilters, applyFilters } = useFilters();
 * 
 * const filteredSessions = applyFilters(sessions, {
 *   instructor: (session, values) => values.includes(session.instructor?.name),
 *   status: (session, values) => values.includes(session.status),
 *   tag_event_type: (session, values) => session.tags?.some(tag => values.includes(tag)),
 * });
 */

export type FilterMatcher<T> = (item: T, values: string[]) => boolean;

export function useFilters<T = unknown>() {
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  const applyFilters = useCallback(
    (items: T[], matchers: Record<string, FilterMatcher<T>>) => {
      // If no filters active, return all items
      if (Object.keys(activeFilters).length === 0) {
        return items;
      }

      return items.filter(item => {
        // Item must match ALL active filter groups (AND logic)
        return Object.entries(activeFilters).every(([filterKey, values]) => {
          if (values.length === 0) return true;
          
          const matcher = matchers[filterKey];
          if (!matcher) return true; // Unknown filter key = ignore
          
          return matcher(item, values);
        });
      });
    },
    [activeFilters],
  );

  const clearFilters = useCallback(() => {
    setActiveFilters({});
  }, []);

  const hasActiveFilters = useMemo(
    () => Object.values(activeFilters).some(vals => vals.length > 0),
    [activeFilters],
  );

  const activeFilterCount = useMemo(
    () => Object.values(activeFilters).reduce((sum, vals) => sum + vals.length, 0),
    [activeFilters],
  );

  return {
    activeFilters,
    setActiveFilters,
    applyFilters,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
