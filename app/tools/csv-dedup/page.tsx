import type { Metadata } from "next";
import Link from "next/link";
import CsvDedupEmbed from "@/components/CsvDedupEmbed";

export const metadata: Metadata = {
  title: "CSV Deduplicator | Automation Lab Tools",
  description:
    "Free browser-based CSV deduplication tool. Removes exact and fuzzy-matched duplicate entries — handles misspelled names, initials, and concatenated names at the same address.",
};

const features = [
  { icon: "🔍", label: "Fuzzy Name Matching", desc: "Catches misspellings, initials, and concatenated names (Ethan vs Ethen vs E. vs Ebrewerton)" },
  { icon: "📍", label: "Address-Aware", desc: "Groups by address first, then checks names — so 'Main Street' and 'Main St.' are the same" },
  { icon: "🏆", label: "Smart Keeper", desc: "Automatically keeps the most complete record from each duplicate cluster" },
  { icon: "🔒", label: "100% Private", desc: "All processing happens in your browser — your data never leaves your computer" },
  { icon: "⚡", label: "Auto-Detect", desc: "Automatically finds the name and address columns — or pick them manually" },
  { icon: "📥", label: "Download Ready", desc: "Downloads a clean CSV with the same column structure as your original" },
];

export default function CsvDedupPage() {
  return (
    <div style={{ paddingTop: "64px", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #1e293b", display: "flex", gap: "8px", fontSize: "13px", color: "#64748b" }}>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>Automation Lab</Link>
        <span>/</span>
        <Link href="/tools" style={{ color: "#64748b", textDecoration: "none" }}>Tools</Link>
        <span>/</span>
        <span style={{ color: "#6366f1" }}>CSV Deduplicator</span>
      </div>

      {/* Hero */}
      <div style={{ padding: "3rem 1.5rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.5rem", marginBottom: "2rem" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "100px", padding: "4px 12px", marginBottom: "1rem" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6366f1", display: "inline-block" }} />
              <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: 600 }}>Live · Free to Use</span>
            </div>
            <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
              🧹 CSV Deduplicator
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "16px", lineHeight: 1.7, maxWidth: "600px" }}>
              Upload a mailing list or contacts CSV and get a cleaned version back — with exact duplicates
              and fuzzy matches (misspellings, abbreviations, concatenated names) all merged automatically.
            </p>
          </div>
        </div>

        {/* Feature chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
          {features.map(f => (
            <div key={f.label} style={{ backgroundColor: "rgba(17, 24, 39, 0.8)", border: "1px solid #1e293b", borderRadius: "10px", padding: "1rem", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "18px" }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "2px" }}>{f.label}</div>
                <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool embed */}
      <CsvDedupEmbed />

      {/* About */}
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1.5rem 5rem" }}>
        <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "2rem" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "1rem" }}>How It Works</h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, marginBottom: "1rem" }}>
            The tool groups entries by their address (normalizing abbreviations like &quot;Street&quot; → &quot;St&quot; and
            &quot;Avenue&quot; → &quot;Ave&quot; before comparing). Within each address group, it uses{" "}
            <strong style={{ color: "#e2e8f0" }}>Jaro-Winkler string similarity</strong> to catch misspellings,
            and checks for initial abbreviations and concatenated names.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, marginBottom: "1rem" }}>
            When duplicates are found, the record with the <strong style={{ color: "#e2e8f0" }}>most complete name</strong> is
            kept and the others are dropped. All other columns (email, phone, etc.) are preserved from the kept record.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7 }}>
            Your file is processed entirely in your browser using JavaScript — nothing is uploaded to any server.
          </p>
        </div>
      </div>
    </div>
  );
}
