export default function About() {
  return (
    <section id="about" style={{ padding: "6rem 1.5rem", backgroundColor: "#f5f7fa" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
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
            <div className="tag-teal" style={{ display: "inline-block", marginBottom: "1.25rem" }}>
              About the Project
            </div>
            <h2
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: 800,
                marginBottom: "1.5rem",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                color: "#1a1a38",
              }}
            >
              Closing the AI
              <br />
              Access Gap
            </h2>
            <p
              style={{
                color: "#5a6a7e",
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
                color: "#5a6a7e",
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
                color: "#a244ae",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                borderBottom: "2px solid rgba(162, 68, 174, 0.25)",
                paddingBottom: "2px",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Read our Theory of Change →
            </a>
          </div>

          {/* Principle cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                icon: "🔍",
                title: "Research-Driven",
                desc: "Every tool and workflow we build is grounded in real nonprofit needs — identified through sector surveys and direct partnership.",
                accent: "#a244ae",
              },
              {
                icon: "🤝",
                title: "Human-Centered",
                desc: "Technology should reduce burden, not add complexity. We design with the humans using these tools at the center.",
                accent: "#21b8bb",
              },
              {
                icon: "📦",
                title: "Reusable Infrastructure",
                desc: "Solutions that work for one organization are documented and packaged so others can adopt them — no reinventing the wheel.",
                accent: "#1282a2",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="card-light"
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  gap: "1rem",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    fontSize: "22px",
                    width: "42px",
                    height: "42px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${card.accent}15`,
                    borderRadius: "10px",
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
                      color: "#1a1a38",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    style={{
                      color: "#6b7a8f",
                      fontSize: "13px",
                      lineHeight: 1.65,
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
