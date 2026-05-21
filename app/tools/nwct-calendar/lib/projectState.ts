import type {
  EditorRow,
  GroupedEvents,
  LayoutState,
  ProcessedEvent,
  ProjectState,
  SerializableGroupedEvents,
  SerializableProcessedEvent,
} from "./types";
import { defaultLayoutState } from "./types";

const LOCAL_KEY = "nwct-calendar:autosave";
export const PROJECT_VERSION = 2 as const;

function serializeEvent(e: ProcessedEvent): SerializableProcessedEvent {
  return {
    ...e,
    startAt: e.startAt instanceof Date ? e.startAt.toISOString() : String(e.startAt),
    endAt: e.endAt instanceof Date ? e.endAt.toISOString() : String(e.endAt),
  };
}

function deserializeEvent(e: SerializableProcessedEvent): ProcessedEvent {
  return {
    ...e,
    startAt: new Date(e.startAt),
    endAt: new Date(e.endAt),
  };
}

function serializeGrouped(g: GroupedEvents): SerializableGroupedEvents {
  const shortRuns: Record<string, SerializableProcessedEvent[]> = {};
  for (const [k, list] of Object.entries(g.shortRuns)) {
    shortRuns[k] = list.map(serializeEvent);
  }
  return {
    shortRuns,
    longRuns: g.longRuns.map(serializeEvent),
    workshops: g.workshops.map(serializeEvent),
    sortedDateKeys: g.sortedDateKeys,
    monthTitle: g.monthTitle,
  };
}

function deserializeGrouped(g: SerializableGroupedEvents): GroupedEvents {
  const shortRuns: Record<string, ProcessedEvent[]> = {};
  for (const [k, list] of Object.entries(g.shortRuns)) {
    shortRuns[k] = list.map(deserializeEvent);
  }
  return {
    shortRuns,
    longRuns: g.longRuns.map(deserializeEvent),
    workshops: g.workshops.map(deserializeEvent),
    sortedDateKeys: g.sortedDateKeys,
    monthTitle: g.monthTitle,
  };
}

export interface ProjectPayload {
  rows: EditorRow[];
  data?: GroupedEvents | null;
  layout?: LayoutState | null;
}

export function toProjectJson(payload: ProjectPayload): string {
  const project: ProjectState = {
    version: PROJECT_VERSION,
    timestamp: new Date().toISOString(),
    rows: payload.rows,
    data: payload.data ? serializeGrouped(payload.data) : null,
    layout: payload.layout ?? null,
  };
  return JSON.stringify(project, null, 2);
}

export interface RestoredProject {
  rows: EditorRow[];
  data: GroupedEvents | null;
  layout: LayoutState | null;
}

export function fromProjectJson(text: string): RestoredProject | null {
  try {
    const parsed = JSON.parse(text) as Partial<ProjectState>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.rows)) return null;
    const data = parsed.data ? deserializeGrouped(parsed.data) : null;
    const layout = parsed.layout
      ? { ...defaultLayoutState(), ...parsed.layout }
      : null;
    return { rows: parsed.rows, data, layout };
  } catch {
    return null;
  }
}

export function loadAutosave(): RestoredProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return fromProjectJson(raw);
  } catch {
    return null;
  }
}

export function saveAutosave(payload: ProjectPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, toProjectJson(payload));
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
