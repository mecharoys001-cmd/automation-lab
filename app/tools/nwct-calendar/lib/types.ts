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

export interface ProcessedEvent {
  id: string;
  title: string;
  venue: string;
  town: string;
  website: string;
  startAt: Date;
  endAt: Date;
  dateRange?: string;
  formattedTime: string;
  formattedDateHeader: string;
  category: EventCategory;
  imageUrl?: string;
  seeReference?: string;
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

export interface ProjectState {
  version: 1;
  timestamp: string;
  rows: EditorRow[];
}
