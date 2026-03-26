const cases = [
  {
    year: "2023",
    title: "Arts Council \u2013 Internal Process Automation",
    funder: "Foundation for Community Health",
    amount: "$10,000",
    timeline: "1 year (400 hours)",
    results: [
      { label: "Labor Savings", value: "30 hours/week", sub: "1,560 hours/year" },
      { label: "Cost Offset", value: "$31,200/year" },
      { label: "Dev Time ROI", value: "$78/hour*" },
    ],
    stack: ["Zapier", "Givebutter", "Salesforce", "Quickbooks", "Gmail", "Slack", "Mailchimp", "Airtable", "Duda"],
  },
  {
    year: "2025",
    title: "Arts Council \u2013 Print Calendar Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind Development Time",
    timeline: "1 week (20 hours)",
    results: [
      { label: "Labor Savings", value: "20 hours/month", sub: "240 hours/year" },
      { label: "Cost Offset", value: "$4,800/year" },
      { label: "Dev Time ROI", value: "$240/hour*" },
    ],
    stack: ["Google Gemini 3\u2013 AI Studio", "Custom Python Application", "CivicLift"],
  },
  {
    year: "2025",
    title: "Arts Council \u2013 Email Newsletter Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind Development Time",
    timeline: "1 day (4 hours)",
    results: [
      { label: "Labor Savings", value: "3 hours/week", sub: "~150 hours/year" },
      { label: "Cost Offset", value: "$3,000/year" },
      { label: "Dev Time ROI", value: "$750/hour*" },
    ],
    stack: ["Google Gemini 3\u2013 AI Studio", "CivicLift", "Mailchimp"],
  },
];

export default function CaseStudies() {
  return (
    <section
      id="case-studies"
      style={{
        background: "var(--color-bg-alt)",
        padding: "96px 24px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--color-teal)",
              marginBottom: "12px",
            }}
          >
            Timeline: 2023 &ndash; 2025
          </p>
          <h2
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            Case Studies
          </h2>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "28px",
          }}
        >
          {cases.map((c) => (
            <div
              key={c.title}
              style={{
                background: "var(--color-card)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-sm)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Accent bar */}
              <div style={{ height: "4px", background: "var(--color-teal)" }} />

              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
                {/* Year + Title */}
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-teal)",
                      background: "var(--color-teal-light)",
                      padding: "4px 12px",
                      borderRadius: "var(--radius-pill)",
                      marginBottom: "12px",
                    }}
                  >
                    {c.year}
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--color-text)",
                      lineHeight: 1.4,
                    }}
                  >
                    {c.title}
                  </h3>
                </div>

                {/* Meta */}
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.8 }}>
                  <div><strong>Funded by:</strong> {c.funder}</div>
                  <div><strong>Funding Amount:</strong> {c.amount}</div>
                  <div><strong>Project Timeline:</strong> {c.timeline}</div>
                </div>

                {/* Results */}
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
                    Results
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {c.results.map((r) => (
                      <div
                        key={r.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          fontSize: "0.875rem",
                        }}
                      >
                        <span style={{ color: "var(--color-text-muted)" }}>{r.label}</span>
                        <span style={{ fontWeight: 700, color: "var(--color-teal)" }}>
                          {r.value}
                          {r.sub && (
                            <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "0.8rem", marginLeft: "4px" }}>
                              ({r.sub})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tech Stack */}
                <div style={{ marginTop: "auto" }}>
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
                    Tech Stack
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {c.stack.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: "0.75rem",
                          padding: "3px 10px",
                          borderRadius: "var(--radius-pill)",
                          background: "var(--color-bg-alt)",
                          color: "var(--color-text-muted)",
                          border: "1px solid var(--color-border)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {t}
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
