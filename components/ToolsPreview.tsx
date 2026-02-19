import Link from "next/link";

const tools = [
  {
    id: "camp-scheduler",
    name: "Camp Scheduler",
    description:
      "A full-featured weekly activity scheduler for camps and programs. Drag-and-drop scheduling, conflict detection, one-click resolution, instructor availability management, venue tracking, and Google Sheets integration.",
    status: "live" as const,
    features: ["Drag & drop scheduling","Conflict detection (6 types)","Auto-resolution engine","Instructor availability","16+ venue management","Google Sheets sync"],
    icon: "📅",
    href: "/tools/camp-scheduler",
    accentRaw: "#1282a2",
  },
  {
    id: "email-automator",
    name: "Email Newsletter Automator",
    description:
      "Automate your nonprofit email newsletter workflow. Connect your event data source and let AI draft, format, and schedule your newsletters.",
    status: "coming-soon" as const,
    features: ["AI-generated drafts","Mailchimp integration","Event data import","Scheduled sends"],
    icon: "📧",
    href: "#",
    accentRaw: "#68ccd1",
  },
  {
    id: "grant-tracker",
    name: "Grant Tracker",
    description:
      "Track grant deadlines, requirements, and reporting cycles. Never miss a funder deadline or renewal window again.",
    status: "coming-soon" as const,
    features: ["Deadline tracking","Report reminders","Funder CRM","Impact metrics"],
    icon: "📋",
    href: "#",
    accentRaw: "#a28231",
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
            Free, open tools developed through the Automation Lab — ready for your organization to use today.
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
                opacity: tool.status === "coming-soon" ? 0.8 : 1,
              }}
            >
              <div className="card-accent-top" style={{ background: tool.accentRaw }} />

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <span style={{ fontSize: "2rem" }}>{tool.icon}</span>
                    {tool.status === "live"
                      ? <span className="badge-live">● Live</span>
                      : <span className="badge-soon">Coming Soon</span>}
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
                {tool.status === "live" ? (
                  <Link
                    href={tool.href}
                    className="btn-primary"
                    style={{ justifyContent: "center", background: tool.accentRaw }}
                  >
                    Open Tool →
                  </Link>
                ) : (
                  <div
                    style={{
                      background: "var(--bg-light)",
                      color: "var(--text-muted)",
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "13px",
                      fontWeight: 600,
                      textAlign: "center",
                      border: "1px solid var(--border)",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    In Development
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
