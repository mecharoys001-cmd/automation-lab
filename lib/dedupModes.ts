/**
 * Deduplicator Mode Definitions
 *
 * Each mode configures how the deduplicator detects columns, normalizes data,
 * and presents itself to the user. Add new modes by appending to DEDUP_MODES.
 */

import { ColumnSets, CsvRow, detectColumnSets, cleanSpringAppealRow, springAppealNamesMatcher } from "./csvDedup";

export interface DedupMode {
  id: string;
  label: string;
  description: string;
  /** Labels for the two column selectors in the UI */
  columnLabels: { primary: string; secondary: string };
  /** How to auto-detect the right columns from headers */
  detectColumns: (headers: string[]) => ColumnSets;
  /** Extra address/group-key abbreviation substitutions (applied after base normalization) */
  extraNormSubs?: [RegExp, string][];
  /** Override Jaro-Winkler name similarity threshold (default 0.82) */
  nameThreshold?: number;
  /** Drop-zone helper text shown before file upload */
  uploadHint: string;
  /** Optional row-level cleaning applied to output rows (visible values) */
  cleanRow?: (row: CsvRow, headers: string[]) => CsvRow;
  /** Custom name comparison function (replaces namesAreLikelySame when provided) */
  namesMatcher?: (n1: string, n2: string, threshold?: number) => boolean;
}

// ── Mode Definitions ──────────────────────────────────────────────────────────

const MAILING_EXTRA_SUBS: [RegExp, string][] = [
  [/\bp\.?\s*o\.?\s*box\b/g, "pobox"],
  [/\brural\s*route\b/g, "rr"],
  [/\bhighway\b/g, "hwy"],
  [/\bparkway\b/g, "pkwy"],
  [/\bterrace\b/g, "ter"],
  [/\btrail\b/g, "trl"],
  [/\bbuilding\b/g, "bldg"],
  [/\bfloor\b/g, "fl"],
  [/\bdepartment\b/g, "dept"],
  [/\bunit\b/g, "unit"],
];

const SPRING_APPEAL_EXTRA_SUBS: [RegExp, string][] = [
  ...MAILING_EXTRA_SUBS,
  // Zip+4 → zip5 for grouping
  [/\b(\d{5})-\d{4}\b/g, "$1"],
  // More PO Box patterns
  [/\bpost\s*office\s*box\b/g, "pobox"],
  [/\bp\.?\s*o\.?\s*b\.?\b/g, "pobox"],
  // # → unit for apartment/unit normalization
  [/\b#\s*/g, "unit "],
  // Normalize "and" in address (e.g. "route 5 and main st")
  [/\band\b/g, "&"],
];

export const DEDUP_MODES: DedupMode[] = [
  {
    id: "generic",
    label: "Generic",
    description: "General-purpose duplicate detection by name and any grouping column.",
    columnLabels: { primary: "Name Column", secondary: "Grouping Column" },
    detectColumns: detectColumnSets,
    uploadHint: "CSV, TSV, TXT, XLSX, XLS \u00B7 needs a name column and a grouping column",
    nameThreshold: 0.82,
  },
  {
    id: "mailing",
    label: "Mailing Addresses",
    description: "Tuned for mailing lists \u2014 aggressive address normalization and tighter name matching.",
    columnLabels: { primary: "Name Column", secondary: "Address Column" },
    detectColumns: detectColumnSets,
    extraNormSubs: MAILING_EXTRA_SUBS,
    uploadHint: "CSV, TSV, TXT, XLSX, XLS \u00B7 needs a name column and an address column",
    nameThreshold: 0.80,
  },
  {
    id: "spring-appeal-mailing-list",
    label: "Spring Appeal Mailing List",
    description: "Built for spring appeal donor mailing exports, with address-based dedupe and mailing cleanup.",
    columnLabels: { primary: "Transaction Name Column", secondary: "Mailing Address Column" },
    detectColumns: (headers) => {
      const tx = headers.find(h => /^transaction name$/i.test(h));
      const street = headers.find(h => /^household mailing street$/i.test(h));
      const city = headers.find(h => /^household city$/i.test(h));
      const state = headers.find(h => /^household state$/i.test(h));
      const zip = headers.find(h => /^household zip code$/i.test(h));
      return {
        nameCols: tx ? [tx] : detectColumnSets(headers).nameCols,
        addrCols: [street, city, state, zip].filter(Boolean) as string[],
      };
    },
    extraNormSubs: SPRING_APPEAL_EXTRA_SUBS,
    uploadHint: "Spring appeal XLS/CSV export with Transaction Name and household mailing columns",
    nameThreshold: 0.78,
    cleanRow: cleanSpringAppealRow,
    namesMatcher: springAppealNamesMatcher,
  },
];

export const DEFAULT_MODE_ID = "generic";

export function getModeById(id: string): DedupMode {
  return DEDUP_MODES.find(m => m.id === id) ?? DEDUP_MODES[0];
}
