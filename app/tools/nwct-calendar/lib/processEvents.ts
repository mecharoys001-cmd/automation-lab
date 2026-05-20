import type {
  EditorRow,
  EventCategory,
  GroupedEvents,
  ProcessedEvent,
  RawCsvEvent,
} from "./types";
import { cleanEventTitle, extractDomain } from "./dataCleaner";
import {
  formatDateHeader,
  formatDateKeyYMD,
  formatEventTimeRange,
  formatMonthYear,
  formatShortDate,
  isValidDate,
} from "./dateFormat";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "evt-" + Math.random().toString(36).slice(2);
}

function normalizeKey(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function calculateShortRunReferences(
  shortRuns: Record<string, ProcessedEvent[]>,
  sortedKeys: string[],
): Record<string, ProcessedEvent[]> {
  const firstOccurrences = new Map<string, string>();
  const out: Record<string, ProcessedEvent[]> = {};
  for (const key of sortedKeys) {
    const events = shortRuns[key] ?? [];
    const displayDate = events.length > 0 ? formatShortDate(events[0].startAt) : "";
    out[key] = events.map((evt) => {
      const composite = `${normalizeKey(evt.title)}|${normalizeKey(evt.venue)}`;
      const first = firstOccurrences.get(composite);
      if (first) {
        if (first !== displayDate) return { ...evt, seeReference: `See ${first}` };
        return { ...evt, seeReference: undefined };
      }
      firstOccurrences.set(composite, displayDate);
      return { ...evt, seeReference: undefined };
    });
  }
  return out;
}

// Convert edited rows into a grouped, categorized calendar structure.
// Ignores rows that fail required-field/date validation so the preview
// stays usable while the editor still has unresolved issues.
export function processRows(rows: EditorRow[]): GroupedEvents {
  const raw: RawCsvEvent[] = rows.map((r) => ({
    Title: r.Title,
    Venue: r.Venue,
    Town: r.Town,
    Website: r.Website,
    "Start At": r["Start At"],
    "End At": r["End At"],
    Times: r.Times,
    "Run Type": r["Run Type"],
    "Image URL": r["Image URL"],
  }));

  // Drop duplicates and rows without title/start.
  const seen = new Set<string>();
  const cleaned = raw.filter((row) => {
    if (!row.Title || !row["Start At"]) return false;
    const sig = JSON.stringify(row);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  const processed: ProcessedEvent[] = cleaned
    .map((row): ProcessedEvent | null => {
      const start = new Date(row["Start At"]);
      if (!isValidDate(start)) return null;
      const endRaw = row["End At"] ? new Date(row["End At"]) : start;
      const end = isValidDate(endRaw) ? endRaw : start;

      const title = cleanEventTitle(row.Title, row.Venue ?? "");
      const titleLower = title.toLowerCase();
      const runTypeRaw = (row["Run Type"] ?? "").trim().toLowerCase();
      let category: EventCategory = "ShortRun";
      if (runTypeRaw === "long run") category = "LongRun";
      else if (runTypeRaw === "workshop") category = "Workshop";
      else {
        const workshopKeywords = [
          "workshop",
          "class",
          "learn",
          "studio",
          "craft",
          "camp",
          "lesson",
        ];
        if (workshopKeywords.some((k) => titleLower.includes(k))) category = "Workshop";
      }

      const formattedTime =
        row.Times && row.Times.trim() !== ""
          ? row.Times.trim()
          : formatEventTimeRange(start, end);

      return {
        id: generateId(),
        title,
        venue: row.Venue ? row.Venue.trim() : "",
        town: row.Town ?? "",
        website: extractDomain(row.Website ?? ""),
        startAt: start,
        endAt: end,
        formattedTime,
        formattedDateHeader: formatDateHeader(start),
        category,
        imageUrl: row["Image URL"] || "",
      };
    })
    .filter((e): e is ProcessedEvent => e !== null);

  // Promote multi-day repeating items into Long Runs (matches AI Studio heuristics).
  const groupedByKey = new Map<string, ProcessedEvent[]>();
  for (const p of processed) {
    const key = `${normalizeKey(p.title)}|${normalizeKey(p.venue)}`;
    if (!groupedByKey.has(key)) groupedByKey.set(key, []);
    groupedByKey.get(key)!.push(p);
  }
  for (const group of groupedByKey.values()) {
    if (group.some((e) => e.category === "LongRun")) {
      group.forEach((e) => (e.category = "LongRun"));
      continue;
    }
    if (group.some((e) => e.category === "Workshop")) continue;
    group.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const distinctDays = new Set(group.map((e) => formatDateKeyYMD(e.startAt))).size;
    if (distinctDays < 2) continue;
    const first = group[0];
    const last = group[group.length - 1];
    const daysSpan = (last.endAt.getTime() - first.startAt.getTime()) / (1000 * 60 * 60 * 24);
    const density = distinctDays / (daysSpan + 1);
    const isExhibition = /exhibition|gallery|show|on view|art|sculpture|paint/i.test(first.title);
    let promote = false;
    if (isExhibition && distinctDays >= 2) promote = true;
    else if (distinctDays >= 3 && density > 0.4) promote = true;
    if (promote) group.forEach((e) => (e.category = "LongRun"));
  }

  // Workshops — consolidate repeats keyed by title+venue.
  const workshopsRaw = processed.filter((e) => e.category === "Workshop");
  const wsMap = new Map<string, ProcessedEvent[]>();
  for (const e of workshopsRaw) {
    const key = `${normalizeKey(e.title)}|${normalizeKey(e.venue)}`;
    if (!wsMap.has(key)) wsMap.set(key, []);
    wsMap.get(key)!.push(e);
  }
  const workshops = Array.from(wsMap.values())
    .map((group) => {
      group.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const first = group[0];
      const last = group[group.length - 1];
      const distinctDays = new Set(group.map((e) => formatDateKeyYMD(e.startAt))).size;
      const dateRange =
        distinctDays > 1
          ? `${formatShortDate(first.startAt)} thru ${formatShortDate(last.startAt)}`
          : formatShortDate(first.startAt);
      if (distinctDays > 1) {
        return { ...first, startAt: first.startAt, endAt: last.startAt, dateRange };
      }
      return { ...first, dateRange };
    })
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  // Long runs — consolidate by title+venue and append the date range to the title.
  const longRunsRaw = processed.filter((e) => e.category === "LongRun");
  const lrMap = new Map<string, ProcessedEvent[]>();
  for (const e of longRunsRaw) {
    const key = `${normalizeKey(e.title)}|${normalizeKey(e.venue)}`;
    if (!lrMap.has(key)) lrMap.set(key, []);
    lrMap.get(key)!.push(e);
  }
  const longRuns = Array.from(lrMap.values())
    .map((group) => {
      group.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const minStart = group[0].startAt;
      const maxEnd = group[group.length - 1].endAt;
      const dateRange = `${formatShortDate(minStart)} thru ${formatShortDate(maxEnd)}`;
      return {
        ...group[0],
        title: `${group[0].title}; ${dateRange}`,
        startAt: minStart,
        endAt: maxEnd,
        dateRange,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  // Short runs — daily buckets, sorted, deduped within a day.
  const shortRunsRaw = processed.filter((e) => e.category === "ShortRun");
  const shortRuns: Record<string, ProcessedEvent[]> = {};
  for (const evt of shortRunsRaw) {
    (shortRuns[evt.formattedDateHeader] ??= []).push(evt);
  }
  for (const key of Object.keys(shortRuns)) {
    shortRuns[key].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const seenComposite = new Set<string>();
    shortRuns[key] = shortRuns[key].filter((e) => {
      const composite = `${normalizeKey(e.title)}|${normalizeKey(e.venue)}|${e.formattedTime}`;
      if (seenComposite.has(composite)) return false;
      seenComposite.add(composite);
      return true;
    });
  }
  const sortedDateKeys = Object.keys(shortRuns).sort((a, b) => {
    const da = shortRuns[a][0]?.startAt;
    const db = shortRuns[b][0]?.startAt;
    if (!da || !db) return 0;
    return da.getTime() - db.getTime();
  });
  const shortRunsWithRefs = calculateShortRunReferences(shortRuns, sortedDateKeys);

  let monthTitle = "EVENTS CALENDAR";
  if (processed.length > 0) {
    const earliest = processed.reduce((min, p) => (p.startAt < min.startAt ? p : min), processed[0]);
    monthTitle = formatMonthYear(earliest.startAt).toUpperCase();
  }

  return {
    shortRuns: shortRunsWithRefs,
    longRuns,
    workshops,
    sortedDateKeys,
    monthTitle,
  };
}
