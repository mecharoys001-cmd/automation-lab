"use client";
import { useState } from "react";

const ACCENT = "#6366f1";

// TODO: replace with the deployed Google Apps Script URL after deployment
const DEDUP_URL = "https://script.google.com/macros/s/AKfycbyiM3e3yhpar7I8_zWMcI7OoKafk9lqiH8JAvIDTku8TIkhSZeaVKhK9AtKNB-syd7FAQ/exec";

export default function CsvDedupEmbed() {
  const [loading, setLoading] = useState(true);
  const [embedFailed, setEmbedFailed] = useState(false);

  const isPlaceholder = false;

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
                maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {isPlaceholder ? "Awaiting deployment…" : DEDUP_URL}
            </div>
          </div>
          {!isPlaceholder && (
            <a
              href={DEDUP_URL} target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: "6px", color: "#64748b",
                textDecoration: "none", fontSize: "12px", padding: "6px 12px",
                border: "1px solid #1e293b", borderRadius: "8px",
              }}
            >
              ↗ Open full screen
            </a>
          )}
        </div>

        {/* Embed frame */}
        <div style={{ position: "relative", width: "100%", height: "700px", backgroundColor: "#111827" }}>

          {/* Loading spinner */}
          {loading && !embedFailed && !isPlaceholder && (
            <div
              style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "1rem", color: "#64748b", zIndex: 1,
              }}
            >
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                border: "3px solid #1e293b", borderTopColor: ACCENT,
                animation: "spin 1s linear infinite",
              }} />
              <span style={{ fontSize: "14px" }}>Loading CSV Deduplicator…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Placeholder state */}
          {isPlaceholder && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "3rem" }}>🧹</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>CSV Deduplicator</h3>
              <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "400px", lineHeight: 1.6 }}>
                This tool is being deployed. Once live, it will appear here as an interactive app.
              </p>
              <div style={{
                backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: "10px",
                padding: "12px 20px", fontSize: "13px", color: ACCENT,
              }}>
                ⏳ Awaiting Google Apps Script deployment
              </div>
            </div>
          )}

          {/* Embed failed fallback */}
          {embedFailed && !isPlaceholder && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "2rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "3rem" }}>🧹</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>CSV Deduplicator</h3>
              <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "400px", lineHeight: 1.6 }}>
                The tool runs as a Google Apps Script web app. Click below to open it in a new tab.
              </p>
              <a
                href={DEDUP_URL} target="_blank" rel="noopener noreferrer"
                style={{
                  backgroundColor: ACCENT, color: "#fff", padding: "14px 28px", borderRadius: "10px",
                  fontSize: "15px", fontWeight: 600, textDecoration: "none", boxShadow: `0 0 20px ${ACCENT}40`,
                }}
              >
                Open CSV Deduplicator →
              </a>
            </div>
          )}

          {/* Iframe */}
          {!isPlaceholder && (
            <iframe
              src={DEDUP_URL}
              style={{ width: "100%", height: "100%", border: "none", display: loading ? "none" : "block" }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setEmbedFailed(true); }}
              title="CSV Deduplicator"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            />
          )}
        </div>

        {/* Footer note */}
        {!isPlaceholder && (
          <div style={{ padding: "0.75rem 0", fontSize: "12px", color: "#475569", textAlign: "center" }}>
            If the tool doesn&apos;t load,{" "}
            <a href={DEDUP_URL} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }}>
              open it directly ↗
            </a>{" "}
            — Google Apps Script apps may require sign-in on first use.
          </div>
        )}
      </div>
    </div>
  );
}
