import { useState, useEffect, useCallback, useRef } from 'react';
import { useProgram } from '../admin/ProgramContext';

const PREF_KEY = 'calendar_time_range';
const DEBOUNCE_MS = 500;

interface TimeRangeState {
  startHour: number;
  endHour: number;
  setStartHour: (h: number) => void;
  setEndHour: (h: number) => void;
}

/**
 * Manages calendar visible-time-range state with account-level persistence.
 * Persists per authenticated user and per selected program via /api/user-preferences.
 * Falls back to the provided defaults when no persisted value exists or on error.
 */
export function usePersistedTimeRange(
  defaultStart = 8,
  defaultEnd = 15,
): TimeRangeState {
  const { selectedProgramId } = useProgram();
  const [startHour, setStartHourRaw] = useState(defaultStart);
  const [endHour, setEndHourRaw] = useState(defaultEnd);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Load persisted value when program changes ──────────────────────
  useEffect(() => {
    // Reset to defaults immediately so we never show stale values
    // from a previous program while the fetch is in-flight.
    setStartHourRaw(defaultStart);
    setEndHourRaw(defaultEnd);

    if (!selectedProgramId) return;

    let cancelled = false;

    fetch(
      `/api/user-preferences?key=${PREF_KEY}&program_id=${selectedProgramId}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.value) {
          const s = Number(data.value.startHour);
          const e = Number(data.value.endHour);
          if (!Number.isNaN(s) && !Number.isNaN(e) && s < e) {
            setStartHourRaw(s);
            setEndHourRaw(e);
          }
        }
      })
      .catch(() => {
        // Silently fall back to defaults — persistence is best-effort
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProgramId, defaultStart, defaultEnd]);

  // ── Debounced save ─────────────────────────────────────────────────
  const persist = useCallback(
    (start: number, end: number) => {
      if (!selectedProgramId) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch('/api/user-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: PREF_KEY,
            program_id: selectedProgramId,
            value: { startHour: start, endHour: end },
          }),
        }).catch(() => {
          // Best-effort persistence
        });
      }, DEBOUNCE_MS);
    },
    [selectedProgramId],
  );

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // ── Wrapped setters that also trigger persistence ──────────────────
  const setStartHour = useCallback(
    (h: number) => {
      setStartHourRaw(h);
      setEndHourRaw((prev) => {
        persist(h, prev);
        return prev;
      });
    },
    [persist],
  );

  const setEndHour = useCallback(
    (h: number) => {
      setEndHourRaw(h);
      setStartHourRaw((prev) => {
        persist(prev, h);
        return prev;
      });
    },
    [persist],
  );

  return { startHour, endHour, setStartHour, setEndHour };
}
