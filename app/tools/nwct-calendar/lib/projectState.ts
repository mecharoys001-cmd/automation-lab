import type { EditorRow, ProjectState } from "./types";

const LOCAL_KEY = "nwct-calendar:autosave";
export const PROJECT_VERSION = 1 as const;

export function toProjectJson(rows: EditorRow[]): string {
  const project: ProjectState = {
    version: PROJECT_VERSION,
    timestamp: new Date().toISOString(),
    rows,
  };
  return JSON.stringify(project, null, 2);
}

export function fromProjectJson(text: string): EditorRow[] | null {
  try {
    const parsed = JSON.parse(text) as ProjectState;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.rows)) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

export function loadAutosave(): EditorRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return fromProjectJson(raw);
  } catch {
    return null;
  }
}

export function saveAutosave(rows: EditorRow[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, toProjectJson(rows));
  } catch {
    // Quota errors or disabled storage — ignore silently.
  }
}

export function clearAutosave(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
