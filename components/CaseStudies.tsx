const cases = [
  {
    year: "2023",
    title: "Arts Council Internal Process Automation",
    funder: "Foundation for Community Health",
    amount: "$10,000",
    timeline: "1 year (400 hours)",
    results: [
      { label: "Labor Saved", value: "30 hrs/wk", sub: "1,560 hrs/year" },
      { label: "Cost Offset", value: "$31,200/yr", sub: "Annual savings" },
      { label: "Dev ROI", value: "$78/hr", sub: "Return on time" },
    ],
    stack: ["Zapier", "Givebutter", "Salesforce", "Quickbooks", "Gmail", "Slack", "Mailchimp", "Airtable", "Duda"],
    accentRaw: "#a244ae",
  },
  {
    year: "2025",
    title: "Print Calendar Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind",
    timeline: "1 week (20 hours)",
    results: [
      { label: "Labor Saved", value: "20 hrs/mo", sub: "240 hrs/year" },
      { label: "Cost Offset", value: "$4,800/yr", sub: "Annual savings" },
      { label: "Dev ROI", value: "$240/hr", sub: "Return on time" },
    ],
    stack: ["Google Gemini AI Studio", "Custom Python", "CivicLift"],
    accentRaw: "#21b8bb",
  },
  {
    year: "2025",
    title: "Email Newsletter Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind",
    timeline: "1 day (4 hours)",
    results: [
      { label: "Labor Saved", value: "3 hrs/wk", sub: "~150 hrs/year" },
      { label: "Cost Offset", value: "$3,000/yr", sub: "Annual savings" },
      { label: "Dev ROI", value: "$750/hr", sub: "Return on time" },
    ],
    stack: ["Google Gemini AI Studio", "CivicLift", "Mailchimp"],
    accentRaw: "#a28231",
  },
];

export default function CaseStudies() {
  return (
    <section id="case-studies" className="section section-light">
      <div className="container">
        {/* Header */}
        <div className="section-header" data-reveal="fade">
          <div
            className="tag-purple"
            style={{ display: "inline-block", marginBottom: "1.25rem" }}
          >
            Proven Results
          </div>
          <h2 className="section-heading-decorated">Case Studies</h2>
          <p className="text-section-sub">
            Real automation projects with measurable results for the cultural sector.
          </p>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {cases.map((c, i) => (
            <div
              key={c.title}
              className="card-light"
              data-reveal
              data-delay={i * 120}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Accent bar */}
              <div
                className="card-accent-bar"
                style={{ background: c.accentRaw }}
              />

              <div
                style={{
                  padding: "1.75rem 2rem 2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                  flex: 1,
                }}
              >
                {/* Card header */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: `${c.accentRaw}18`,
                        color: c.accentRaw,
                        padding: "4px 12px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                        border: `1px solid ${c.accentRaw}30`,
                      }}
                    >
                      {c.year}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-subtle)", textAlign: "right" }}>
                      {c.timeline}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      marginBottom: "0.5rem",
                      lineHeight: 1.3,
                      color: "var(--navy)",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {c.title}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
                    Funded by:{" "}
                    <span style={{ color: "#5a6a7e", fontWeight: 500 }}>{c.funder}</span>
                    {c.amount !== "In-Kind" && (
                      <> · <span style={{ color: c.accentRaw, fontWeight: 600 }}>{c.amount}</span></>
                    )}
                  </div>
                </div>

                {/* Result stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0.75rem",
                  }}
                >
                  {c.results.map((r) => (
                    <div key={r.label} className="card-stat">
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 900,
                          color: c.accentRaw,
                          fontVariantNumeric: "tabular-nums",
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        {r.value}
                      </div>
                      <div className="text-label" style={{ color: "var(--text-muted)", marginTop: "3px", fontSize: "10px" }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-subtle)", marginTop: "1px" }}>
                        {r.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tech stack */}
                <div>
                  <div
                    className="text-label"
                    style={{ color: "var(--text-subtle)", marginBottom: "8px", fontSize: "10px" }}
                  >
                    Tech Stack
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {c.stack.map((tech) => (
                      <span key={tech} className="tech-tag">{tech}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
