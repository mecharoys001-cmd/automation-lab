const phases = [
  {
    number: "01",
    title: "Research & Discovery",
    timeline: "Jan – Mar 2026",
    status: "active" as const,
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
    accentRaw: "#a244ae",
  },
  {
    number: "02",
    title: "Pilot Projects",
    timeline: "Mar – Oct 2026",
    status: "upcoming" as const,
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
    accentRaw: "#21b8bb",
  },
  {
    number: "03",
    title: "Systematization",
    timeline: "Oct – Dec 2026",
    status: "future" as const,
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
    accentRaw: "#1282a2",
  },
];

export default function Roadmap() {
  return (
    <section id="roadmap" className="section section-soft">
      <div className="container">
        {/* Header */}
        <div className="section-header" data-reveal="fade">
          <div
            className="tag-teal"
            style={{ display: "inline-block", marginBottom: "1.25rem" }}
          >
            2026 Timeline
          </div>
          <h2 className="section-heading-decorated">The Plan</h2>
          <p className="text-section-sub">
            Three phases from research to replicable infrastructure — all
            completed within 2026.
          </p>
        </div>

        {/* Phase cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {phases.map((phase, i) => (
            <div
              key={phase.number}
              className="card-light"
              data-reveal
              data-delay={i * 130}
              style={{
                padding: 0,
                overflow: "hidden",
                border: phase.status === "active"
                  ? `1px solid ${phase.accentRaw}50`
                  : "1px solid var(--border-light)",
                boxShadow: phase.status === "active"
                  ? `0 4px 24px ${phase.accentRaw}20`
                  : "var(--shadow-card)",
              }}
            >
              {/* Accent bar */}
              <div
                style={{
                  height: "4px",
                  background: phase.status === "active"
                    ? `linear-gradient(90deg, ${phase.accentRaw}, ${phase.accentRaw}80)`
                    : "var(--border-light)",
                }}
              />

              <div style={{ padding: "2rem" }}>
                {/* Decorative number */}
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 900,
                    color: `${phase.accentRaw}18`,
                    lineHeight: 1,
                    marginBottom: "0.25rem",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {phase.number}
                </div>

                {/* Title row */}
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
                        fontWeight: 800,
                        marginBottom: "4px",
                        color: "var(--navy)",
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {phase.title}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-subtle)" }}>
                      {phase.timeline}
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: `${phase.accentRaw}15`,
                      color: phase.accentRaw,
                      padding: "4px 10px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap" as const,
                      border: `1px solid ${phase.accentRaw}30`,
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {phase.statusLabel}
                  </span>
                </div>

                {/* Goals */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    className="text-label"
                    style={{ color: phase.accentRaw, marginBottom: "0.75rem", fontSize: "10px" }}
                  >
                    Goals
                  </div>
                  <ul className="goal-list">
                    {phase.goals.map((goal) => (
                      <li key={goal}>
                        <span style={{ color: phase.accentRaw, flexShrink: 0 }}>→</span>
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deliverables */}
                <div>
                  <div
                    className="text-label"
                    style={{ color: "var(--text-subtle)", marginBottom: "0.75rem", fontSize: "10px" }}
                  >
                    Deliverables
                  </div>
                  <ul className="deliverable-list">
                    {phase.deliverables.map((d) => (
                      <li key={d}>
                        <span style={{ color: "#c5cdd8", flexShrink: 0 }}>✓</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
