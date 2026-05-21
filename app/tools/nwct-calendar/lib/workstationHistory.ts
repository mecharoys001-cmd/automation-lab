import type {
  AdPageConfig,
  CardStyles,
  CoverConfig,
  FooterSlot,
  GroupedEvents,
  LayoutState,
  ProcessedEvent,
  Sponsor,
} from "./types";

export interface WorkstationSnapshot {
  data: GroupedEvents | null;
  layout: LayoutState;
  selectedIds: string[];
}

export const HISTORY_LIMIT = 100;

function cloneEvent(e: ProcessedEvent): ProcessedEvent {
  return {
    ...e,
    startAt: e.startAt instanceof Date ? new Date(e.startAt.getTime()) : new Date(e.startAt),
    endAt: e.endAt instanceof Date ? new Date(e.endAt.getTime()) : new Date(e.endAt),
  };
}

function cloneGrouped(data: GroupedEvents | null): GroupedEvents | null {
  if (!data) return null;
  const shortRuns: Record<string, ProcessedEvent[]> = {};
  for (const [k, list] of Object.entries(data.shortRuns)) {
    shortRuns[k] = list.map(cloneEvent);
  }
  return {
    shortRuns,
    longRuns: data.longRuns.map(cloneEvent),
    workshops: data.workshops.map(cloneEvent),
    sortedDateKeys: [...data.sortedDateKeys],
    monthTitle: data.monthTitle,
  };
}

function cloneCardStyles(s: CardStyles): CardStyles {
  return { ...s };
}

function cloneCoverConfig(c: CoverConfig): CoverConfig {
  return { ...c };
}

function cloneSponsor(s: Sponsor): Sponsor {
  return { ...s };
}

function cloneFooterSlot(f: FooterSlot): FooterSlot {
  return { ...f };
}

function cloneAdPage(p: AdPageConfig): AdPageConfig {
  return { ...p, images: [...p.images] };
}

function cloneLayout(layout: LayoutState): LayoutState {
  return {
    cardStyles: cloneCardStyles(layout.cardStyles),
    sponsors: layout.sponsors.map(cloneSponsor),
    footerSlots: layout.footerSlots.map(cloneFooterSlot),
    calendarPageCount: layout.calendarPageCount,
    coverConfig: cloneCoverConfig(layout.coverConfig),
    adPages: layout.adPages.map(cloneAdPage),
    highlightedVenues: [...layout.highlightedVenues],
  };
}

export function snapshot(
  data: GroupedEvents | null,
  layout: LayoutState,
  selectedIds: Set<string>,
): WorkstationSnapshot {
  return {
    data: cloneGrouped(data),
    layout: cloneLayout(layout),
    selectedIds: Array.from(selectedIds),
  };
}

export function restoreSnapshot(snap: WorkstationSnapshot): {
  data: GroupedEvents | null;
  layout: LayoutState;
  selectedIds: Set<string>;
} {
  return {
    data: cloneGrouped(snap.data),
    layout: cloneLayout(snap.layout),
    selectedIds: new Set(snap.selectedIds),
  };
}
