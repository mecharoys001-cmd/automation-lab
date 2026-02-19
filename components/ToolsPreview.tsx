import Link from "next/link";

const tools = [
  {
    id: "camp-scheduler",
    name: "Camp Scheduler",
    description:
      "A full-featured weekly activity scheduler for camps and programs. Drag-and-drop scheduling, conflict detection, one-click resolution, instructor availability management, venue tracking, and Google Sheets integration.",
    status: "live" as const,
    features: [
      "Drag & drop scheduling",
      "Conflict detection (6 types)",
      "Auto-resolution engine",
      "Instructor availability",
      "16+ venue management",
      "Google Sheets sync",
    ],
    icon: "📅",
    href: "/tools/camp-scheduler",
    accentRaw: "#a244ae",
  },
  {
    id: "email-automator",
    name: "Email Newsletter Automator",
    description:
      "Automate your nonprofit email newsletter workflow. Connect your event data source and let AI draft, format, and schedule your newsletters.",
    status: "coming-soon" as const,
    features: [
      "AI-generated drafts",
      "Mailchimp integration",
      "Event data import",
      "Scheduled sends",
    ],
    icon: "📧",
    href: "#",
    accentRaw: "#21b8bb",
  },
  {
    id: "grant-tracker",
    name: "Grant Tracker",
    description:
      "Track grant deadlines, requirements, and reporting cycles. Never miss a funder deadline or renewal window again.",
    status: "coming-soon" as const,
    features: [
      "Deadline tracking",
      "Report reminders",
      "Funder CRM",
      "Impact metrics",
    ],
    icon: "📋",
    href: "#",
    accentRaw: "#1282a2",
  },
];

export default function ToolsPreview() {
  return (
    <section id="tools" className="section section-light">
      <div className="container">
        {/* Header */}
        <div className="section-header" data-reveal="fade">
          <div
            className="tag-teal"
            style={{ display: "inline-block", marginBottom: "1.25rem" }}
          >
            Free Tools
          </div>
          <h2 className="section-heading-decorated">Tools Built for Nonprofits</h2>
          <p className="text-section-sub">
            Free, open tools developed through the Automation Lab — ready for
            your organization to use today.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {tools.map((tool, i) => (
            <div
              key={tool.id}
              className="card-light"
              data-reveal
              data-delay={i * 120}
              style={{
                padding: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                opacity: tool.status === "coming-soon" ? 0.75 : 1,
              }}
            >
              {/* Accent bar */}
              <div style={{ height: "4px", background: tool.accentRaw }} />

              <div
                style={{
                  padding: "2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                  flex: 1,
                }}
              >
                {/* Top row */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <span style={{ fontSize: "2rem" }}>{tool.icon}</span>
                    {tool.status === "live" ? (
                      <span className="badge-live">● Live</span>
                    ) : (
                      <span className="badge-soon">Coming Soon</span>
                    )}
                  </div>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      marginBottom: "0.75rem",
                      color: "var(--navy)",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {tool.name}
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.65 }}>
                    {tool.description}
                  </p>
                </div>

                {/* Feature tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", flexGrow: 1 }}>
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        backgroundColor: `${tool.accentRaw}10`,
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
                {tool.status === "live" ? (
                  <Link
                    href={tool.href}
                    className="btn-primary"
                    style={{
                      justifyContent: "center",
                      background: tool.accentRaw,
                      boxShadow: `0 4px 16px ${tool.accentRaw}30`,
                    }}
                  >
                    Open Tool →
                  </Link>
                ) : (
                  <div
                    style={{
                      backgroundColor: "var(--bg-light)",
                      color: "var(--text-subtle)",
                      padding: "13px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "14px",
                      fontWeight: 600,
                      textAlign: "center",
                      border: "1px solid var(--border-light)",
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
