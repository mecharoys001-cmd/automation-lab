'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface UseImpactRealtimeOptions {
  /** Called when a new activity_log or tool_usage row is inserted */
  onEvent?: () => void;
  /** Debounce window in ms (default 2000) */
  debounceMs?: number;
  /** Whether the subscription is active (default true) */
  enabled?: boolean;
}

/**
 * Subscribes to Supabase Realtime inserts on activity_log and tool_usage.
 * Calls onEvent (debounced) so consumers can refetch data.
 * Returns the current connection status.
 */
let channelCounter = 0;

export function useImpactRealtime({
  onEvent,
  debounceMs = 2000,
  enabled = true,
}: UseImpactRealtimeOptions = {}): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelIdRef = useRef(`impact-dashboard-${++channelCounter}`);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const debouncedNotify = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onEventRef.current?.();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    if (!enabled) {
      setStatus('offline');
      return;
    }

    setStatus('connecting');

    const channel: RealtimeChannel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        () => debouncedNotify(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tool_usage' },
        () => debouncedNotify(),
      )
      .subscribe((state) => {
        switch (state) {
          case 'SUBSCRIBED':
            setStatus('live');
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            setStatus('reconnecting');
            break;
          case 'CLOSED':
            setStatus('offline');
            break;
        }
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, debouncedNotify]);

  return status;
}
