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

// Batch queue for analytics events
type AnalyticsEvent = {
  event_type: 'page_view' | 'button_click' | 'form_submit';
  page_path: string;
  element_id?: string;
  element_text?: string;
  metadata?: Record<string, unknown>;
};
let eventQueue: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 20;

function sendBatch(events: AnalyticsEvent[]) {
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
    }).catch(() => { /* silent fail */ });
  }
}

function flushEvents() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, eventQueue.length);
  sendBatch(batch);
}

function scheduleFlush() {
  if (flushTimer) return;
  // Use requestIdleCallback to avoid blocking UI, fall back to setTimeout
  const scheduleIdle =
    typeof requestIdleCallback === 'function'
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: FLUSH_INTERVAL_MS })
      : (cb: () => void) => setTimeout(cb, FLUSH_INTERVAL_MS);

  flushTimer = setTimeout(() => {
    scheduleIdle(() => {
      flushEvents();
      flushTimer = null;
    });
  }, FLUSH_INTERVAL_MS) as unknown as NodeJS.Timeout;
}

function trackEvent(event: AnalyticsEvent) {
  eventQueue.push(event);

  // Flush immediately if queue is full, otherwise schedule
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flushEvents();
  } else {
    scheduleFlush();
  }
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
      // Track initial page view if authenticated
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

    // Flush remaining events when the page is unloading
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushEvents();
    };
    const handleUnload = () => flushEvents();
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
