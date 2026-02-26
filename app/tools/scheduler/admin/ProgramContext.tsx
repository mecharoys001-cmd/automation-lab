'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Program } from '@/types/database';

interface ProgramContextValue {
  programs: Program[];
  selectedProgramId: string | null;
  setSelectedProgramId: (id: string) => void;
  loading: boolean;
  refetchPrograms: () => Promise<void>;
}

const STORAGE_KEY = 'symphonix-selected-program';

const ProgramContext = createContext<ProgramContextValue>({
  programs: [],
  selectedProgramId: null,
  setSelectedProgramId: () => {},
  loading: true,
  refetchPrograms: async () => {},
});

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/programs');
      const data = await res.json();
      const progs: Program[] = data.programs ?? [];
      setPrograms(progs);

      // Restore from localStorage or pick first
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
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
  }, [fetchPrograms]);

  const handleSetProgramId = useCallback((id: string) => {
    setSelectedProgramId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  return (
    <ProgramContext.Provider
      value={{
        programs,
        selectedProgramId,
        setSelectedProgramId: handleSetProgramId,
        loading,
        refetchPrograms: fetchPrograms,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  return useContext(ProgramContext);
}
