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

function trackEvent(event: {
  event_type: 'page_view' | 'button_click' | 'form_submit';
  page_path: string;
  element_id?: string;
  element_text?: string;
  metadata?: Record<string, unknown>;
}) {
  const sessionId = getSessionId();
  if (!sessionId) return;

  // Use sendBeacon for reliability, fall back to fetch
  const payload = JSON.stringify({ session_id: sessionId, ...event });
  const sent = navigator.sendBeacon?.('/api/analytics/track', new Blob([payload], { type: 'application/json' }));
  if (!sent) {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* silent fail - analytics should never break the app */ });
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

  // Track button clicks and form submissions via event delegation
  const handleClick = useCallback((e: MouseEvent) => {
    if (!isAuthenticated.current) return;
    const target = e.target as HTMLElement;

    // Find closest button or link with data-track attribute, or any button/a
    const trackable = target.closest('[data-track]') || target.closest('button') || target.closest('a[href]');
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
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('submit', handleSubmit, { capture: true });
    };
  }, [handleClick, handleSubmit]);

  return null;
}
