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
    accentRaw: "#1282a2",
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
    accentRaw: "#68ccd1",
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
    accentRaw: "#a28231",
  },
];

export default function Roadmap() {
  return (
    <section id="roadmap" className="section section-white">
      <div className="container">
        <div className="section-header" data-reveal="fade">
          <div className="label-overline" style={{ marginBottom: "10px" }}>2026 Timeline</div>
          <h2 className="heading-section">The Plan</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", maxWidth: "480px", margin: "0 auto" }}>
            Three phases from research to replicable infrastructure — all within 2026.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {phases.map((phase, i) => (
            <div
              key={phase.number}
              className="card"
              data-reveal
              data-delay={i * 120}
              style={{
                padding: 0,
                overflow: "hidden",
                border: phase.status === "active"
                  ? `1px solid ${phase.accentRaw}50`
                  : "1px solid var(--border)",
                boxShadow: phase.status === "active"
                  ? `0 2px 16px ${phase.accentRaw}20`
                  : "none",
              }}
            >
              {/* Accent bar */}
              <div
                style={{
                  height: "4px",
                  background: phase.status === "active" ? phase.accentRaw : "var(--border)",
                }}
              />

              <div style={{ padding: "24px" }}>
                {/* Decorative number */}
                <div
                  style={{
                    fontSize: "2.2rem",
                    fontWeight: 900,
                    color: `${phase.accentRaw}18`,
                    lineHeight: 1,
                    marginBottom: "4px",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {phase.number}
                </div>

                {/* Title row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <div className="heading-card" style={{ fontSize: "16px", marginBottom: "3px" }}>{phase.title}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-subtle)" }}>{phase.timeline}</div>
                  </div>
                  <span
                    className="tag"
                    style={{
                      background: `${phase.accentRaw}12`,
                      color: phase.accentRaw,
                      border: `1px solid ${phase.accentRaw}30`,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      marginLeft: "8px",
                    }}
                  >
                    {phase.statusLabel}
                  </span>
                </div>

                {/* Goals */}
                <div style={{ marginBottom: "18px" }}>
                  <div className="label-overline" style={{ color: phase.accentRaw, marginBottom: "10px", fontSize: "10px" }}>
                    Goals
                  </div>
                  <ul className="goal-list">
                    {phase.goals.map((g) => (
                      <li key={g}>
                        <span style={{ color: phase.accentRaw, flexShrink: 0, fontSize: "12px" }}>→</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deliverables */}
                <div>
                  <div className="label-overline" style={{ color: "var(--text-subtle)", marginBottom: "10px", fontSize: "10px" }}>
                    Deliverables
                  </div>
                  <ul className="deliverable-list">
                    {phase.deliverables.map((d) => (
                      <li key={d}>
                        <span style={{ color: "var(--border-mid)", flexShrink: 0, fontSize: "12px" }}>✓</span>
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
