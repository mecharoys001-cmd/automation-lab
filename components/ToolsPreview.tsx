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
    accentRaw: "#6366f1",
  },
  {
    id: "scheduler",
    name: "Symphonix Scheduler",
    description:
      "Automated scheduling platform for educational music programs. Generate sessions from templates, manage instructor availability, and publish schedules.",
    features: ["Template-based scheduling", "Instructor availability", "Conflict detection", "Email notifications"],
    icon: "🎵",
    href: "/tools/scheduler",
    accentRaw: "#a244ae",
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
    <section id="tools" className="section section-light">
      <div className="container">
        <div className="section-header" data-reveal="fade">
          <div className="label-overline" style={{ marginBottom: "10px" }}>Free Tools</div>
          <h2 className="heading-section">Tools Built for Nonprofits</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", maxWidth: "480px", margin: "0 auto" }}>
            Free, open tools developed through the Automation Lab, ready for your organization to use today.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
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
              }}
            >
              <div className="card-accent-top" style={{ background: tool.accentRaw }} />

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <span style={{ fontSize: "2rem" }}>{tool.icon}</span>
                    <span className="badge-live">● Live</span>
                  </div>
                  <h3 className="heading-card" style={{ fontSize: "16px", marginBottom: "8px" }}>{tool.name}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.65 }}>{tool.description}</p>
                </div>

                {/* Features */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", flexGrow: 1 }}>
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        background: `${tool.accentRaw}10`,
                        color: tool.accentRaw,
                        border: `1px solid ${tool.accentRaw}25`,
                        borderRadius: "var(--radius-sm)",
                        padding: "2px 8px",
                        fontSize: "11px",
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
                  className="btn-primary"
                  style={{ justifyContent: "center", background: tool.accentRaw }}
                >
                  Open Tool →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
