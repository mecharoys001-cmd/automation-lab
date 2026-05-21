import Papa from "papaparse";
import { CANONICAL_FIELDS, type EditorRow, type RawCsvEvent } from "./types";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

export function parseCsvText(text: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    headers: parsed.meta.fields ?? [],
    rows: parsed.data,
  };
}

export function toEditorRows(canonicalRows: RawCsvEvent[]): EditorRow[] {
  return canonicalRows.map((r) => ({ ...r, _id: generateId() }));
}

export function emptyEditorRow(): EditorRow {
  return {
    _id: generateId(),
    Title: "",
    Venue: "",
    Town: "",
    Website: "",
    "Start At": "",
    "End At": "",
    Times: "",
    "Run Type": "",
    "Image URL": "",
  };
}

export function duplicateRow(row: EditorRow): EditorRow {
  return { ...row, _id: generateId() };
}

// Build a CSV string from edited rows, preserving canonical column order.
export function rowsToCsv(rows: EditorRow[]): string {
  const data = rows.map((r) => {
    const obj: Record<string, string> = {};
    for (const f of CANONICAL_FIELDS) obj[f] = r[f] ?? "";
    return obj;
  });
  return Papa.unparse({ fields: CANONICAL_FIELDS as unknown as string[], data });
}

export function downloadBlob(content: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
