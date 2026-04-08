"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { parseCSV, toCSV, detectColumns, deduplicate, DedupResult, CsvRow } from "@/lib/csvDedup";
import * as XLSX from "xlsx";
import { trackToolUsage, hashCSVContent, startToolSession } from "@/lib/usage-tracking";

const ACCENT = "#6366f1";

interface State {
  headers: string[];
  rows: CsvRow[];
  nameCol: string;
  addrCol: string;
  result: DedupResult | null;
  /** Per-group approval: true = approved (drop duplicates), false = rejected (keep all) */
  approvals: Record<number, boolean>;
  error: string | null;
  fileName: string;
  dragging: boolean;
  rawCsv: string;
}

export default function CsvDedupTool() {
  const [s, setS] = useState<State>({
    headers: [], rows: [], nameCol: "", addrCol: "",
    result: null, approvals: {}, error: null, fileName: "", dragging: false, rawCsv: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const toolSession = useRef<ReturnType<typeof startToolSession> | null>(null);

  const ACCEPTED_EXTS = [".csv", ".tsv", ".txt", ".xlsx", ".xls"];
  const isExcel = (name: string) => name.endsWith(".xlsx") || name.endsWith(".xls");

  const handleParsed = useCallback((headers: string[], rows: CsvRow[], fileName: string, rawCsv: string) => {
    const { nameCol: detectedName, addrCol: detectedAddr } = detectColumns(headers);
    const nameCol = detectedName ?? headers[0] ?? "";
    const addrCol = detectedAddr ?? headers[1] ?? "";
    // Auto-run dedup on load
    const result = deduplicate(rows, nameCol, addrCol);
    const approvals: Record<number, boolean> = {};
    result.groups.forEach((_, i) => { approvals[i] = true; });
    setS(p => ({
      ...p, headers, rows, fileName, rawCsv,
      nameCol, addrCol,
      result, approvals, error: null, dragging: false,
    }));
  }, []);

  const loadFile = useCallback((file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      setS(p => ({ ...p, error: "Unsupported file type. Upload a .csv, .tsv, .txt, .xlsx, or .xls file." }));
      return;
    }
    // Start a new usage tracking session on file upload
    toolSession.current = startToolSession('csv-dedup');

    if (isExcel(file.name)) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonRows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          if (!jsonRows.length) throw new Error("Empty spreadsheet");
          const headers = jsonRows[0].map(String);
          const rows: CsvRow[] = [];
          for (let i = 1; i < jsonRows.length; i++) {
            if (!jsonRows[i].some(c => String(c).trim())) continue;
            const row: CsvRow = {};
            headers.forEach((h, j) => { row[h] = String(jsonRows[i][j] ?? ""); });
            rows.push(row);
          }
          const rawCsv = toCSV(headers, rows);
          handleParsed(headers, rows, file.name, rawCsv);
        } catch {
          toolSession.current?.error("Failed to parse Excel file");
          toolSession.current = null;
          setS(p => ({ ...p, error: "Failed to parse Excel file. Check the file format.", dragging: false }));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text = e.target?.result as string;
          const { headers, rows } = parseCSV(text);
          handleParsed(headers, rows, file.name, text);
        } catch {
          toolSession.current?.error("Failed to parse file");
          toolSession.current = null;
          setS(p => ({ ...p, error: "Failed to parse file. Check the file format.", dragging: false }));
        }
      };
      reader.readAsText(file);
    }
  }, [handleParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const runDedup = () => {
    if (!s.nameCol || !s.addrCol) { setS(p => ({ ...p, error: "Select both columns." })); return; }
    const result = deduplicate(s.rows, s.nameCol, s.addrCol);
    const approvals: Record<number, boolean> = {};
    result.groups.forEach((_, i) => { approvals[i] = true; });
    setS(p => ({ ...p, result, approvals, error: null }));

    // Complete the session with hash for dedup tracking
    hashCSVContent(s.rawCsv).then((hash) => {
      if (toolSession.current) {
        toolSession.current.complete({
          contentHash: hash,
          metadata: {
            total_rows: s.rows.length,
            duplicates_found: result.removed,
          },
        });
        toolSession.current = null;
      } else {
        // Fallback for backward compat
        trackToolUsage('csv-dedup', {
          contentHash: hash,
          metadata: {
            total_rows: s.rows.length,
            duplicates_found: result.removed,
          },
        });
      }
    });
  };

  // Compute output rows: start with all rows, then for each approved group remove the dropped records
  const outputRows = useMemo(() => {
    if (!s.result) return [];
    const droppedSet = new Set<CsvRow>();
    s.result.groups.forEach((g, i) => {
      if (s.approvals[i]) g.dropped.forEach(r => droppedSet.add(r));
    });
    return s.rows.filter(r => !droppedSet.has(r));
  }, [s.result, s.approvals, s.rows]);

  const approvedCount = useMemo(() =>
    s.result ? s.result.groups.filter((_, i) => s.approvals[i]).length : 0,
  [s.result, s.approvals]);

  const totalRemoved = useMemo(() => {
    if (!s.result) return 0;
    return s.result.groups.reduce((sum, g, i) => sum + (s.approvals[i] ? g.dropped.length : 0), 0);
  }, [s.result, s.approvals]);

  const toggleApproval = (idx: number) =>
    setS(p => ({ ...p, approvals: { ...p.approvals, [idx]: !p.approvals[idx] } }));

  const bulkSetApprovals = (value: boolean) =>
    setS(p => {
      const approvals: Record<number, boolean> = {};
      p.result?.groups.forEach((_, i) => { approvals[i] = value; });
      return { ...p, approvals };
    });

  const download = () => {
    if (!s.result) return;
    const csv = toCSV(s.headers, outputRows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url;
    const baseName = s.fileName.replace(/\.[^.]+$/, "");
    a.download = `${baseName}-cleaned.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const reset = () => setS({ headers: [], rows: [], nameCol: "", addrCol: "", result: null, approvals: {}, error: null, fileName: "", dragging: false, rawCsv: "" });

  const sel = (field: "nameCol" | "addrCol") => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setS(p => ({ ...p, [field]: e.target.value, result: null, approvals: {} }));

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${s.dragging ? ACCENT : "#334155"}`,
    borderRadius: "16px", padding: "3rem 2rem", textAlign: "center",
    cursor: "pointer", transition: "all 0.2s",
    backgroundColor: s.dragging ? `${ACCENT}10` : "#0f172a",
  };

  const selectStyle: React.CSSProperties = {
    backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px",
    color: "#e2e8f0", padding: "8px 12px", fontSize: "14px", width: "100%",
  };

  if (!s.rows.length) return (
    <div>
      <div style={dropZoneStyle}
        onDragOver={e => { e.preventDefault(); setS(p => ({ ...p, dragging: true })); }}
        onDragLeave={() => setS(p => ({ ...p, dragging: false }))}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📂</div>
        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>Drop your file here</div>
        <div style={{ color: "#64748b", fontSize: "14px" }}>or click to browse · CSV, TSV, TXT, XLSX, XLS · must have a name column and an address column</div>
      </div>
      {s.error && <div style={{ color: "#f87171", marginTop: "1rem", fontSize: "14px" }}>⚠️ {s.error}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* File info + column picker */}
      <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>📄 {s.fileName}</div>
            <div style={{ color: "#64748b", fontSize: "13px", marginTop: "2px" }}>{s.rows.length.toLocaleString()} rows loaded</div>
          </div>
          <button onClick={reset} style={{ background: "none", border: "1px solid #334155", borderRadius: "8px", color: "#64748b", padding: "6px 14px", cursor: "pointer", fontSize: "13px" }}>
            ✕ Load different file
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Name Column</label>
            <select style={selectStyle} value={s.nameCol} onChange={sel("nameCol")}>
              {s.headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Address Column</label>
            <select style={selectStyle} value={s.addrCol} onChange={sel("addrCol")}>
              {s.headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <button onClick={runDedup} style={{
          backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: "10px",
          padding: "12px 28px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
          boxShadow: `0 0 20px ${ACCENT}40`, width: "100%",
        }}>
          🔍 Rerun Duplicate Analysis
        </button>
        <div style={{ color: "#64748b", fontSize: "12px", marginTop: "8px", textAlign: "center" }}>
          Duplicates are detected automatically on upload. Change columns above and rerun if needed. Review each proposed change below before downloading.
        </div>
        {s.error && <div style={{ color: "#f87171", marginTop: "1rem", fontSize: "14px" }}>⚠️ {s.error}</div>}
      </div>

      {/* Results */}
      {s.result && (
        <>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {[
              { label: "Rows In", value: s.rows.length.toLocaleString(), color: "#94a3b8" },
              { label: "Removing", value: totalRemoved.toLocaleString(), color: "#f87171" },
              { label: "Rows Out", value: outputRows.length.toLocaleString(), color: "#4ade80" },
            ].map(item => (
              <div key={item.label} style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Duplicate groups with review */}
          {s.result.groups.length > 0 ? (
            <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>
                  🔁 {s.result.groups.length} Duplicate Group{s.result.groups.length !== 1 ? "s" : ""} Found
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => bulkSetApprovals(true)} style={{
                    background: "none", border: "1px solid #16a34a60", borderRadius: "6px",
                    color: "#4ade80", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                  }}>
                    Approve All
                  </button>
                  <button onClick={() => bulkSetApprovals(false)} style={{
                    background: "none", border: "1px solid #dc262660", borderRadius: "6px",
                    color: "#f87171", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                  }}>
                    Reject All
                  </button>
                </div>
              </div>
              <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "1rem" }}>
                Review each group below. Approved groups will have duplicates removed; rejected groups keep all records. ({approvedCount} of {s.result.groups.length} approved)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {s.result.groups.map((g, i) => {
                  const approved = !!s.approvals[i];
                  return (
                    <div key={i} style={{
                      backgroundColor: "#0f172a", borderRadius: "10px", padding: "1rem",
                      border: `1px solid ${approved ? "#16a34a40" : "#334155"}`,
                      opacity: approved ? 1 : 0.65,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>📍 {g.address}</div>
                        <button onClick={() => toggleApproval(i)} style={{
                          background: approved ? "#16a34a25" : "#dc262625",
                          border: `1px solid ${approved ? "#16a34a60" : "#dc262660"}`,
                          borderRadius: "6px", color: approved ? "#4ade80" : "#f87171",
                          padding: "3px 10px", cursor: "pointer", fontSize: "11px", fontWeight: 700,
                        }}>
                          {approved ? "✓ Approved" : "✗ Rejected"}
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", backgroundColor: "#16a34a20", color: "#4ade80", border: "1px solid #16a34a40", borderRadius: "6px", padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>✓ KEPT</span>
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>{g.kept[s.nameCol]}</span>
                        </div>
                        {g.dropped.map((r, j) => (
                          <div key={j} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", backgroundColor: approved ? "#dc262620" : "#33415540", color: approved ? "#f87171" : "#64748b", border: `1px solid ${approved ? "#dc262640" : "#33415560"}`, borderRadius: "6px", padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>{approved ? "✗ DROP" : "— KEEP"}</span>
                            <span style={{ fontSize: "14px", color: "#64748b" }}>{r[s.nameCol]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "2rem", textAlign: "center", color: "#64748b" }}>
              ✅ No duplicates found. Your list is clean!
            </div>
          )}

          {/* Download */}
          <button onClick={download} style={{
            backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "10px",
            padding: "14px 28px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 0 20px rgba(22,163,74,0.3)",
          }}>
            ⬇️ Download Cleaned CSV ({outputRows.length.toLocaleString()} rows)
          </button>
        </>
      )}
    </div>
  );
}
