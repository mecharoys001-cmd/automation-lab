/**
 * CSV Deduplication Logic — runs entirely client-side (no data leaves the browser)
 */

export type CsvRow = Record<string, string>;

export interface DuplicateGroup {
  address: string;
  kept: CsvRow;
  dropped: CsvRow[];
}

export interface DedupResult {
  rows: CsvRow[];
  removed: number;
  groups: DuplicateGroup[];
}

// ── HTML Entity Decoding ─────────────────────────────────────────────────────

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&#39;": "'", "&#x27;": "'",
  "&nbsp;": " ", "&#160;": " ",
};
const ENTITY_RE = /&(?:#(?:x[0-9a-fA-F]+|\d+)|[a-zA-Z]+);/g;

/** Decode common HTML/XML entities so visible values stay clean. */
export function decodeEntities(s: string): string {
  return s.replace(ENTITY_RE, (m) => {
    if (ENTITY_MAP[m]) return ENTITY_MAP[m];
    if (m.startsWith("&#x")) return String.fromCharCode(parseInt(m.slice(3, -1), 16));
    if (m.startsWith("&#"))  return String.fromCharCode(parseInt(m.slice(2, -1), 10));
    return m; // unknown named entity — leave as-is
  });
}

// ── Delimited Text Parsing ───────────────────────────────────────────────────

function parseLine(line: string, delim: string = ","): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (line[i] === delim && !inQ) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += line[i];
    }
  }
  fields.push(cur.trim());
  return fields;
}

/** Detect delimiter from the first line of a text file (supports comma, tab). */
export function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

export function parseCSV(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines[0]?.charCodeAt(0) === 0xfeff) lines[0] = lines[0].slice(1);
  const delim = detectDelimiter(lines[0] ?? "");
  const headers = parseLine(lines[0] ?? "", delim).map(decodeEntities);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]?.trim()) continue;
    const vals = parseLine(lines[i], delim);
    const row: CsvRow = {};
    headers.forEach((h, j) => { row[h] = decodeEntities(vals[j] ?? ""); });
    rows.push(row);
  }
  return { headers, rows };
}

export function toCSV(headers: string[], rows: CsvRow[]): string {
  const esc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"` : v;
  return [
    headers.map(esc).join(","),
    ...rows.map(r => headers.map(h => esc(r[h] ?? "")).join(",")),
  ].join("\n");
}

export function toTSV(headers: string[], rows: CsvRow[]): string {
  const esc = (v: string) =>
    v.includes("\t") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"` : v;
  return [
    headers.map(esc).join("\t"),
    ...rows.map(r => headers.map(h => esc(r[h] ?? "")).join("\t")),
  ].join("\n");
}

// ── Column Detection ─────────────────────────────────────────────────────────

const ADDR_EXCLUDE = /\b(email|ip|web|url|mac)\b/i;
const STATE_EXCLUDE = /\b(estate|statement|status)\b/i;

const COL_PATTERNS: Record<string, { hints: string[]; exclude?: RegExp }> = {
  firstName: { hints: ["first name", "firstname", "fname", "given name"] },
  lastName:  { hints: ["last name", "lastname", "lname", "surname", "family name"] },
  fullName:  { hints: ["name", "fullname", "full name", "customer", "contact", "recipient", "person", "donor", "member", "company", "organization"] },
  street:    { hints: ["address", "addr", "street", "mailing", "location", "shipping"], exclude: ADDR_EXCLUDE },
  city:      { hints: ["city", "town", "municipality"] },
  state:     { hints: ["state", "province", "region"], exclude: STATE_EXCLUDE },
  zip:       { hints: ["zip", "zipcode", "zip code", "postal", "postal code", "postcode"] },
};

function matchesHints(header: string, hints: string[], exclude?: RegExp): boolean {
  const hl = header.toLowerCase().trim();
  if (exclude && exclude.test(hl)) return false;
  return hints.some(hint => {
    if (hl === hint) return true;
    const re = new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return re.test(hl);
  });
}

function findCol(headers: string[], key: string, skip: Set<string>): string | null {
  const { hints, exclude } = COL_PATTERNS[key];
  for (const h of headers) {
    if (skip.has(h)) continue;
    if (matchesHints(h, hints, exclude)) return h;
  }
  return null;
}

export interface ColumnSets { nameCols: string[]; addrCols: string[] }

/** Detect name and address column sets, supporting split columns (First/Last, Street/City/State/Zip). */
export function detectColumnSets(headers: string[]): ColumnSets {
  const used = new Set<string>();

  // Name: prefer first+last, fall back to full name
  let nameCols: string[] = [];
  const first = findCol(headers, "firstName", used);
  const last = findCol(headers, "lastName", used);
  if (first && last) {
    nameCols = [first, last];
    used.add(first); used.add(last);
  } else {
    const full = findCol(headers, "fullName", used);
    if (full) { nameCols = [full]; used.add(full); }
  }

  // Address: street + optional city/state/zip for composite key
  const addrCols: string[] = [];
  const street = findCol(headers, "street", used);
  if (street) { addrCols.push(street); used.add(street); }
  const city = findCol(headers, "city", used);
  if (city) { addrCols.push(city); used.add(city); }
  const state = findCol(headers, "state", used);
  if (state) { addrCols.push(state); used.add(state); }
  const zip = findCol(headers, "zip", used);
  if (zip) { addrCols.push(zip); used.add(zip); }

  return { nameCols, addrCols };
}

/** Legacy single-column detection — delegates to detectColumnSets. */
export function detectColumns(headers: string[]): { nameCol: string | null; addrCol: string | null } {
  const { nameCols, addrCols } = detectColumnSets(headers);
  return { nameCol: nameCols[0] ?? null, addrCol: addrCols[0] ?? null };
}

// ── Normalization ────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

const ADDR_SUBS: [RegExp, string][] = [
  [/\bstreet\b/g, "st"], [/\bavenue\b/g, "ave"], [/\bboulevard\b/g, "blvd"],
  [/\bdrive\b/g, "dr"], [/\broad\b/g, "rd"], [/\bcourt\b/g, "ct"],
  [/\bplace\b/g, "pl"], [/\blane\b/g, "ln"], [/\bcircle\b/g, "cir"],
  [/\bnorth\b/g, "n"], [/\bsouth\b/g, "s"], [/\beast\b/g, "e"], [/\bwest\b/g, "w"],
  [/\bapartment\b/g, "apt"], [/\bsuite\b/g, "ste"],
  [/[.,#\-]/g, " "],
];

function normalizeAddress(s: string): string {
  let a = norm(s);
  for (const [re, rep] of ADDR_SUBS) a = a.replace(re, rep);
  return a.replace(/\s+/g, " ").trim();
}

function parseNameParts(name: string): [string, string] {
  const parts = norm(name).split(" ");
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return ["", parts[0]];
  return [parts[0], parts.slice(1).join(" ")];
}

// ── Jaro-Winkler ─────────────────────────────────────────────────────────────

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  const dist = Math.max(Math.floor(Math.max(la, lb) / 2) - 1, 0);
  const ma = new Array(la).fill(false);
  const mb = new Array(lb).fill(false);
  let matches = 0, trans = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - dist); j < Math.min(i + dist + 1, lb); j++) {
      if (mb[j] || a[i] !== b[j]) continue;
      ma[i] = mb[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }
  return (matches / la + matches / lb + (matches - trans / 2) / matches) / 3;
}

function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let p = 0;
  for (let i = 0; i < Math.min(4, Math.min(a.length, b.length)); i++) {
    if (a[i] === b[i]) p++; else break;
  }
  return j + p * 0.1 * (1 - j);
}

// ── Name Similarity ───────────────────────────────────────────────────────────

function namesAreLikelySame(n1: string, n2: string): boolean {
  const a = norm(n1), b = norm(n2);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.replace(/ /g, "") === b.replace(/ /g, "")) return true;

  const [f1, l1] = parseNameParts(n1);
  const [f2, l2] = parseNameParts(n2);

  if (l1 && l2) {
    const lastSim = jaroWinkler(l1, l2);
    // Concatenated first+last as single token: "ebrewerton" vs "e brewerton"
    if (lastSim < 0.75) {
      if (f2 && l1 === (f2[0] + l2).replace(/ /g, "")) return true;
      if (f1 && l2 === (f1[0] + l1).replace(/ /g, "")) return true;
      return false;
    }
    if (f1 && f2) {
      if (f1.length === 1 && f2.startsWith(f1)) return true;
      if (f2.length === 1 && f1.startsWith(f2)) return true;
      return jaroWinkler(f1, f2) >= 0.78;
    }
    if (!f1 || !f2) return lastSim >= 0.88;
  }
  return jaroWinkler(a, b) >= 0.82;
}

// ── Union-Find ────────────────────────────────────────────────────────────────

class UnionFind {
  private p: number[];
  constructor(n: number) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(x: number): number {
    if (this.p[x] !== x) this.p[x] = this.find(this.p[x]);
    return this.p[x];
  }
  union(x: number, y: number) { this.p[this.find(x)] = this.find(y); }
  groups(): Map<number, number[]> {
    const g = new Map<number, number[]>();
    for (let i = 0; i < this.p.length; i++) {
      const r = this.find(i);
      g.set(r, [...(g.get(r) ?? []), i]);
    }
    return g;
  }
}

// ── Main Dedup ────────────────────────────────────────────────────────────────

function bestRecord(records: CsvRow[], nameCols: string[]): CsvRow {
  return records.reduce((best, r) => {
    const rLen = nameCols.reduce((sum, c) => sum + (r[c]?.length ?? 0), 0);
    const bLen = nameCols.reduce((sum, c) => sum + (best[c]?.length ?? 0), 0);
    return rLen > bLen ? r : best;
  });
}

export function deduplicate(rows: CsvRow[], nameCols: string[], addrCols: string[]): DedupResult {
  const addrGroups = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = normalizeAddress(addrCols.map(c => row[c] ?? "").join(" "));
    addrGroups.set(key, [...(addrGroups.get(key) ?? []), i]);
  });

  const uf = new UnionFind(rows.length);
  for (const indices of addrGroups.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const nameA = nameCols.map(c => rows[indices[a]][c] ?? "").join(" ");
        const nameB = nameCols.map(c => rows[indices[b]][c] ?? "").join(" ");
        if (namesAreLikelySame(nameA, nameB))
          uf.union(indices[a], indices[b]);
      }
    }
  }

  const result: CsvRow[] = [];
  const groups: DuplicateGroup[] = [];
  let removed = 0;

  for (const indices of uf.groups().values()) {
    const cluster = indices.map(i => rows[i]);
    const kept = bestRecord(cluster, nameCols);
    if (cluster.length > 1) {
      groups.push({
        address: addrCols.map(c => cluster[0][c] ?? "").filter(Boolean).join(", "),
        kept,
        dropped: cluster.filter(r => r !== kept),
      });
    }
    result.push(kept);
    removed += cluster.length - 1;
  }

  return { rows: result, removed, groups };
}
