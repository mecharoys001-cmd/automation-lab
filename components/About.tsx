const principles = [
  {
    icon: "🔍",
    title: "Research-Driven",
    desc: "Every tool we build is grounded in real nonprofit needs, identified through sector surveys and direct partnership.",
  },
  {
    icon: "🤝",
    title: "Human-Centered",
    desc: "Technology should reduce burden, not add complexity. We design with the humans using these tools at the center.",
  },
  {
    icon: "📦",
    title: "Reusable Infrastructure",
    desc: "Solutions that work for one organization are documented and packaged so others can adopt them.",
  },
];

export default function About() {
  return (
    <section id="about" className="section" style={{ background: "var(--color-bg)", padding: "96px 24px" }}>
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "64px",
            alignItems: "center",
          }}
        >
          {/* Text */}
          <div data-reveal="slide-left">
            <h2
              className="heading-section"
              style={{ marginBottom: "24px", color: "var(--color-navy)" }}
            >
              Built on Principles
            </h2>
            <p style={{ color: "var(--color-text)", lineHeight: 1.8, fontSize: "1.1rem", marginBottom: "16px" }}>
              The Automation Lab is a pilot initiative by the NWCT Arts Council
              exploring how responsible, human-centered automation can reduce
              administrative burden and strengthen operational capacity for arts
              &amp; culture nonprofits in Northwest Connecticut.
            </p>
            <p style={{ color: "var(--color-text)", lineHeight: 1.8, fontSize: "1.1rem", marginBottom: "32px" }}>
              We believe automation should empower people, not replace them. Our
              lab operates under a strict ethical framework.
            </p>
            <a
              href="https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--color-teal)",
                fontWeight: 700,
                fontSize: "15px",
                fontFamily: "var(--font-body)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                borderBottom: "2px solid color-mix(in srgb, var(--color-teal) 30%, transparent)",
                paddingBottom: "2px",
                textDecoration: "none",
              }}
            >
              Read our Theory of Change →
            </a>
          </div>

          {/* Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                    width: "48px", height: "48px",
                    background: "var(--color-teal-light)",
                    border: "1px solid color-mix(in srgb, var(--color-teal) 25%, transparent)",
                    fontSize: "22px",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div className="heading-card" style={{ marginBottom: "6px" }}>{card.title}</div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "14px", lineHeight: 1.7 }}>{card.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
