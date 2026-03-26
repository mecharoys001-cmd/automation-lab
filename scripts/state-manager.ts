/**
 * State Manager - Tracks bug-fixing progress
 */

import fs from 'fs/promises';

export interface WorkState {
  currentBug: string | null;
  startedAt: string | null;
  attempts: number;
  lastError: string | null;
}

const STATE_FILE = '/home/ethan/.openclaw/workspace/automation-lab/reports/bug-fixes/.state.json';

const DEFAULT_STATE: WorkState = {
  currentBug: null,
  startedAt: null,
  attempts: 0,
  lastError: null,
};

export async function loadState(): Promise<WorkState> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(state: WorkState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function startWork(bugId: string): Promise<void> {
  const state = await loadState();
  state.currentBug = bugId;
  state.startedAt = new Date().toISOString();
  state.attempts = (state.attempts || 0) + 1;
  await saveState(state);
}

export async function completeWork(): Promise<void> {
  await saveState(DEFAULT_STATE);
}

export async function recordError(error: string): Promise<void> {
  const state = await loadState();
  state.lastError = error;
  await saveState(state);
}

export async function isStuck(): Promise<boolean> {
  const state = await loadState();
  
  if (!state.currentBug || !state.startedAt) return false;
  
  // Consider stuck if working on same bug for >30 minutes
  const startTime = new Date(state.startedAt).getTime();
  const now = Date.now();
  const elapsed = now - startTime;
  
  return elapsed > 30 * 60 * 1000; // 30 minutes
}

export async function getAttemptCount(): Promise<number> {
  const state = await loadState();
  return state.attempts || 0;
}
