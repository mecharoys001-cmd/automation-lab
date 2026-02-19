export default function About() {
  return (
    <section id="about" style={{ padding: "6rem 1.5rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          {/* Text */}
          <div>
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
              About the Project
            </div>
            <h2
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: 800,
                marginBottom: "1.5rem",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Closing the AI
              <br />
              Access Gap
            </h2>
            <p
              style={{
                color: "#94a3b8",
                lineHeight: 1.8,
                fontSize: "16px",
                marginBottom: "1.5rem",
              }}
            >
              The Automation Lab is a pilot initiative by the NWCT Arts Council
              exploring how responsible, human-centered automation can reduce
              administrative burden and strengthen operational capacity for arts
              & culture nonprofits in Northwest Connecticut.
            </p>
            <p
              style={{
                color: "#94a3b8",
                lineHeight: 1.8,
                fontSize: "16px",
                marginBottom: "2rem",
              }}
            >
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
                color: "#10b981",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                borderBottom: "1px solid rgba(16, 185, 129, 0.3)",
                paddingBottom: "2px",
              }}
            >
              Read our Theory of Change →
            </a>
          </div>

          {/* Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                icon: "🔍",
                title: "Research-Driven",
                desc: "Every tool and workflow we build is grounded in real nonprofit needs — identified through sector surveys and direct partnership.",
              },
              {
                icon: "🤝",
                title: "Human-Centered",
                desc: "Technology should reduce burden, not add complexity. We design with the humans using these tools at the center.",
              },
              {
                icon: "📦",
                title: "Reusable Infrastructure",
                desc: "Solutions that work for one organization are documented and packaged so others can adopt them — no reinventing the wheel.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="card-glow"
                style={{
                  backgroundColor: "#111827",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  display: "flex",
                  gap: "1rem",
                  alignItems: "flex-start",
                  border: "1px solid #1e293b",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    width: "40px",
                    height: "40px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    borderRadius: "8px",
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "4px",
                      fontSize: "15px",
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "13px",
                      lineHeight: 1.6,
                    }}
                  >
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
