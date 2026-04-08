import { useState, useEffect, useCallback, useRef } from 'react';
import { useProgram } from '../admin/ProgramContext';

const PREF_KEY = 'calendar_time_range';
const LS_PREFIX = 'cal_time_range_';
const DEBOUNCE_MS = 500;

interface TimeRangeState {
  startHour: number;
  endHour: number;
  setStartHour: (h: number) => void;
  setEndHour: (h: number) => void;
}

/** Read from localStorage (synchronous, always available). */
function readLocal(programId: string): { startHour: number; endHour: number } | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${programId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const s = Number(parsed.startHour);
    const e = Number(parsed.endHour);
    if (!Number.isNaN(s) && !Number.isNaN(e) && s < e) return { startHour: s, endHour: e };
  } catch { /* ignore */ }
  return null;
}

/** Write to localStorage (synchronous, always available). */
function writeLocal(programId: string, start: number, end: number) {
  try {
    localStorage.setItem(
      `${LS_PREFIX}${programId}`,
      JSON.stringify({ startHour: start, endHour: end }),
    );
  } catch { /* quota errors etc. */ }
}

/**
 * Manages calendar visible-time-range state with layered persistence.
 *
 * 1. localStorage — synchronous, always available, provides instant restore.
 * 2. DB via /api/user-preferences — cross-device, per-user + per-program.
 *
 * On load: restore from localStorage immediately, then attempt DB fetch
 * (DB wins if it responds successfully with a value).
 * On save: write to localStorage immediately, then debounced DB save.
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
    if (!selectedProgramId) {
      setStartHourRaw(defaultStart);
      setEndHourRaw(defaultEnd);
      return;
    }

    // Restore from localStorage immediately (synchronous, no flash)
    const local = readLocal(selectedProgramId);
    if (local) {
      setStartHourRaw(local.startHour);
      setEndHourRaw(local.endHour);
    } else {
      setStartHourRaw(defaultStart);
      setEndHourRaw(defaultEnd);
    }

    // Attempt DB fetch — if it succeeds with a value, it takes precedence
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
            // Sync DB value back to localStorage
            writeLocal(selectedProgramId, s, e);
          }
        }
      })
      .catch(() => {
        // DB unavailable — localStorage value (or defaults) already applied
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProgramId, defaultStart, defaultEnd]);

  // ── Debounced save ─────────────────────────────────────────────────
  const persist = useCallback(
    (start: number, end: number) => {
      if (!selectedProgramId) return;

      // Write to localStorage immediately (synchronous)
      writeLocal(selectedProgramId, start, end);

      // Debounced DB save
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
          // DB unavailable — localStorage already has the value
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
