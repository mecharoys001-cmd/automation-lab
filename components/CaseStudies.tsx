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
      { label: "Dev ROI",      value: "$78/hr",       sub: "Return on time" },
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
      { label: "Dev ROI",      value: "$240/hr",      sub: "Return on time" },
    ],
    stack: ["Google Gemini AI Studio","Custom Python","CivicLift"],
    accentRaw: "#68ccd1",
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
      { label: "Dev ROI",      value: "$750/hr",      sub: "Return on time" },
    ],
    stack: ["Google Gemini AI Studio","CivicLift","Mailchimp"],
    accentRaw: "#a28231",
  },
];

export default function CaseStudies() {
  return (
    <section id="case-studies" className="section section-light">
      <div className="container">
        <div className="section-header" data-reveal="fade">
          <div className="label-overline" style={{ marginBottom: "10px" }}>Proven Results</div>
          <h2 className="heading-section">Case Studies</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", maxWidth: "480px", margin: "0 auto" }}>
            Real automation projects with measurable results for the cultural sector.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
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

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", flex: 1 }}>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
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
                    <span style={{ fontSize: "11px", color: "var(--text-subtle)" }}>{c.timeline}</span>
                  </div>
                  <h3 className="heading-card" style={{ fontSize: "15px", marginBottom: "6px", lineHeight: 1.4 }}>
                    {c.title}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
                    Funded by: <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{c.funder}</span>
                    {c.amount !== "In-Kind" && <> · <span style={{ color: c.accentRaw, fontWeight: 600 }}>{c.amount}</span></>}
                  </div>
                </div>

                {/* Results */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
                  {c.results.map((r) => (
                    <div key={r.label} className="card-stat">
                      <div style={{ fontSize: "14px", fontWeight: 900, color: c.accentRaw, fontFamily: "'Montserrat', sans-serif" }}>
                        {r.value}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-subtle)", marginTop: "1px" }}>{r.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Stack */}
                <div>
                  <div className="label-overline" style={{ fontSize: "10px", marginBottom: "8px", color: "var(--text-subtle)" }}>
                    Tech Stack
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
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
