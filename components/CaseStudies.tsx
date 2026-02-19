const cases = [
  {
    year: "2023",
    title: "Arts Council Internal Process Automation",
    funder: "Foundation for Community Health",
    amount: "$10,000",
    timeline: "1 year (400 hours)",
    results: [
      { label: "Labor Saved", value: "30 hrs/week", sub: "1,560 hrs/year" },
      { label: "Cost Offset", value: "$31,200/yr", sub: "Annual savings" },
      { label: "Dev ROI", value: "$78/hr", sub: "Return on dev time" },
    ],
    stack: ["Zapier", "Givebutter", "Salesforce", "Quickbooks", "Gmail", "Slack", "Mailchimp", "Airtable", "Duda"],
    color: "#10b981",
  },
  {
    year: "2025",
    title: "Print Calendar Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind Development",
    timeline: "1 week (20 hours)",
    results: [
      { label: "Labor Saved", value: "20 hrs/mo", sub: "240 hrs/year" },
      { label: "Cost Offset", value: "$4,800/yr", sub: "Annual savings" },
      { label: "Dev ROI", value: "$240/hr", sub: "Return on dev time" },
    ],
    stack: ["Google Gemini AI Studio", "Custom Python", "CivicLift"],
    color: "#3b82f6",
  },
  {
    year: "2025",
    title: "Email Newsletter Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind Development",
    timeline: "1 day (4 hours)",
    results: [
      { label: "Labor Saved", value: "3 hrs/week", sub: "~150 hrs/year" },
      { label: "Cost Offset", value: "$3,000/yr", sub: "Annual savings" },
      { label: "Dev ROI", value: "$750/hr", sub: "Return on dev time" },
    ],
    stack: ["Google Gemini AI Studio", "CivicLift", "Mailchimp"],
    color: "#f59e0b",
  },
];

export default function CaseStudies() {
  return (
    <section
      id="case-studies"
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
            Proven Results
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            Case Studies
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
            Real automation projects with measurable results for the cultural sector.
          </p>
        </div>

        {/* Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {cases.map((c) => (
            <div
              key={c.title}
              className="card-glow"
              style={{
                backgroundColor: "#111827",
                borderRadius: "16px",
                padding: "2rem",
                border: "1px solid #1e293b",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {/* Top */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "1rem",
                  }}
                >
                  <span
                    style={{
                      backgroundColor: `${c.color}20`,
                      color: c.color,
                      padding: "4px 12px",
                      borderRadius: "100px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {c.year}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      textAlign: "right",
                    }}
                  >
                    {c.timeline}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    marginBottom: "0.5rem",
                    lineHeight: 1.3,
                  }}
                >
                  {c.title}
                </h3>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Funded by: <span style={{ color: "#94a3b8" }}>{c.funder}</span>
                  {c.amount !== "In-Kind Development" && (
                    <> · <span style={{ color: c.color }}>{c.amount}</span></>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.75rem",
                }}
              >
                {c.results.map((r) => (
                  <div
                    key={r.label}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.03)",
                      borderRadius: "10px",
                      padding: "0.75rem",
                      border: "1px solid #1e293b",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: c.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.value}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
                      {r.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tech Stack */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  Tech Stack
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {c.stack.map((tech) => (
                    <span
                      key={tech}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        border: "1px solid #1e293b",
                        borderRadius: "6px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        color: "#94a3b8",
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
