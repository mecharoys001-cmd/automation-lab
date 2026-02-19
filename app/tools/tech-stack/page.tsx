import type { Metadata } from "next";
import Link from "next/link";
import TechStackTool from "@/components/TechStackTool";

export const metadata: Metadata = {
  title: "Tech Stack Mapper | Automation Lab Tools",
  description:
    "Map every tool your organization uses and how they connect. Visual diagram organized by category — find gaps, eliminate redundancy, and share your stack with your team.",
};

const features = [
  { icon: "📚", label: "45+ Tools Pre-loaded",  desc: "Common nonprofit tools across CRM, Finance, Email, Events, and more — searchable by name" },
  { icon: "🔗", label: "Integration Mapping",   desc: "Click any two tools to mark them as integrated. Click again to remove the connection." },
  { icon: "🗺️", label: "Visual Lane Map",       desc: "Nodes auto-arrange by category — clean, shareable diagram your whole team can read" },
  { icon: "🎯", label: "Gap Detection",          desc: "Isolated tools with no connections reveal manual handoffs and automation opportunities" },
  { icon: "📥", label: "Export & Import JSON",  desc: "Save your map as JSON and reload it later — or share it with a consultant or board member" },
  { icon: "🔒", label: "100% Private",           desc: "Everything runs in your browser. Your data never leaves your computer." },
];

export default function TechStackPage() {
  return (
    <div style={{ paddingTop: "64px", minHeight: "100vh" }}>

      {/* Breadcrumb */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #1e293b", display: "flex", gap: "8px", fontSize: "13px", color: "#64748b" }}>
        <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>Automation Lab</Link>
        <span>/</span>
        <Link href="/tools" style={{ color: "#64748b", textDecoration: "none" }}>Tools</Link>
        <span>/</span>
        <span style={{ color: "#0ea5e9" }}>Tech Stack Mapper</span>
      </div>

      {/* Hero */}
      <div style={{ padding: "3rem 1.5rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.3)", borderRadius: "100px", padding: "4px 12px", marginBottom: "1rem" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#0ea5e9", display: "inline-block" }} />
            <span style={{ fontSize: "12px", color: "#0ea5e9", fontWeight: 600 }}>Live · Free to Use</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            🗺️ Tech Stack Mapper
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "16px", lineHeight: 1.7, maxWidth: "620px" }}>
            Build a visual map of every tool your organization uses and how they connect.
            Find automation gaps, eliminate redundancy, and communicate your stack clearly
            to your team or board.
          </p>
        </div>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
          {features.map(f => (
            <div key={f.label} style={{ backgroundColor: "rgba(17,24,39,0.8)", border: "1px solid #1e293b", borderRadius: "10px", padding: "1rem", display: "flex", gap: "10px", alignItems: "flex-start" }}>
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
      <div style={{ borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
          <TechStackTool />
        </div>
      </div>

      {/* How to use */}
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        <div style={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: "16px", padding: "2rem" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "1.25rem" }}>How to Use It</h2>
          {[
            ["1. Add your tools",      "Browse the library on the left by category, or search by name. Click a tool to add it to the map. Click again to remove it. Need something that isn't listed? Use the Custom Tool form at the bottom."],
            ["2. Map integrations",    "Switch to Connect mode (toolbar). Click one tool, then click a second — a connection line appears. Click the same pair again to remove it. Connections represent any real-time or scheduled data sync between tools."],
            ["3. Read your map",       "Isolated tools with no connections are your manual handoffs — data that staff are copy-pasting or re-entering. These are your best automation targets."],
            ["4. Save your work",      "Click ⬇ JSON to download your map. Import it later with ⬆ Import, or share the file with a consultant, IT team, or board member for a tech audit."],
          ].map(([title, desc]) => (
            <div key={title as string} style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", minWidth: "155px", color: "#e2e8f0", paddingTop: "1px" }}>{title}</div>
              <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
