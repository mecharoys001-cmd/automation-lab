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
    accent: "#a244ae",
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
    accent: "#21b8bb",
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
    accent: "#1282a2",
  },
];

export default function Roadmap() {
  return (
    <section
      id="roadmap"
      style={{
        padding: "6rem 1.5rem",
        backgroundColor: "#f5f7fa",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div className="tag-teal" style={{ display: "inline-block", marginBottom: "1.25rem" }}>
            2026 Timeline
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
            The Plan
          </h2>
          <p style={{ color: "#6b7a8f", fontSize: "16px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.65 }}>
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
              className="card-light"
              style={{
                padding: 0,
                overflow: "hidden",
                border: phase.status === "active"
                  ? `1px solid ${phase.accent}50`
                  : "1px solid #e0e7ef",
                boxShadow: phase.status === "active"
                  ? `0 4px 24px ${phase.accent}20`
                  : "0 2px 16px rgba(26,26,56,0.06)",
              }}
            >
              {/* Top accent bar */}
              <div
                style={{
                  height: "4px",
                  background: phase.status === "active"
                    ? `linear-gradient(90deg, ${phase.accent}, ${phase.accent}80)`
                    : "#e0e7ef",
                }}
              />

              <div style={{ padding: "2rem" }}>
                {/* Phase number (decorative) */}
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 900,
                    color: `${phase.accent}18`,
                    lineHeight: 1,
                    marginBottom: "0.25rem",
                    fontFamily: "'Montserrat', sans-serif",
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
                        fontWeight: 800,
                        marginBottom: "4px",
                        color: "#1a1a38",
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {phase.title}
                    </div>
                    <div style={{ fontSize: "13px", color: "#9aa3b0" }}>
                      {phase.timeline}
                    </div>
                  </div>
                  <span
                    style={{
                      backgroundColor: `${phase.accent}15`,
                      color: phase.accent,
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                      border: `1px solid ${phase.accent}30`,
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {phase.statusLabel}
                  </span>
                </div>

                {/* Goals */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: phase.accent,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      marginBottom: "0.75rem",
                      fontFamily: "'Montserrat', sans-serif",
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
                          marginBottom: "7px",
                          fontSize: "13px",
                          color: "#5a6a7e",
                          lineHeight: 1.55,
                        }}
                      >
                        <span style={{ color: phase.accent, flexShrink: 0 }}>→</span>
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deliverables */}
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#9aa3b0",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      marginBottom: "0.75rem",
                      fontFamily: "'Montserrat', sans-serif",
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
                          marginBottom: "7px",
                          fontSize: "13px",
                          color: "#8a96a8",
                          lineHeight: 1.55,
                        }}
                      >
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
