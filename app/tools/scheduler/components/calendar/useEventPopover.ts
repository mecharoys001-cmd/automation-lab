'use client';

import { useState, useCallback, useRef } from 'react';
import type { CalendarEvent } from './types';

export interface PopoverState {
  event: CalendarEvent | null;
  anchorRect: DOMRect | null;
  pinned: boolean;
}

export function useEventPopover() {
  const [state, setState] = useState<PopoverState>({
    event: null,
    anchorRect: null,
    pinned: false,
  });

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPopover = useCallback((event: CalendarEvent, anchorEl: HTMLElement) => {
    // Clear any pending leave timer
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }

    // Show after brief delay to avoid flicker
    hoverTimerRef.current = setTimeout(() => {
      const rect = anchorEl.getBoundingClientRect();
      setState((prev) => {
        // Don't override a pinned popover for a different event
        if (prev.pinned && prev.event?.id !== event.id) return prev;
        return { event, anchorRect: rect, pinned: prev.pinned && prev.event?.id === event.id };
      });
    }, 200);
  }, []);

  const hidePopover = useCallback(() => {
    // Clear pending show timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    // Delay hide to allow moving to popover
    leaveTimerRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.pinned) return prev; // Don't hide if pinned
        return { event: null, anchorRect: null, pinned: false };
      });
    }, 200);
  }, []);

  const pinPopover = useCallback(() => {
    setState((prev) => ({ ...prev, pinned: true }));
  }, []);

  const closePopover = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setState({ event: null, anchorRect: null, pinned: false });
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent, anchorEl: HTMLElement) => {
    // Clear timers
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);

    const rect = anchorEl.getBoundingClientRect();
    setState((prev) => {
      // If clicking same event that's pinned, close it
      if (prev.pinned && prev.event?.id === event.id) {
        return { event: null, anchorRect: null, pinned: false };
      }
      // Otherwise pin it open
      return { event, anchorRect: rect, pinned: true };
    });
  }, []);

  return {
    popoverState: state,
    showPopover,
    hidePopover,
    pinPopover,
    closePopover,
    handleEventClick,
  };
}
