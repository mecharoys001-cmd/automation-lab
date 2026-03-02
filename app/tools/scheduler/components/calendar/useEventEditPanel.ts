'use client';

import { useState, useCallback } from 'react';
import type { CalendarEvent } from './types';

export interface EventEditPanelState {
  event: CalendarEvent | null;
  open: boolean;
}

export function useEventEditPanel() {
  const [state, setState] = useState<EventEditPanelState>({
    event: null,
    open: false,
  });

  const openPanel = useCallback((event: CalendarEvent) => {
    setState({ event, open: true });
  }, []);

  const closePanel = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    panelState: state,
    openPanel,
    closePanel,
  };
}
