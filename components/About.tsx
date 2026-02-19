const principles = [
  {
    icon: "🔍",
    title: "Research-Driven",
    desc: "Every tool and workflow we build is grounded in real nonprofit needs — identified through sector surveys and direct partnership.",
    accent: "var(--purple)",
    accentRaw: "#a244ae",
  },
  {
    icon: "🤝",
    title: "Human-Centered",
    desc: "Technology should reduce burden, not add complexity. We design with the humans using these tools at the center.",
    accent: "var(--teal)",
    accentRaw: "#21b8bb",
  },
  {
    icon: "📦",
    title: "Reusable Infrastructure",
    desc: "Solutions that work for one organization are documented and packaged so others can adopt them — no reinventing the wheel.",
    accent: "var(--teal-dark)",
    accentRaw: "#1282a2",
  },
];

export default function About() {
  return (
    <section id="about" className="section section-soft">
      <div className="container">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          {/* Text column */}
          <div className="animate-slide-left">
            <div
              className="tag-teal"
              style={{ display: "inline-block", marginBottom: "1.25rem" }}
            >
              About the Project
            </div>
            <h2 className="text-section-heading" style={{ marginBottom: "1.5rem" }}>
              Closing the AI
              <br />
              Access Gap
            </h2>
            <p style={{ color: "#5a6a7e", lineHeight: 1.8, fontSize: "16px", marginBottom: "1.5rem" }}>
              The Automation Lab is a pilot initiative by the NWCT Arts Council
              exploring how responsible, human-centered automation can reduce
              administrative burden and strengthen operational capacity for arts
              &amp; culture nonprofits in Northwest Connecticut.
            </p>
            <p style={{ color: "#5a6a7e", lineHeight: 1.8, fontSize: "16px", marginBottom: "2rem" }}>
              Through discovery, pilot projects, and shared documentation, the
              project identifies practical approaches that free up staff time for
              mission-driven work while building reusable infrastructure for the
              sector.
            </p>
            <a
              href="https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ color: "var(--purple)", borderColor: "rgba(162,68,174,0.3)" }}
            >
              Read our Theory of Change →
            </a>
          </div>

          {/* Principle cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {principles.map((card, i) => (
              <div
                key={card.title}
                className="card-feature animate-fade-up"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div
                  className="icon-box icon-box-md"
                  style={{ backgroundColor: `${card.accentRaw}15` }}
                >
                  {card.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "4px",
                      fontSize: "15px",
                      color: "var(--navy)",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {card.title}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.65 }}>
                    {card.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
