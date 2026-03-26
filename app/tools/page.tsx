import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools | The Automation Lab",
  description:
    "Free automation tools built for nonprofits by the NWCT Arts Council Automation Lab.",
};

const tools = [
  {
    id: "csv-dedup",
    name: "CSV Deduplicator",
    tagline: "Clean your mailing lists in seconds.",
    description:
      "Upload a contacts CSV and get a cleaned file back instantly. Catches misspelled names, initials, and duplicates when they share the same address. Runs 100% in your browser. Your data never leaves your computer.",
    features: ["Fuzzy name matching", "Address normalization", "Auto-detects columns", "100% browser-based"],
    icon: "🧹",
    href: "/tools/csv-dedup",
    accent: "#6366f1",
  },
  {
    id: "reports",
    name: "Transaction Reports",
    tagline: "Instant dashboards from your Shopify data.",
    description:
      "Upload a Shopify transaction CSV and get a visual dashboard with sales breakdowns, payment trends, and summary stats. Shareable interactive reports. No data uploaded to any server.",
    features: ["Sales by category", "Payment analysis", "Time trend charts", "Shareable reports"],
    icon: "📊",
    href: "/tools/reports",
    accent: "#10b981",
  },
  {
    id: "scheduler",
    name: "Symphonix Scheduler",
    tagline: "Automated scheduling for music programs.",
    description:
      "Generate sessions from templates, manage instructor availability, handle venue conflicts, and publish schedules with email notifications. Built for educational music program coordinators.",
    features: ["Template scheduling", "Conflict detection", "Email notifications", "Calendar integration"],
    icon: "🎵",
    href: "/tools/scheduler",
    accent: "#a244ae",
  },
];

export default function ToolsPage() {
  return (
    <div
      style={{
        paddingTop: "80px",
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          padding: "3.5rem 1.5rem 3rem",
          textAlign: "center",
          maxWidth: "640px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--color-teal)",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "1.5rem",
          }}
        >
          ← Back to Home
        </Link>
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 800,
            color: "var(--color-navy)",
            marginBottom: "0.75rem",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          Automation Tools
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "1.05rem",
            lineHeight: 1.6,
          }}
        >
          Free, open-source tools built through the Automation Lab for nonprofits and small organizations.
        </p>
      </div>

      {/* Tools Grid */}
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "0 1.5rem 4rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                backgroundColor: "var(--color-card)",
                borderRadius: "16px",
                border: "1px solid var(--color-border)",
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "box-shadow 0.2s, transform 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
              }}
              className="tool-card-hover"
            >
              {/* Accent bar */}
              <div style={{ height: "4px", backgroundColor: tool.accent }} />

              <div
                style={{
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  flex: 1,
                }}
              >
                {/* Icon + Title */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      backgroundColor: `${tool.accent}10`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      flexShrink: 0,
                    }}
                  >
                    {tool.icon}
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "var(--color-navy)",
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {tool.name}
                    </h2>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: tool.accent,
                        fontWeight: 600,
                        marginTop: "2px",
                      }}
                    >
                      {tool.tagline}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    color: "var(--color-text)",
                    fontSize: "0.9rem",
                    lineHeight: 1.65,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {tool.description}
                </p>

                {/* Features */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {tool.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        backgroundColor: "var(--color-bg-alt)",
                        color: "var(--color-text-muted)",
                        borderRadius: "6px",
                        padding: "3px 10px",
                        fontSize: "0.72rem",
                        fontWeight: 500,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: tool.accent,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    marginTop: "0.25rem",
                  }}
                >
                  Open Tool
                  <span style={{ fontSize: "1.1rem" }}>→</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
