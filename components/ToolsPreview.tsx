import Link from "next/link";

const tools = [
  {
    id: "csv-dedup",
    name: "CSV Deduplicator",
    description:
      "Clean your mailing lists instantly. Fuzzy matching catches misspelled names, initials, and duplicates. Runs 100% in your browser — your data never leaves your computer.",
    features: ["Fuzzy name matching", "Address normalization", "Smart record selection", "100% browser-based"],
    icon: "🧹",
    href: "/tools/csv-dedup",
    accentRaw: "#90339d",
  },
  {
    id: "scheduler",
    name: "Symphonix Scheduler",
    description:
      "Automated scheduling platform for educational music programs. Generate sessions from templates, manage instructor availability, and publish schedules.",
    features: ["Template-based scheduling", "Instructor availability", "Conflict detection", "Email notifications"],
    icon: "🎵",
    href: "/tools/scheduler",
    accentRaw: "#1282a2",
  },
  {
    id: "reports",
    name: "Transaction Reports",
    description:
      "Upload your Shopify transaction CSV and get an instant visual dashboard with sales breakdowns, payment method trends, and summary statistics.",
    features: ["Shopify CSV import", "Sales breakdown charts", "Payment method analysis", "100% browser-based"],
    icon: "📊",
    href: "/tools/reports",
    accentRaw: "#10b981",
  },
];

export default function ToolsPreview() {
  return (
    <section id="tools" className="section" style={{ background: "var(--bg-surface)", padding: "96px 24px" }}>
      <div className="container">
        <div className="section-header" data-reveal="fade">
          <h2 className="heading-section">Tools Built for Nonprofits</h2>
          <div style={{ width: "96px", height: "6px", background: "var(--secondary)", borderRadius: "var(--radius-pill)", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", maxWidth: "540px", margin: "0 auto" }}>
            Free, open tools developed through the Automation Lab, ready for your organization to use today.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "32px" }}>
          {tools.map((tool, i) => (
            <div
              key={tool.id}
              className="card"
              data-reveal
              data-delay={i * 110}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderTop: `4px solid ${tool.accentRaw}`,
              }}
            >
              <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ fontSize: "2.5rem" }}>{tool.icon}</span>
                    <span className="badge-live">● Live</span>
                  </div>
                  <h3 className="heading-card" style={{ fontSize: "1.3rem", marginBottom: "10px" }}>{tool.name}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.7 }}>{tool.description}</p>
                </div>

                {/* Features */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", flexGrow: 1 }}>
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        background: `${tool.accentRaw}10`,
                        color: tool.accentRaw,
                        border: `1px solid ${tool.accentRaw}25`,
                        borderRadius: "var(--radius-sm)",
                        padding: "3px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={tool.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: tool.accentRaw,
                    fontWeight: 700,
                    fontSize: "15px",
                    fontFamily: "var(--font-body)",
                    textDecoration: "none",
                    transition: "gap 0.2s",
                  }}
                >
                  Open Tool <span style={{ transition: "transform 0.2s" }}>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
