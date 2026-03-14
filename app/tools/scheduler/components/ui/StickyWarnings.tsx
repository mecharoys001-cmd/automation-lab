'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
 * STICKY WARNINGS
 *
 * When form validation warnings (e.g. "No staff available") are
 * scrolled out of view inside a modal, this system shows them in
 * a sticky banner at the bottom of the scrollable area so the
 * user always sees active warnings.
 *
 * USAGE:
 *
 *   const bodyRef = useRef<HTMLDivElement>(null);
 *   const { warningRef, hiddenIds } = useStickyWarnings(bodyRef);
 *
 *   // Inline warning (attach ref when warning is active)
 *   {hasWarning && (
 *     <span ref={warningRef('staff')}>No staff available</span>
 *   )}
 *
 *   // Sticky banner at end of form content
 *   <StickyWarningBanner warnings={[
 *     { id: 'staff', label: 'Staff', message: 'No staff available' },
 *   ].filter(w => hiddenIds.has(w.id))} />
 *
 * ───────────────────────────────────────────────────────────── */

export interface StickyWarning {
  id: string;
  label: string;
  message: React.ReactNode;
}

/**
 * Tracks which warning elements are scrolled out of view within a
 * scroll container. Returns refs to attach to inline warnings and
 * a set of IDs for warnings currently hidden.
 */
export function useStickyWarnings(scrollRef: React.RefObject<HTMLElement | null>) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // (Re)create observer when scroll container changes
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.stickyWarningId;
            if (!id) continue;
            if (entry.isIntersecting) {
              if (next.has(id)) { next.delete(id); changed = true; }
            } else {
              if (!next.has(id)) { next.add(id); changed = true; }
            }
          }
          return changed ? next : prev;
        });
      },
      { root, threshold: 0 },
    );

    observerRef.current = observer;

    // Observe any elements that were registered before the observer was ready
    for (const [, el] of elementsRef.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [scrollRef]);

  /**
   * Returns a callback ref to attach to an inline warning element.
   * When the element mounts, it starts being observed; when it unmounts,
   * observation stops and it's removed from hiddenIds.
   */
  const warningRef = useCallback((id: string) => {
    return (el: HTMLElement | null) => {
      const prev = elementsRef.current.get(id);

      if (el) {
        // Mount: register + observe
        el.dataset.stickyWarningId = id;
        elementsRef.current.set(id, el);
        observerRef.current?.observe(el);
      } else if (prev) {
        // Unmount: unobserve + clean up
        observerRef.current?.unobserve(prev);
        elementsRef.current.delete(id);
        setHiddenIds((p) => {
          if (!p.has(id)) return p;
          const next = new Set(p);
          next.delete(id);
          return next;
        });
      }
    };
  }, []);

  return { hiddenIds, warningRef };
}

/**
 * Renders a sticky banner at the bottom of a scrollable area showing
 * warnings that have been scrolled out of view.
 *
 * Place this as a DIRECT child of the scroll container (not nested in a wrapper div).
 */
export function StickyWarningBanner({ warnings }: { warnings: StickyWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-10 bg-red-50 border-t border-red-200 px-5 py-2.5 space-y-1 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {warnings.map((w) => (
        <div key={w.id} className="flex items-start gap-1.5 text-[11px] text-red-600">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">{w.label}:</span>{' '}
            {w.message}
          </span>
        </div>
      ))}
    </div>
  );
}
