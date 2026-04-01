'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Program } from '@/types/database';

interface ProgramContextValue {
  programs: Program[];
  selectedProgramId: string | null;
  selectedProgram: Program | null;
  setSelectedProgramId: (id: string) => void;
  loading: boolean;
  refetchPrograms: () => Promise<void>;
  /** Update wizard state for the selected program */
  updateWizardState: (wizardCompleted: boolean, wizardStep: number) => Promise<void>;
  /** Whether the programs API response was scoped by access control */
  accessScoped: boolean | null;
  /** Number of programs the user is authorized for (from API response) */
  authorizedProgramCount: number | null;
  /** Whether server-side program access enforcement is active (true for all users including master admins) */
  enforcementActive: boolean | null;
}

// Program ID is persisted in an httpOnly cookie via /api/selected-program
// so it is not readable by third-party scripts on the page.

const ProgramContext = createContext<ProgramContextValue>({
  programs: [],
  selectedProgramId: null,
  selectedProgram: null,
  setSelectedProgramId: () => {},
  loading: true,
  refetchPrograms: async () => {},
  updateWizardState: async () => {},
  accessScoped: null,
  authorizedProgramCount: null,
  enforcementActive: null,
});

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessScoped, setAccessScoped] = useState<boolean | null>(null);
  const [authorizedProgramCount, setAuthorizedProgramCount] = useState<number | null>(null);
  const [enforcementActive, setEnforcementActive] = useState<boolean | null>(null);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/programs');
      const data = await res.json();
      const progs: Program[] = data.programs ?? [];
      setPrograms(progs);
      setAccessScoped(data.accessScoped ?? null);
      setAuthorizedProgramCount(data.authorizedProgramCount ?? null);
      setEnforcementActive(data.enforcement_active ?? null);

      // Restore from httpOnly cookie via server endpoint, or pick first
      let stored: string | null = null;
      try {
        const cookieRes = await fetch('/api/selected-program');
        if (cookieRes.ok) {
          const cookieData = await cookieRes.json();
          stored = cookieData.selectedProgramId ?? null;
        }
      } catch {
        // Cookie endpoint unavailable — fall through to default
      }
      const validStored = stored && progs.some((p) => p.id === stored);

      if (validStored) {
        setSelectedProgramId(stored);
      } else if (progs.length > 0) {
        setSelectedProgramId(progs[0].id);
      }
    } catch (err) {
      console.error('Failed to load programs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    // One-time migration: remove the old localStorage key so the program ID
    // is no longer readable by third-party scripts on the page.
    try { localStorage.removeItem('symphonix-selected-program'); } catch { /* noop */ }
  }, [fetchPrograms]);

  const handleSetProgramId = useCallback((id: string) => {
    setSelectedProgramId(id);
    // Persist to httpOnly cookie via server endpoint
    fetch('/api/selected-program', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: id }),
    }).catch(() => {
      // Best-effort persistence
    });
  }, []);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;

  const updateWizardState = useCallback(async (wizardCompleted: boolean, wizardStep: number) => {
    if (!selectedProgramId) return;
    try {
      const res = await fetch(`/api/programs/${selectedProgramId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wizard_completed: wizardCompleted, wizard_step: wizardStep }),
      });
      if (!res.ok) throw new Error('Failed to update wizard state');
      // Update local state
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === selectedProgramId
            ? { ...p, wizard_completed: wizardCompleted, wizard_step: wizardStep }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to update wizard state:', err);
    }
  }, [selectedProgramId]);

  return (
    <ProgramContext.Provider
      value={{
        programs,
        selectedProgramId,
        selectedProgram,
        setSelectedProgramId: handleSetProgramId,
        loading,
        refetchPrograms: fetchPrograms,
        updateWizardState,
        accessScoped,
        authorizedProgramCount,
        enforcementActive,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  return useContext(ProgramContext);
}
