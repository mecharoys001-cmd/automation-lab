import Link from "next/link";

const tools = [
  {
    id: "camp-scheduler",
    name: "Camp Scheduler",
    description:
      "A full-featured weekly activity scheduler for camps and programs. Drag-and-drop scheduling, conflict detection, one-click resolution, instructor availability management, venue tracking, and Google Sheets integration.",
    status: "live",
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
    accent: "#a244ae",
  },
  {
    id: "coming-soon-1",
    name: "Email Newsletter Automator",
    description:
      "Automate your nonprofit email newsletter workflow. Connect your event data source and let AI draft, format, and schedule your newsletters.",
    status: "coming-soon",
    features: [
      "AI-generated drafts",
      "Mailchimp integration",
      "Event data import",
      "Scheduled sends",
    ],
    icon: "📧",
    href: "#",
    accent: "#21b8bb",
  },
  {
    id: "coming-soon-2",
    name: "Grant Tracker",
    description:
      "Track grant deadlines, requirements, and reporting cycles. Never miss a funder deadline or renewal window again.",
    status: "coming-soon",
    features: [
      "Deadline tracking",
      "Report reminders",
      "Funder CRM",
      "Impact metrics",
    ],
    icon: "📋",
    href: "#",
    accent: "#1282a2",
  },
];

export default function ToolsPreview() {
  return (
    <section id="tools" style={{ padding: "6rem 1.5rem", backgroundColor: "#ffffff" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div className="tag-teal" style={{ display: "inline-block", marginBottom: "1.25rem" }}>
            Free Tools
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
              color: "#1a1a38",
            }}
          >
            Tools Built for Nonprofits
          </h2>
          <p style={{ color: "#6b7a8f", fontSize: "16px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.65 }}>
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
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="card-light"
              style={{
                padding: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                opacity: tool.status === "coming-soon" ? 0.75 : 1,
              }}
            >
              {/* Accent bar */}
              <div style={{ height: "4px", background: tool.accent }} />

              <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>
                {/* Top */}
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
                    <span
                      style={{
                        backgroundColor: tool.status === "live" ? `${tool.accent}15` : "rgba(155,165,180,0.12)",
                        color: tool.status === "live" ? tool.accent : "#9aa3b0",
                        padding: "4px 10px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        border: `1px solid ${tool.status === "live" ? tool.accent + "30" : "#e0e7ef"}`,
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {tool.status === "live" ? "● Live" : "Coming Soon"}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      marginBottom: "0.75rem",
                      color: "#1a1a38",
                    }}
                  >
                    {tool.name}
                  </h3>
                  <p style={{ color: "#6b7a8f", fontSize: "14px", lineHeight: 1.65 }}>
                    {tool.description}
                  </p>
                </div>

                {/* Features */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", flexGrow: 1 }}>
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        backgroundColor: `${tool.accent}10`,
                        color: tool.accent,
                        border: `1px solid ${tool.accent}25`,
                        borderRadius: "6px",
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
                    style={{ justifyContent: "center", background: tool.accent, boxShadow: `0 4px 16px ${tool.accent}30` }}
                  >
                    Open Tool →
                  </Link>
                ) : (
                  <div
                    style={{
                      backgroundColor: "#f5f7fa",
                      color: "#9aa3b0",
                      padding: "13px",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: 600,
                      textAlign: "center",
                      border: "1px solid #e0e7ef",
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
