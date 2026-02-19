const phases = [
  {
    number: "01",
    title: "Research & Discovery",
    timeline: "Jan – Mar 2026",
    status: "active",
    statusLabel: "Underway",
    goals: [
      "Understand how nonprofits handle administrative work and AI use",
      "Identify common pain points and readiness levels",
      "Determine realistic candidates for automation",
    ],
    deliverables: [
      "Sector-wide survey results and analysis",
      "Summary of shared operational challenges",
      "Clear criteria for pilot project selection",
      "Shortlist of high-potential automation use cases",
    ],
    color: "#10b981",
  },
  {
    number: "02",
    title: "Pilot Projects",
    timeline: "Mar – Oct 2026",
    status: "upcoming",
    statusLabel: "Up Next",
    goals: [
      "Test automation approaches in real nonprofit environments",
      "Reduce administrative burden without adding complexity",
      "Learn what works, what doesn't, and why",
    ],
    deliverables: [
      "Implemented pilot automation workflows",
      "Documentation of decisions and constraints",
      "Observations on staff experience and sustainability",
      "Measured time and labor savings",
    ],
    color: "#3b82f6",
  },
  {
    number: "03",
    title: "Systematization",
    timeline: "Oct – Dec 2026",
    status: "future",
    statusLabel: "Planned",
    goals: [
      "Translate pilot learning into repeatable approaches",
      "Identify solutions adaptable by other organizations",
      "Support smarter future investment in shared infrastructure",
    ],
    deliverables: [
      "Reusable frameworks, templates, and documentation",
      "Guidance on when automation is/isn't appropriate",
      "Public case study and implementation framework",
      "Prioritized recommendations for next-phase funding",
    ],
    color: "#f59e0b",
  },
];

export default function Roadmap() {
  return (
    <section
      id="roadmap"
      style={{
        padding: "6rem 1.5rem",
        backgroundColor: "rgba(17, 24, 39, 0.3)",
      }}
    >
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
            2026 Timeline
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            The Plan
          </h2>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "16px",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            Three phases from research to replicable infrastructure — all
            completed within 2026.
          </p>
        </div>

        {/* Phases */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {phases.map((phase) => (
            <div
              key={phase.number}
              className="card-glow"
              style={{
                backgroundColor: "#111827",
                borderRadius: "16px",
                padding: "2rem",
                border: `1px solid ${
                  phase.status === "active"
                    ? `${phase.color}40`
                    : "#1e293b"
                }`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Active indicator */}
              {phase.status === "active" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: `linear-gradient(90deg, ${phase.color}, transparent)`,
                  }}
                />
              )}

              {/* Phase number */}
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: 900,
                  color: `${phase.color}20`,
                  lineHeight: 1,
                  marginBottom: "0.5rem",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {phase.number}
              </div>

              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      marginBottom: "4px",
                    }}
                  >
                    {phase.title}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    {phase.timeline}
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: `${phase.color}20`,
                    color: phase.color,
                    padding: "4px 10px",
                    borderRadius: "100px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {phase.statusLabel}
                </span>
              </div>

              {/* Goals */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: phase.color,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.75rem",
                  }}
                >
                  Goals
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {phase.goals.map((goal) => (
                    <li
                      key={goal}
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "6px",
                        fontSize: "13px",
                        color: "#94a3b8",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: phase.color, flexShrink: 0 }}>
                        →
                      </span>
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deliverables */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.75rem",
                  }}
                >
                  Deliverables
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {phase.deliverables.map((d) => (
                    <li
                      key={d}
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "6px",
                        fontSize: "13px",
                        color: "#64748b",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: "#475569", flexShrink: 0 }}>
                        ✓
                      </span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
