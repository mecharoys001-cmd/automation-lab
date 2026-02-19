import Link from "next/link";

const tools = [
  {
    id: "camp-scheduler",
    name: "Camp Scheduler",
    description:
      "A full-featured weekly activity scheduler for camps and programs. Features drag-and-drop scheduling, conflict detection, one-click resolution, instructor availability management, venue tracking, and Google Sheets integration.",
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
    accent: "#10b981",
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
    accent: "#3b82f6",
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
    accent: "#f59e0b",
  },
];

export default function ToolsPreview() {
  return (
    <section id="tools" style={{ padding: "6rem 1.5rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#10b981",
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Free Tools
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            Tools Built for Nonprofits
          </h2>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "16px",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
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
              className="card-glow"
              style={{
                backgroundColor: "#111827",
                borderRadius: "16px",
                padding: "2rem",
                border: "1px solid #1e293b",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                opacity: tool.status === "coming-soon" ? 0.7 : 1,
              }}
            >
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
                      backgroundColor:
                        tool.status === "live"
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(100, 116, 139, 0.15)",
                      color:
                        tool.status === "live" ? "#10b981" : "#64748b",
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
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
                  }}
                >
                  {tool.name}
                </h3>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "14px",
                    lineHeight: 1.6,
                  }}
                >
                  {tool.description}
                </p>
              </div>

              {/* Features */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  flexGrow: 1,
                }}
              >
                {tool.features.map((f) => (
                  <span
                    key={f}
                    style={{
                      backgroundColor: `${tool.accent}15`,
                      color: tool.accent,
                      border: `1px solid ${tool.accent}30`,
                      borderRadius: "6px",
                      padding: "3px 10px",
                      fontSize: "12px",
                      fontWeight: 500,
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
                  style={{
                    backgroundColor: tool.accent,
                    color: "#fff",
                    padding: "12px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                    textAlign: "center",
                    display: "block",
                  }}
                >
                  Open Tool →
                </Link>
              ) : (
                <div
                  style={{
                    backgroundColor: "rgba(100,116,139,0.1)",
                    color: "#64748b",
                    padding: "12px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textAlign: "center",
                    border: "1px solid #1e293b",
                  }}
                >
                  In Development
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
