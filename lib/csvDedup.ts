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

// ── CSV Parsing ──────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (line[i] === "," && !inQ) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += line[i];
    }
  }
  fields.push(cur.trim());
  return fields;
}

export function parseCSV(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines[0]?.charCodeAt(0) === 0xfeff) lines[0] = lines[0].slice(1);
  const headers = parseLine(lines[0] ?? "");
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]?.trim()) continue;
    const vals = parseLine(lines[i]);
    const row: CsvRow = {};
    headers.forEach((h, j) => { row[h] = vals[j] ?? ""; });
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

// ── Column Detection ─────────────────────────────────────────────────────────

const NAME_HINTS = ["name", "fullname", "full name", "customer", "contact", "recipient", "person"];
const ADDR_HINTS = ["address", "addr", "street", "mailing", "location", "shipping"];

export function detectColumns(headers: string[]): { nameCol: string | null; addrCol: string | null } {
  let nameCol: string | null = null;
  let addrCol: string | null = null;
  for (const h of headers) {
    const hl = h.toLowerCase().trim();
    if (!nameCol && NAME_HINTS.some(x => hl.includes(x))) nameCol = h;
    if (!addrCol && ADDR_HINTS.some(x => hl.includes(x))) addrCol = h;
  }
  return { nameCol, addrCol };
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

function bestRecord(records: CsvRow[], nameCol: string): CsvRow {
  return records.reduce((best, r) =>
    (r[nameCol]?.length ?? 0) > (best[nameCol]?.length ?? 0) ? r : best
  );
}

export function deduplicate(rows: CsvRow[], nameCol: string, addrCol: string): DedupResult {
  const addrGroups = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = normalizeAddress(row[addrCol] ?? "");
    addrGroups.set(key, [...(addrGroups.get(key) ?? []), i]);
  });

  const uf = new UnionFind(rows.length);
  for (const indices of addrGroups.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        if (namesAreLikelySame(rows[indices[a]][nameCol] ?? "", rows[indices[b]][nameCol] ?? ""))
          uf.union(indices[a], indices[b]);
      }
    }
  }

  const result: CsvRow[] = [];
  const groups: DuplicateGroup[] = [];
  let removed = 0;

  for (const indices of uf.groups().values()) {
    const cluster = indices.map(i => rows[i]);
    const kept = bestRecord(cluster, nameCol);
    if (cluster.length > 1) {
      groups.push({ address: cluster[0][addrCol] ?? "", kept, dropped: cluster.filter(r => r !== kept) });
    }
    result.push(kept);
    removed += cluster.length - 1;
  }

  return { rows: result, removed, groups };
}
