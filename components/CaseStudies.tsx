const cases = [
  {
    year: "2023",
    title: "Arts Council Internal Process Automation",
    funder: "Foundation for Community Health",
    amount: "$10,000",
    timeline: "1 year (400 hours)",
    results: [
      { label: "Labor Saved",  value: "30 hrs/wk",   sub: "1,560 hrs/year" },
      { label: "Cost Offset",  value: "$31,200/yr",  sub: "Annual savings" },
    ],
    stack: ["Zapier","Givebutter","Salesforce","Quickbooks","Gmail","Slack","Mailchimp","Airtable","Duda"],
    accentRaw: "#1282a2",
  },
  {
    year: "2025",
    title: "Print Calendar Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind",
    timeline: "1 week (20 hours)",
    results: [
      { label: "Labor Saved",  value: "20 hrs/mo",   sub: "240 hrs/year" },
      { label: "Cost Offset",  value: "$4,800/yr",   sub: "Annual savings" },
    ],
    stack: ["Google Gemini AI Studio","Custom Python","CivicLift"],
    accentRaw: "#a244ae",
  },
  {
    year: "2025",
    title: "Email Newsletter Automation",
    funder: "Ethan Brewerton",
    amount: "In-Kind",
    timeline: "1 day (4 hours)",
    results: [
      { label: "Labor Saved",  value: "3 hrs/wk",    sub: "~150 hrs/year" },
      { label: "Cost Offset",  value: "$3,000/yr",   sub: "Annual savings" },
    ],
    stack: ["Google Gemini AI Studio","CivicLift","Mailchimp"],
    accentRaw: "#10b981",
  },
];

export default function CaseStudies() {
  return (
    <section id="case-studies" className="section" style={{ background: "var(--color-bg-alt)", padding: "96px 24px" }}>
      <div className="container">
        <div className="section-header" data-reveal="fade">
          <h2 className="heading-section" style={{ fontStyle: "italic" }}>Real Impact, Real Savings</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "1.1rem", maxWidth: "540px", margin: "0 auto" }}>
            Real automation projects with measurable results for the cultural sector.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "32px",
          }}
        >
          {cases.map((c, i) => (
            <div
              key={c.title}
              className="card"
              data-reveal
              data-delay={i * 110}
              style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              <div className="card-accent-top" style={{ background: c.accentRaw }} />

              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <span
                      className="tag"
                      style={{
                        background: `${c.accentRaw}15`,
                        color: c.accentRaw,
                        border: `1px solid ${c.accentRaw}30`,
                      }}
                    >
                      {c.year}
                    </span>
                  </div>
                  <h3 className="heading-card" style={{ fontSize: "1.1rem", marginBottom: "8px", lineHeight: 1.4 }}>
                    {c.title}
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                    Project Cost: <span style={{ color: c.amount === "In-Kind" ? "var(--color-text-muted)" : c.accentRaw, fontWeight: 600 }}>{c.amount === "In-Kind" ? "In-Kind" : c.amount}</span>
                  </div>
                </div>

                {/* Results */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>
                  {c.results.map((r) => (
                    <div key={r.label} className="card-stat">
                      <div style={{ fontSize: "1rem", fontWeight: 900, color: c.accentRaw, fontFamily: "var(--font-body)" }}>
                        {r.value}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "1px" }}>{r.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Stack */}
                <div>
                  <div className="label-overline" style={{ fontSize: "10px", marginBottom: "8px", color: "var(--color-text-muted)" }}>
                    Tech Stack
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {c.stack.map((t) => <span key={t} className="tech-tag">{t}</span>)}
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
