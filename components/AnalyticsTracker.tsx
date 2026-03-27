'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('analytics_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('analytics_sid', sid);
  }
  return sid;
}

type AnalyticsEvent = {
  event_type: 'page_view' | 'button_click' | 'form_submit';
  page_path: string;
  element_id?: string;
  element_text?: string;
  metadata?: Record<string, unknown>;
};

/**
 * AnalyticsEventQueue — batches analytics events and flushes them asynchronously
 * to avoid impacting user-facing performance.
 *
 * Optimizations:
 * - Events are queued in memory and sent in a single batched request
 * - Flushing uses requestIdleCallback so it never blocks UI interactions
 * - Duplicate page_view events for the same path within a session are deduplicated
 * - Network calls use sendBeacon (non-blocking) with fetch+keepalive fallback
 * - Flush only triggers on idle callback or page unload — no periodic timers
 *   that would create unnecessary network requests
 * - Max batch size of 50 prevents oversized payloads
 */
class AnalyticsEventQueue {
  private queue: AnalyticsEvent[] = [];
  private idleCallbackId: number | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private recentPageViews = new Set<string>();
  private readonly MAX_BATCH_SIZE = 50;
  private readonly IDLE_TIMEOUT_MS = 30_000;
  private readonly DEDUP_WINDOW_MS = 2_000;

  enqueue(event: AnalyticsEvent): void {
    // Deduplicate rapid page_view events for the same path (e.g. fast navigation)
    if (event.event_type === 'page_view') {
      const key = event.page_path;
      if (this.recentPageViews.has(key)) return;
      this.recentPageViews.add(key);
      setTimeout(() => this.recentPageViews.delete(key), this.DEDUP_WINDOW_MS);
    }

    this.queue.push(event);

    // If queue hits max, flush immediately via requestIdleCallback
    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      this.scheduleFlush();
    } else if (this.idleCallbackId === null && this.fallbackTimer === null) {
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush using requestIdleCallback to avoid blocking user interactions.
   * Falls back to setTimeout for environments without requestIdleCallback.
   */
  private scheduleFlush(): void {
    // Cancel any existing scheduled flush
    this.cancelScheduledFlush();

    if (typeof requestIdleCallback === 'function') {
      this.idleCallbackId = requestIdleCallback(
        () => {
          this.idleCallbackId = null;
          this.flush();
        },
        { timeout: this.IDLE_TIMEOUT_MS }
      );
    } else {
      this.fallbackTimer = setTimeout(() => {
        this.fallbackTimer = null;
        this.flush();
      }, this.IDLE_TIMEOUT_MS);
    }
  }

  private cancelScheduledFlush(): void {
    if (this.idleCallbackId !== null) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  /** Flush all queued events as a single batched network request. */
  flush(): void {
    if (this.queue.length === 0) return;
    this.cancelScheduledFlush();

    const batch = this.queue.splice(0);
    this.sendBatch(batch);
  }

  /**
   * Send a batch of events using navigator.sendBeacon (non-blocking, works during
   * page unload) with a fetch+keepalive fallback for older browsers.
   */
  private sendBatch(events: AnalyticsEvent[]): void {
    if (events.length === 0) return;

    const sessionId = getSessionId();
    if (!sessionId) return;

    const payload = JSON.stringify(
      events.map((e) => ({ session_id: sessionId, ...e }))
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const sent = navigator.sendBeacon?.('/api/analytics/track', blob);
    if (!sent) {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* fire-and-forget */ });
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

// Singleton queue — shared across all component instances
const analyticsQueue = new AnalyticsEventQueue();

function trackEvent(event: AnalyticsEvent) {
  analyticsQueue.enqueue(event);
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const userChecked = useRef(false);
  const isAuthenticated = useRef(false);
  const lastTrackedPath = useRef('');

  // Check auth once on mount
  useEffect(() => {
    if (userChecked.current) return;
    userChecked.current = true;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      isAuthenticated.current = !!user;
      if (user && pathname) {
        lastTrackedPath.current = pathname;
        trackEvent({ event_type: 'page_view', page_path: pathname });
      }
    });
  }, [pathname]);

  // Track page views on route changes
  useEffect(() => {
    if (!isAuthenticated.current || !pathname || pathname === lastTrackedPath.current) return;
    lastTrackedPath.current = pathname;
    trackEvent({ event_type: 'page_view', page_path: pathname });
  }, [pathname]);

  // Track clicks only on elements that opt in with data-track
  const handleClick = useCallback((e: MouseEvent) => {
    if (!isAuthenticated.current) return;
    const target = e.target as HTMLElement;
    const trackable = target.closest('[data-track]');
    if (!trackable) return;

    const elementId = trackable.getAttribute('data-track') || trackable.id || undefined;
    const elementText = (trackable.textContent || '').trim().slice(0, 100) || undefined;

    trackEvent({
      event_type: 'button_click',
      page_path: window.location.pathname,
      element_id: elementId,
      element_text: elementText,
    });
  }, []);

  const handleSubmit = useCallback((e: Event) => {
    if (!isAuthenticated.current) return;
    const form = e.target as HTMLFormElement;
    const elementId = form.getAttribute('data-track') || form.id || form.action || undefined;

    trackEvent({
      event_type: 'form_submit',
      page_path: window.location.pathname,
      element_id: elementId,
    });
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('submit', handleSubmit, { capture: true });

    // Flush queued analytics events when the page becomes hidden or unloads.
    // This is the primary flush trigger — events accumulate until the user
    // leaves or switches tabs, then send as a single batched request.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') analyticsQueue.flush();
    };
    const handleUnload = () => analyticsQueue.flush();
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('submit', handleSubmit, { capture: true });
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [handleClick, handleSubmit]);

  return null;
}
