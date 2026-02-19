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
    accent: "#a244ae",
    tagClass: "tag-purple",
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
    accent: "#21b8bb",
    tagClass: "tag-teal",
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
    accent: "#a28231",
    tagClass: "tag-teal",
  },
];

export default function CaseStudies() {
  return (
    <section
      id="case-studies"
      style={{
        padding: "6rem 1.5rem",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div className="tag-purple" style={{ display: "inline-block", marginBottom: "1.25rem" }}>
            Proven Results
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
            Case Studies
          </h2>
          <p style={{ color: "#6b7a8f", fontSize: "16px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.65 }}>
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
              className="card-light"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                overflow: "hidden",
              }}
            >
              {/* Top accent bar */}
              <div style={{ height: "4px", background: c.accent, margin: "-1px -1px 0" }} />

              <div style={{ padding: "1.75rem 2rem 2rem", display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>
                {/* Header */}
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
                        backgroundColor: `${c.accent}18`,
                        color: c.accent,
                        padding: "4px 12px",
                        borderRadius: "100px",
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                        border: `1px solid ${c.accent}30`,
                      }}
                    >
                      {c.year}
                    </span>
                    <span style={{ fontSize: "11px", color: "#9aa3b0", textAlign: "right" }}>
                      {c.timeline}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      marginBottom: "0.5rem",
                      lineHeight: 1.3,
                      color: "#1a1a38",
                    }}
                  >
                    {c.title}
                  </h3>
                  <div style={{ fontSize: "12px", color: "#9aa3b0" }}>
                    Funded by:{" "}
                    <span style={{ color: "#5a6a7e", fontWeight: 500 }}>{c.funder}</span>
                    {c.amount !== "In-Kind" && (
                      <> · <span style={{ color: c.accent, fontWeight: 600 }}>{c.amount}</span></>
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
                        backgroundColor: "#f5f7fa",
                        borderRadius: "10px",
                        padding: "0.85rem 0.75rem",
                        border: "1px solid #e0e7ef",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 900,
                          color: c.accent,
                          fontVariantNumeric: "tabular-nums",
                          fontFamily: "'Montserrat', sans-serif",
                        }}
                      >
                        {r.value}
                      </div>
                      <div style={{ fontSize: "10px", color: "#6b7a8f", marginTop: "3px", fontWeight: 600 }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: "10px", color: "#9aa3b0", marginTop: "1px" }}>
                        {r.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tech Stack */}
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#9aa3b0",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      marginBottom: "8px",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    Tech Stack
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {c.stack.map((tech) => (
                      <span
                        key={tech}
                        style={{
                          backgroundColor: "#f5f7fa",
                          border: "1px solid #e0e7ef",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          fontSize: "11px",
                          color: "#5a6a7e",
                          fontWeight: 500,
                        }}
                      >
                        {tech}
                      </span>
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
