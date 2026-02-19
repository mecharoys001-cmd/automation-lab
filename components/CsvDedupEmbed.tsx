"use client";
import CsvDedupTool from "./CsvDedupTool";

const ACCENT = "#6366f1";

export default function CsvDedupEmbed() {
  return (
    <div
      style={{
        backgroundColor: "#0a0e1a",
        borderTop: "1px solid #1e293b",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 0",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {["#ef4444", "#f59e0b", "#10b981"].map(c => (
                <div key={c} style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: c }} />
              ))}
            </div>
            <div
              style={{
                backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "8px",
                padding: "6px 14px", fontSize: "12px", color: "#64748b", fontFamily: "monospace",
              }}
            >
              🔒 Runs locally in your browser — no data uploaded
            </div>
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}30`,
              borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: ACCENT,
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT, display: "inline-block" }} />
            100% Private
          </div>
        </div>

        {/* Tool */}
        <div style={{ padding: "2rem 0" }}>
          <CsvDedupTool />
        </div>
      </div>
    </div>
  );
}
