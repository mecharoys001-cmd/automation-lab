const phases = [
  {
    number: 1,
    title: "Research & Discovery",
    timeline: "Jan \u2013 Mar 2026",
    status: "underway",
    goals: [
      "Understand how nonprofits are currently handling administrative work and AI use",
      "Identify common pain points and readiness levels across organizations",
      "Determine which processes are realistic candidates for automation",
    ],
    deliverables: [
      "Sector-wide survey results and analysis",
      "Summary of shared operational challenges and opportunities",
      "Clear criteria for pilot project selection",
      "Shortlist of high-potential automation use cases",
    ],
  },
  {
    number: 2,
    title: "Pilot Projects",
    timeline: "Mar \u2013 Oct 2026",
    status: "upcoming",
    goals: [
      "Test automation approaches in real nonprofit environments",
      "Reduce administrative burden without adding complexity or risk",
      "Learn what works, what doesn\u2019t, and why",
    ],
    deliverables: [
      "Implemented pilot automation workflows",
      "Documentation of decisions, constraints, and adjustments",
      "Observations on staff experience, sustainability, and maintenance needs",
      "Measured time and labor savings where applicable",
    ],
  },
  {
    number: 3,
    title: "Systematization",
    timeline: "Oct \u2013 Dec 2026",
    status: "planned",
    goals: [
      "Translate pilot learning into repeatable, maintainable approaches",
      "Identify which solutions can be adapted by other organizations",
      "Support smarter future investment in shared infrastructure",
    ],
    deliverables: [
      "Reusable frameworks, templates, and documentation",
      "Clear guidance on when automation is and is not appropriate",
      "Public case study and implementation framework",
      "Prioritized recommendations for next-phase funding or expansion",
    ],
  },
];

export default function Roadmap() {
  return (
    <section
      id="roadmap"
      style={{
        background: "var(--color-bg-alt)",
        padding: "96px 24px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Current Phase callout */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#ffffff",
              background: "var(--color-teal)",
              padding: "6px 18px",
              borderRadius: "var(--radius-pill)",
              marginBottom: "16px",
            }}
          >
            Current Phase
          </span>

          <h2
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "16px",
            }}
          >
            Research
          </h2>

          <h3
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "1.2rem",
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: "16px",
            }}
          >
            Call for Nonprofit Participation
          </h3>

          <p
            style={{
              fontSize: "1.05rem",
              lineHeight: 1.8,
              color: "var(--color-text-muted)",
              maxWidth: "640px",
              margin: "0 auto 28px",
            }}
          >
            The initiative is currently seeking feedback from arts &amp; culture
            nonprofit organizations in Northwest Connecticut to help identify
            common pain points and opportunities for sector-wide capacity building.
          </p>

          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "14px 36px",
              background: "var(--color-teal)",
              color: "#ffffff",
              fontFamily: "var(--font-headline)",
              fontWeight: 700,
              fontSize: "1rem",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
            }}
          >
            Take the Survey
          </a>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "60px",
            height: "3px",
            background: "var(--color-border)",
            margin: "0 auto 56px",
          }}
        />

        {/* The Plan heading */}
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "clamp(1.6rem, 3.5vw, 2rem)",
            fontWeight: 700,
            color: "var(--color-text)",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          The Plan
        </h2>

        {/* Phase cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
          }}
        >
          {phases.map((phase) => {
            const isActive = phase.status === "underway";
            return (
              <div
                key={phase.number}
                style={{
                  background: "var(--color-card)",
                  borderRadius: "var(--radius-lg)",
                  border: isActive
                    ? "2px solid var(--color-teal)"
                    : "1px solid var(--color-border)",
                  boxShadow: isActive ? "var(--shadow-md)" : "var(--shadow-sm)",
                  overflow: "hidden",
                }}
              >
                {/* Accent bar */}
                <div
                  style={{
                    height: "4px",
                    background: isActive ? "var(--color-teal)" : "var(--color-border)",
                  }}
                />

                <div style={{ padding: "28px" }}>
                  {/* Phase header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "8px",
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: "var(--font-headline)",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      Phase {phase.number}: {phase.title}
                    </h3>
                    {isActive && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--color-teal)",
                          background: "var(--color-teal-light)",
                          padding: "3px 10px",
                          borderRadius: "var(--radius-pill)",
                          whiteSpace: "nowrap",
                          marginLeft: "8px",
                        }}
                      >
                        {phase.status}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--color-text-muted)",
                      marginBottom: "20px",
                    }}
                  >
                    {phase.timeline}
                  </p>

                  {/* Goals */}
                  <div style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--color-teal)",
                        marginBottom: "10px",
                      }}
                    >
                      Goals
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {phase.goals.map((g) => (
                        <li
                          key={g}
                          style={{
                            fontSize: "0.875rem",
                            color: "var(--color-text-muted)",
                            lineHeight: 1.6,
                            paddingLeft: "16px",
                            position: "relative",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              left: 0,
                              color: "var(--color-teal)",
                            }}
                          >
                            &rarr;
                          </span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--color-text-muted)",
                        marginBottom: "10px",
                      }}
                    >
                      Deliverables
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {phase.deliverables.map((d) => (
                        <li
                          key={d}
                          style={{
                            fontSize: "0.875rem",
                            color: "var(--color-text-muted)",
                            lineHeight: 1.6,
                            paddingLeft: "16px",
                            position: "relative",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              left: 0,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            &#10003;
                          </span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
