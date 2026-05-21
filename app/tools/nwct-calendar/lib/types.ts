// Canonical CSV column names produced by the Airtable export script.
// The tool accepts these headers verbatim and maps any near-variants
// during the column mapping step.

export const CANONICAL_FIELDS = [
  "Title",
  "Venue",
  "Town",
  "Website",
  "Start At",
  "End At",
  "Times",
  "Run Type",
  "Image URL",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_FIELDS: CanonicalField[] = [
  "Title",
  "Venue",
  "Start At",
];

export type ColumnMapping = Partial<Record<CanonicalField, string>>;

// Raw row keyed by canonical field after mapping has been applied.
export interface RawCsvEvent {
  Title: string;
  Venue: string;
  Town: string;
  Website: string;
  "Start At": string;
  "End At": string;
  Times?: string;
  "Run Type"?: string;
  "Image URL"?: string;
}

// Editor row — what the AG Grid sees. Identical to RawCsvEvent but with
// a stable client-side id for tracking edits.
export interface EditorRow extends RawCsvEvent {
  _id: string;
}

export type EventCategory = "ShortRun" | "LongRun" | "Workshop";
export type EventSection = "shortRuns" | "longRuns" | "workshops";

export interface ProcessedEvent {
  id: string;
  title: string;
  venue: string;
  town: string;
  website: string;
  // startAt / endAt serialize to ISO strings in saved project state — the
  // print layout converts them back to Date when reading event.startAt.
  startAt: Date;
  endAt: Date;
  dateRange?: string;
  formattedTime: string;
  formattedDateHeader: string;
  category: EventCategory;
  imageUrl?: string;
  imageHeight?: number;
  imagePosition?: number;
  seeReference?: string;
  isSpacer?: boolean;
  spacerHeight?: number;
}

export interface GroupedEvents {
  shortRuns: Record<string, ProcessedEvent[]>;
  longRuns: ProcessedEvent[];
  workshops: ProcessedEvent[];
  sortedDateKeys: string[];
  monthTitle: string;
}

export interface RowValidationIssue {
  rowId: string;
  field: CanonicalField | "_row";
  severity: "error" | "warning";
  message: string;
}

// ---------------------------------------------------------------------------
// Post-build layout state
// ---------------------------------------------------------------------------

export interface CardStyles {
  borderWidth: number;
  borderStyle: "solid" | "dashed" | "dotted";
  borderColor: string;
  borderRadius: number;
  padding: number;
  dateHeaderPadding: number;
  headerWidth?: "full" | "fit";
  showBottomBorder: boolean;
  columnGap: number;

  dateHeaderBgColor: string;
  monthTitleColor: string;
  websiteLinkColor: string;
  workshopHeaderBgColor: string;
  workshopBgColor: string;

  lineHeight: number;
  letterSpacing: number;

  sponsorPaddingTop?: number;
  sponsorPaddingBottom?: number;
}

export interface Sponsor {
  id: string;
  imageUrl: string;
  name?: string;
  afterId?: string;
}

export interface CoverConfig {
  title: string;
  month: string;
  heroImageUrl: string | null;
  credit: string;
  subtitle1: string;
  subtitle2: string;
}

export type AdLayoutType =
  | "full"
  | "half-horizontal"
  | "half-vertical"
  | "grid-4"
  | "collage";

export interface AdPageConfig {
  id: string;
  layout: AdLayoutType;
  images: (string | null)[];
}

export type FooterSlotType = "info" | "donate" | "image" | "empty" | "removed";

export interface FooterSlot {
  type: FooterSlotType;
  content?: string;
}

export interface LayoutState {
  cardStyles: CardStyles;
  sponsors: Sponsor[];
  footerSlots: FooterSlot[];
  calendarPageCount: number;
  coverConfig: CoverConfig;
  adPages: AdPageConfig[];
  highlightedVenues: string[];
}

export const DEFAULT_CARD_STYLES: CardStyles = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e5e7eb",
  borderRadius: 2,
  padding: 4,
  dateHeaderPadding: 8,
  headerWidth: "full",
  showBottomBorder: true,
  columnGap: 32,
  dateHeaderBgColor: "#7FA5BC",
  monthTitleColor: "#7FA5BC",
  websiteLinkColor: "#7FA5BC",
  workshopHeaderBgColor: "#C7D4DF",
  workshopBgColor: "#E5EDF1",
  lineHeight: 1.2,
  letterSpacing: -0.01,
  sponsorPaddingTop: 0,
  sponsorPaddingBottom: 16,
};

export const DEFAULT_COVER_CONFIG: CoverConfig = {
  title: "NWCT ARTS COUNCIL",
  month: "",
  heroImageUrl: null,
  credit: "",
  subtitle1: "Discover",
  subtitle2: "Litchfield Hills",
};

export function defaultFooterSlotsForPages(pageCount: number): FooterSlot[] {
  // 3 slots per calendar page (one per column). The first page defaults
  // to info / sponsor / donate; subsequent pages default to all sponsor.
  const slots: FooterSlot[] = [];
  for (let p = 0; p < pageCount; p += 1) {
    if (p === 0) {
      slots.push({ type: "info" }, { type: "image" }, { type: "donate" });
    } else {
      slots.push({ type: "image" }, { type: "image" }, { type: "image" });
    }
  }
  return slots;
}

export function defaultLayoutState(): LayoutState {
  return {
    cardStyles: { ...DEFAULT_CARD_STYLES },
    sponsors: [],
    footerSlots: defaultFooterSlotsForPages(1),
    calendarPageCount: 1,
    coverConfig: { ...DEFAULT_COVER_CONFIG },
    adPages: [],
    highlightedVenues: [],
  };
}

// ---------------------------------------------------------------------------
// Persisted project state
// ---------------------------------------------------------------------------

export interface ProjectState {
  version: 2;
  timestamp: string;
  rows: EditorRow[];
  // Optional layout payload — older v1 saves only carry rows.
  data?: SerializableGroupedEvents | null;
  layout?: LayoutState | null;
}

// JSON-safe variant where Date fields become ISO strings.
export interface SerializableProcessedEvent
  extends Omit<ProcessedEvent, "startAt" | "endAt"> {
  startAt: string;
  endAt: string;
}

export interface SerializableGroupedEvents {
  shortRuns: Record<string, SerializableProcessedEvent[]>;
  longRuns: SerializableProcessedEvent[];
  workshops: SerializableProcessedEvent[];
  sortedDateKeys: string[];
  monthTitle: string;
}
