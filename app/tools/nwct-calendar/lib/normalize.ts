import {
  CANONICAL_FIELDS,
  type CanonicalField,
  type ColumnMapping,
} from "./types";

// Lowercased, non-alphanumeric-stripped key. "Start At" → "startat".
function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Header aliases — match common Airtable / spreadsheet variants to the
// canonical fields the tool expects. Used both for auto-mapping after
// CSV upload and as the seed for the manual mapper UI.
const ALIASES: Record<CanonicalField, string[]> = {
  Title: ["title", "name", "eventname", "eventtitle"],
  Venue: ["venue", "location", "venuename", "host"],
  Town: ["town", "city", "municipality"],
  Website: ["website", "url", "link", "site"],
  "Start At": ["startat", "start", "startdate", "startdatetime", "begin", "begins"],
  "End At": ["endat", "end", "enddate", "enddatetime", "finish"],
  Times: ["times", "time", "timestring", "timesoverride"],
  "Run Type": ["runtype", "type", "category", "eventtype"],
  "Image URL": ["imageurl", "image", "imagelink", "photo", "photourl"],
};

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, key: normKey(h) }));

  for (const canonical of CANONICAL_FIELDS) {
    const candidates = ALIASES[canonical];
    // Prefer exact normalized canonical match first.
    const canonicalKey = normKey(canonical);
    const exact = normalizedHeaders.find((h) => h.key === canonicalKey);
    if (exact) {
      mapping[canonical] = exact.raw;
      continue;
    }
    // Otherwise try aliases in priority order.
    for (const alias of candidates) {
      const match = normalizedHeaders.find((h) => h.key === alias);
      if (match) {
        mapping[canonical] = match.raw;
        break;
      }
    }
  }

  return mapping;
}

// Apply mapping to raw parsed rows, producing rows keyed by canonical fields.
export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): Record<CanonicalField, string>[] {
  return rows.map((row) => {
    const out = {} as Record<CanonicalField, string>;
    for (const canonical of CANONICAL_FIELDS) {
      const source = mapping[canonical];
      out[canonical] = source ? (row[source] ?? "").toString().trim() : "";
    }
    return out;
  });
}
