'use client';

import { useRef, useState, useEffect, useCallback, memo, type ReactNode } from 'react';

/**
 * Lightweight virtualized grid that uses IntersectionObserver to only render
 * cards that are near or within the viewport. Off-screen items are replaced
 * with lightweight placeholder divs, dramatically reducing DOM element count.
 *
 * Performance characteristics:
 * - Renders only visible items + 1-row buffer above/below
 * - Placeholder divs use a single empty element per off-screen card
 * - Fires performance.mark/measure on each render cycle for monitoring
 */

interface VirtualizedCardGridProps<T> {
  /** Items to render */
  items: T[];
  /** Unique key extractor */
  keyExtractor: (item: T) => string;
  /** Render function for each item */
  renderItem: (item: T) => ReactNode;
  /** Placeholder height for off-screen items (default: 220px) */
  placeholderHeight?: number;
  /** Grid CSS classes */
  className?: string;
  /** Extra attributes for the container */
  containerProps?: Record<string, string | number>;
  /** aria-label for the grid */
  ariaLabel?: string;
}

/** Individual cell that observes its own visibility */
const VirtualizedCell = memo(function VirtualizedCell({
  children,
  placeholderHeight,
  itemKey,
}: {
  children: ReactNode;
  placeholderHeight: number;
  itemKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Once visible, keep rendered (avoids flicker on fast scroll)
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        rootMargin: '200px 0px', // Pre-render 200px above/below viewport
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!isVisible) {
    return (
      <div
        ref={ref}
        data-virtualized-placeholder={itemKey}
        style={{ minHeight: placeholderHeight, contain: 'strict' }}
        className="rounded-lg bg-slate-50"
      />
    );
  }

  return (
    <div ref={ref} data-virtualized-item={itemKey}>
      {children}
    </div>
  );
});

export function VirtualizedCardGrid<T>({
  items,
  keyExtractor,
  renderItem,
  placeholderHeight = 220,
  className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4',
  containerProps = {},
  ariaLabel,
}: VirtualizedCardGridProps<T>) {
  const renderStart = performance.now();

  useEffect(() => {
    const duration = performance.now() - renderStart;
    performance.mark('virtualized-grid-rendered');
    performance.measure('virtualized-grid-render-time', {
      start: renderStart,
      duration,
    });
  });

  return (
    <div
      className={className}
      role="list"
      aria-label={ariaLabel}
      data-virtualized="true"
      data-virtualized-items={items.length}
      {...containerProps}
    >
      {items.map((item) => {
        const key = keyExtractor(item);
        return (
          <VirtualizedCell
            key={key}
            itemKey={key}
            placeholderHeight={placeholderHeight}
          >
            {renderItem(item)}
          </VirtualizedCell>
        );
      })}
    </div>
  );
}
