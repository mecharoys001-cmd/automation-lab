"use client";

import { useState, useRef, useCallback } from "react";
import { parseCSV, toCSV, detectColumns, deduplicate, DedupResult, CsvRow } from "@/lib/csvDedup";

const ACCENT = "#6366f1";

interface State {
  headers: string[];
  rows: CsvRow[];
  nameCol: string;
  addrCol: string;
  result: DedupResult | null;
  error: string | null;
  fileName: string;
  dragging: boolean;
}

export default function CsvDedupTool() {
  const [s, setS] = useState<State>({
    headers: [], rows: [], nameCol: "", addrCol: "",
    result: null, error: null, fileName: "", dragging: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setS(p => ({ ...p, error: "Please upload a .csv file." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const { headers, rows } = parseCSV(e.target?.result as string);
        const { nameCol, addrCol } = detectColumns(headers);
        setS(p => ({
          ...p, headers, rows, fileName: file.name,
          nameCol: nameCol ?? headers[0] ?? "",
          addrCol: addrCol ?? headers[1] ?? "",
          result: null, error: null, dragging: false,
        }));
      } catch {
        setS(p => ({ ...p, error: "Failed to parse CSV. Check the file format.", dragging: false }));
      }
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const runDedup = () => {
    if (!s.nameCol || !s.addrCol) { setS(p => ({ ...p, error: "Select both columns." })); return; }
    const result = deduplicate(s.rows, s.nameCol, s.addrCol);
    setS(p => ({ ...p, result, error: null }));
  };

  const download = () => {
    if (!s.result) return;
    const csv = toCSV(s.headers, s.result.rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url;
    a.download = s.fileName.replace(".csv", "-cleaned.csv");
    a.click(); URL.revokeObjectURL(url);
  };

  const reset = () => setS({ headers: [], rows: [], nameCol: "", addrCol: "", result: null, error: null, fileName: "", dragging: false });

  const sel = (field: "nameCol" | "addrCol") => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setS(p => ({ ...p, [field]: e.target.value, result: null }));

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
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📂</div>
        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>Drop your CSV here</div>
        <div style={{ color: "#64748b", fontSize: "14px" }}>or click to browse · must have a name column and an address column</div>
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
          🔍 Run Deduplication
        </button>
        {s.error && <div style={{ color: "#f87171", marginTop: "1rem", fontSize: "14px" }}>⚠️ {s.error}</div>}
      </div>

      {/* Results */}
      {s.result && (
        <>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {[
              { label: "Rows In", value: s.rows.length.toLocaleString(), color: "#94a3b8" },
              { label: "Removed", value: s.result.removed.toLocaleString(), color: "#f87171" },
              { label: "Rows Out", value: s.result.rows.length.toLocaleString(), color: "#4ade80" },
            ].map(item => (
              <div key={item.label} style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "1.25rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Duplicate groups */}
          {s.result.groups.length > 0 ? (
            <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "1.5rem" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "1rem" }}>
                🔁 {s.result.groups.length} Duplicate Group{s.result.groups.length !== 1 ? "s" : ""} Found
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {s.result.groups.map((g, i) => (
                  <div key={i} style={{ backgroundColor: "#0f172a", borderRadius: "10px", padding: "1rem", border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>📍 {g.address}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", backgroundColor: "#16a34a20", color: "#4ade80", border: "1px solid #16a34a40", borderRadius: "6px", padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>✓ KEPT</span>
                        <span style={{ fontSize: "14px", fontWeight: 600 }}>{g.kept[s.nameCol]}</span>
                      </div>
                      {g.dropped.map((r, j) => (
                        <div key={j} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", backgroundColor: "#dc262620", color: "#f87171", border: "1px solid #dc262640", borderRadius: "6px", padding: "2px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>✗ DROP</span>
                          <span style={{ fontSize: "14px", color: "#64748b" }}>{r[s.nameCol]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "2rem", textAlign: "center", color: "#64748b" }}>
              ✅ No duplicates found — your list is clean!
            </div>
          )}

          {/* Download */}
          <button onClick={download} style={{
            backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "10px",
            padding: "14px 28px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 0 20px rgba(22,163,74,0.3)",
          }}>
            ⬇️ Download Cleaned CSV ({s.result.rows.length.toLocaleString()} rows)
          </button>
        </>
      )}
    </div>
  );
}
