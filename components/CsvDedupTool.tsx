"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { parseCSV, toCSV, toTSV, deduplicate, decodeEntities, DedupResult, CsvRow } from "@/lib/csvDedup";
import { DEDUP_MODES, DEFAULT_MODE_ID, getModeById, DedupMode } from "@/lib/dedupModes";
import * as XLSX from "xlsx";
import { trackToolUsage, hashCSVContent, startToolSession } from "@/lib/usage-tracking";

const ACCENT = "#6366f1";
type ExportFormat = ".csv" | ".tsv" | ".txt" | ".xlsx" | ".xls";
const EXPORT_FORMATS: ExportFormat[] = [".csv", ".tsv", ".txt", ".xlsx", ".xls"];

interface State {
  modeId: string;
  headers: string[];
  rows: CsvRow[];
  nameCols: string[];
  addrCols: string[];
  result: DedupResult | null;
  /** Per-group approval: true = approved (drop duplicates), false = rejected (keep all) */
  approvals: Record<number, boolean>;
  error: string | null;
  fileName: string;
  dragging: boolean;
  rawCsv: string;
  inputExt: ExportFormat;
  exportFormat: ExportFormat;
}

export default function CsvDedupTool() {
  const [s, setS] = useState<State>({
    modeId: DEFAULT_MODE_ID,
    headers: [], rows: [], nameCols: [], addrCols: [],
    result: null, approvals: {}, error: null, fileName: "", dragging: false, rawCsv: "",
    inputExt: ".csv", exportFormat: ".csv",
  });
  const mode: DedupMode = getModeById(s.modeId);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toolSession = useRef<ReturnType<typeof startToolSession> | null>(null);

  const ACCEPTED_EXTS = [".csv", ".tsv", ".txt", ".xlsx", ".xls"];
  const isExcel = (name: string) => name.endsWith(".xlsx") || name.endsWith(".xls");

  /** Format a JS Date (from Excel cellDates) as a human-readable string. */
  const fmtDate = (d: Date): string => {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    const hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();
    const datePart = `${m}/${day}/${y}`;
    return hh || mm || ss ? `${datePart} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : datePart;
  };

  /** Stringify a cell value, preserving Date objects as readable strings. */
  const cellToString = (v: unknown): string => {
    if (v instanceof Date && !isNaN(v.getTime())) return fmtDate(v);
    return String(v ?? "");
  };

  const handleParsed = useCallback((headers: string[], rows: CsvRow[], fileName: string, rawCsv: string) => {
    setS(p => {
      const currentMode = getModeById(p.modeId);
      const detected = currentMode.detectColumns(headers);
      const nameCols = detected.nameCols.length ? detected.nameCols : [headers[0] ?? ""];
      const addrCols = detected.addrCols.length ? detected.addrCols : [headers[1] ?? ""];
      const ext = (fileName.slice(fileName.lastIndexOf(".")).toLowerCase() || ".csv") as ExportFormat;
      const result = deduplicate(rows, nameCols, addrCols, {
        extraNormSubs: currentMode.extraNormSubs,
        nameThreshold: currentMode.nameThreshold,
        namesMatcher: currentMode.namesMatcher,
      });
      const approvals: Record<number, boolean> = {};
      result.groups.forEach((_, i) => { approvals[i] = true; });
      return {
        ...p, headers, rows, fileName, rawCsv,
        nameCols, addrCols,
        result, approvals, error: null, dragging: false,
        inputExt: ext, exportFormat: ext,
      };
    });
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
          const wb = XLSX.read(data, { type: "array", cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
          if (!jsonRows.length) throw new Error("Empty spreadsheet");
          const headers = jsonRows[0].map(String);
          const rows: CsvRow[] = [];
          for (let i = 1; i < jsonRows.length; i++) {
            if (!jsonRows[i].some(c => String(c).trim())) continue;
            const row: CsvRow = {};
            headers.forEach((h, j) => { row[h] = decodeEntities(cellToString(jsonRows[i][j])); });
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
      reader.readAsText(file, "UTF-8");
    }
  }, [handleParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const runDedup = () => {
    if (!s.nameCols.length || !s.addrCols.length) { setS(p => ({ ...p, error: "Select both columns." })); return; }
    const result = deduplicate(s.rows, s.nameCols, s.addrCols, {
      extraNormSubs: mode.extraNormSubs,
      nameThreshold: mode.nameThreshold,
      namesMatcher: mode.namesMatcher,
    });
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

  // Compute output rows: start with all rows, then for each approved group remove the dropped records.
  // Apply mode-specific visible-value cleanup only after approval filtering.
  const outputRows = useMemo(() => {
    if (!s.result) return [];
    const droppedSet = new Set<CsvRow>();
    s.result.groups.forEach((g, i) => {
      if (s.approvals[i]) g.dropped.forEach(r => droppedSet.add(r));
    });
    const filtered = s.rows.filter(r => !droppedSet.has(r));
    return mode.cleanRow ? filtered.map(r => mode.cleanRow!(r, s.headers)) : filtered;
  }, [s.result, s.approvals, s.rows, s.headers, mode]);

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
    const baseName = s.fileName.replace(/\.[^.]+$/, "");
    const fmt = s.exportFormat;
    let blob: Blob;
    if (fmt === ".xlsx" || fmt === ".xls") {
      // Build array-of-arrays for predictable worksheet generation (avoids
      // json_to_sheet artifacts from inconsistent object keys).
      const aoa: unknown[][] = [s.headers];
      const dateRe = /^\d{1,2}\/\d{1,2}\/\d{4}(\s\d{2}:\d{2}:\d{2})?$/;
      const isXlsx = fmt === ".xlsx";
      for (const row of outputRows) {
        aoa.push(s.headers.map(h => {
          const v = row[h] ?? "";
          // Restore date strings to Date objects only for .xlsx – the BIFF8
          // writer used for .xls does not reliably handle cell type "d" and
          // produces rendering artifacts, so leave dates as strings there.
          if (isXlsx && typeof v === "string" && dateRe.test(v)) {
            const d = new Date(v);
            if (!isNaN(d.getTime())) return d;
          }
          return v;
        }));
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cleaned");
      const bookType = isXlsx ? "xlsx" : "biff8";
      const mime = isXlsx
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel";
      const buf = XLSX.write(wb, { bookType, type: "array" });
      blob = new Blob([buf], { type: mime });
    } else if (fmt === ".tsv") {
      blob = new Blob(["\uFEFF" + toTSV(s.headers, outputRows)], { type: "text/tab-separated-values;charset=utf-8" });
    } else {
      blob = new Blob(["\uFEFF" + toCSV(s.headers, outputRows)], { type: "text/csv;charset=utf-8" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${baseName}-cleaned${fmt}`;
    a.click(); URL.revokeObjectURL(url);
  };

  const reset = () => setS(p => ({ modeId: p.modeId, headers: [], rows: [], nameCols: [], addrCols: [], result: null, approvals: {}, error: null, fileName: "", dragging: false, rawCsv: "", inputExt: ".csv", exportFormat: ".csv" }));

  const selName = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setS(p => ({ ...p, nameCols: [e.target.value], result: null, approvals: {} }));
  const selAddr = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setS(p => ({ ...p, addrCols: [e.target.value], result: null, approvals: {} }));

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

  const modeSelector = (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
      <label style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>Mode</label>
      <select
        value={s.modeId}
        onChange={e => {
          const newMode = getModeById(e.target.value);
          setS(p => {
            if (!p.headers.length) return { ...p, modeId: e.target.value };
            const detected = newMode.detectColumns(p.headers);
            const nameCols = detected.nameCols.length ? detected.nameCols : [p.headers[0] ?? ""];
            const addrCols = detected.addrCols.length ? detected.addrCols : [p.headers[1] ?? ""];
            const result = deduplicate(p.rows, nameCols, addrCols, {
              extraNormSubs: newMode.extraNormSubs,
              nameThreshold: newMode.nameThreshold,
              namesMatcher: newMode.namesMatcher,
            });
            const approvals: Record<number, boolean> = {};
            result.groups.forEach((_, i) => { approvals[i] = true; });
            return { ...p, modeId: e.target.value, nameCols, addrCols, result, approvals, error: null };
          });
        }}
        style={{
          backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px",
          color: "#e2e8f0", padding: "8px 12px", fontSize: "14px", flex: 1, maxWidth: "280px",
        }}
      >
        {DEDUP_MODES.map(m => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      <span style={{ fontSize: "12px", color: "#64748b" }}>{mode.description}</span>
    </div>
  );

  if (!s.rows.length) return (
    <div>
      {modeSelector}
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
        <div style={{ color: "#64748b", fontSize: "14px" }}>or click to browse · {mode.uploadHint}</div>
      </div>
      {s.error && <div style={{ color: "#f87171", marginTop: "1rem", fontSize: "14px" }}>⚠️ {s.error}</div>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {modeSelector}
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

        <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "4px", textAlign: "center" }}>
          Duplicates are detected automatically. Review each group below before downloading.
        </div>

        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: "4px 0", display: "flex", alignItems: "center", gap: "4px", margin: "0 auto" }}
        >
          <span style={{ display: "inline-block", transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▸</span>
          Wrong columns? Adjust detection
        </button>

        {showAdvanced && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{mode.columnLabels.primary}</label>
                <select style={selectStyle} value={s.nameCols[0] ?? ""} onChange={selName}>
                  {s.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {s.nameCols.length > 1 && (
                  <div style={{ fontSize: "11px", color: "#6366f1", marginTop: "4px" }}>Using composite: {s.nameCols.join(" + ")}</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{mode.columnLabels.secondary}</label>
                <select style={selectStyle} value={s.addrCols[0] ?? ""} onChange={selAddr}>
                  {s.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {s.addrCols.length > 1 && (
                  <div style={{ fontSize: "11px", color: "#6366f1", marginTop: "4px" }}>Using composite: {s.addrCols.join(" + ")}</div>
                )}
              </div>
            </div>

            <button onClick={runDedup} style={{
              backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: "10px",
              padding: "10px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
              boxShadow: `0 0 20px ${ACCENT}40`, width: "100%",
            }}>
              🔍 Rerun Analysis
            </button>
          </>
        )}
        {s.error && <div style={{ color: "#f87171", marginTop: "1rem", fontSize: "14px" }}>⚠️ {s.error}</div>}
      </div>

      {/* Results */}
      {s.result && (
        <>
          {/* Summary + primary action */}
          <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
            {s.result.groups.length > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
                  {[
                    { label: "Rows In", value: s.rows.length.toLocaleString(), color: "#94a3b8" },
                    { label: "Groups Found", value: s.result.groups.length.toLocaleString(), color: "#facc15" },
                    { label: "Removing", value: totalRemoved.toLocaleString(), color: "#f87171" },
                    { label: "Rows Out", value: outputRows.length.toLocaleString(), color: "#4ade80" },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", marginBottom: "1.25rem" }}>
                  {approvedCount} of {s.result.groups.length} group{s.result.groups.length !== 1 ? "s" : ""} approved
                  {s.result.groups.length - approvedCount > 0 && (<span style={{ color: "#f87171" }}> · {s.result.groups.length - approvedCount} rejected</span>)}
                </div>

                {/* Download — primary action with format picker */}
                <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                  <button onClick={download} style={{
                    backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "10px",
                    padding: "14px 28px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 0 20px rgba(22,163,74,0.3)", flex: 1,
                  }}>
                    ⬇️ Download Cleaned {s.exportFormat.replace(".", "").toUpperCase()} ({outputRows.length.toLocaleString()} rows)
                  </button>
                  <select
                    value={s.exportFormat}
                    onChange={e => setS(p => ({ ...p, exportFormat: e.target.value as ExportFormat }))}
                    style={{
                      backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "10px",
                      color: "#e2e8f0", padding: "0 12px", fontSize: "13px", fontWeight: 600,
                      cursor: "pointer", minWidth: "80px",
                    }}
                  >
                    {EXPORT_FORMATS.map(f => (
                      <option key={f} value={f}>
                        {f.replace(".", "").toUpperCase()}{f === s.inputExt ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: "#64748b", padding: "1rem 0" }}>
                ✅ No duplicates found. Your list is clean!
              </div>
            )}
          </div>

          {/* Collapsible review section */}
          {s.result.groups.length > 0 && (
            <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
              <button
                onClick={() => setShowGroups(v => !v)}
                style={{ background: "none", border: "none", color: "#e2e8f0", cursor: "pointer", fontSize: "14px", fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: "6px", width: "100%" }}
              >
                <span style={{ display: "inline-block", transform: showGroups ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", fontSize: "12px" }}>▸</span>
                🔁 Review {s.result.groups.length} Duplicate Group{s.result.groups.length !== 1 ? "s" : ""}
                <span style={{ color: "#64748b", fontWeight: 400, fontSize: "13px", marginLeft: "auto" }}>
                  {approvedCount} approved · {s.result.groups.length - approvedCount} rejected
                </span>
              </button>

              {showGroups && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", marginBottom: "4px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Approved groups will have duplicates removed; rejected groups keep all records.
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
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
                              <span style={{ fontSize: "14px", fontWeight: 600 }}>{s.nameCols.map(c => g.kept[c] ?? "").join(" ").trim()}</span>
                            </div>
                            {g.dropped.map((r, j) => (
                              <div key={j} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontSize: "11px", backgroundColor: approved ? "#dc262620" : "#33415540", color: approved ? "#f87171" : "#64748b", border: `1px solid ${approved ? "#dc262640" : "#33415560"}`, borderRadius: "6px", padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>{approved ? "✗ DROP" : "— KEEP"}</span>
                                <span style={{ fontSize: "14px", color: "#64748b" }}>{s.nameCols.map(c => r[c] ?? "").join(" ").trim()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
