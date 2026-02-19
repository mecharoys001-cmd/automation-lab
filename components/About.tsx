const principles = [
  {
    icon: "🔍",
    title: "Research-Driven",
    desc: "Every tool we build is grounded in real nonprofit needs — identified through sector surveys and direct partnership.",
    accentRaw: "#68ccd1",
  },
  {
    icon: "🤝",
    title: "Human-Centered",
    desc: "Technology should reduce burden, not add complexity. We design with the humans using these tools at the center.",
    accentRaw: "#1282a2",
  },
  {
    icon: "📦",
    title: "Reusable Infrastructure",
    desc: "Solutions that work for one organization are documented and packaged so others can adopt them.",
    accentRaw: "#a28231",
  },
];

export default function About() {
  return (
    <section id="about" className="section section-white">
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "56px",
            alignItems: "center",
          }}
        >
          {/* Text */}
          <div data-reveal="slide-left">
            <div
              className="label-overline"
              style={{ marginBottom: "14px", display: "block" }}
            >
              About the Project
            </div>
            <h2
              className="heading-section"
              style={{ marginBottom: "20px", color: "var(--navy)" }}
            >
              Closing the AI Access Gap
            </h2>
            <p style={{ color: "var(--text-body)", lineHeight: 1.8, fontSize: "15px", marginBottom: "16px" }}>
              The Automation Lab is a pilot initiative by the NWCT Arts Council
              exploring how responsible, human-centered automation can reduce
              administrative burden and strengthen operational capacity for arts
              &amp; culture nonprofits in Northwest Connecticut.
            </p>
            <p style={{ color: "var(--text-body)", lineHeight: 1.8, fontSize: "15px", marginBottom: "28px" }}>
              Through discovery, pilot projects, and shared documentation, the
              project identifies practical approaches that free up staff time for
              mission-driven work while building reusable infrastructure for the
              sector.
            </p>
            <a
              href="https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--teal-dark)",
                fontWeight: 700,
                fontSize: "14px",
                fontFamily: "'Montserrat', sans-serif",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                borderBottom: "2px solid rgba(18,130,162,0.3)",
                paddingBottom: "2px",
                textDecoration: "none",
              }}
            >
              Read our Theory of Change →
            </a>
          </div>

          {/* Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {principles.map((card, i) => (
              <div
                key={card.title}
                className="card-feature"
                data-reveal
                data-delay={i * 110}
              >
                <div
                  className="icon-box"
                  style={{
                    width: "42px", height: "42px",
                    background: `${card.accentRaw}18`,
                    border: `1px solid ${card.accentRaw}30`,
                    fontSize: "20px",
                    borderRadius: "var(--radius-md)",
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div className="heading-card" style={{ marginBottom: "5px" }}>{card.title}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.65 }}>{card.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
