import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid #1e293b",
        padding: "3rem 1.5rem",
        backgroundColor: "#0a0e1a",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "2rem",
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  background: "linear-gradient(135deg, #10b981, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                }}
              >
                ⚡
              </div>
              <span style={{ fontWeight: 700, fontSize: "15px" }}>
                Automation Lab
              </span>
            </div>
            <p
              style={{
                color: "#475569",
                fontSize: "13px",
                lineHeight: 1.6,
                maxWidth: "280px",
              }}
            >
              A pilot initiative by the NWCT Arts Council exploring
              human-centered automation for the cultural sector.
            </p>
          </div>

          {/* Links */}
          <div
            style={{
              display: "flex",
              gap: "3rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Site
              </div>
              {[
                { href: "/#about", label: "About" },
                { href: "/#case-studies", label: "Case Studies" },
                { href: "/#roadmap", label: "Roadmap" },
                { href: "/#team", label: "Team" },
              ].map((link) => (
                <div key={link.href} style={{ marginBottom: "6px" }}>
                  <Link
                    href={link.href}
                    style={{
                      color: "#64748b",
                      textDecoration: "none",
                      fontSize: "13px",
                    }}
                  >
                    {link.label}
                  </Link>
                </div>
              ))}
            </div>

            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Tools
              </div>
              <div style={{ marginBottom: "6px" }}>
                <Link
                  href="/tools"
                  style={{
                    color: "#64748b",
                    textDecoration: "none",
                    fontSize: "13px",
                  }}
                >
                  All Tools
                </Link>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <Link
                  href="/tools/camp-scheduler"
                  style={{
                    color: "#64748b",
                    textDecoration: "none",
                    fontSize: "13px",
                  }}
                >
                  Camp Scheduler
                </Link>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Resources
              </div>
              <div style={{ marginBottom: "6px" }}>
                <a
                  href="https://www.artsnwct.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#64748b",
                    textDecoration: "none",
                    fontSize: "13px",
                  }}
                >
                  NWCT Arts Council
                </a>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <a
                  href="https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#64748b",
                    textDecoration: "none",
                    fontSize: "13px",
                  }}
                >
                  Theory of Change
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            borderTop: "1px solid #1e293b",
            paddingTop: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <span style={{ fontSize: "12px", color: "#475569" }}>
            © 2026 NWCT Arts Council · Automation Lab
          </span>
          <span style={{ fontSize: "12px", color: "#475569" }}>
            Built by{" "}
            <a
              href="https://www.ethansbrewerton.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#10b981", textDecoration: "none" }}
            >
              Ethan S. Brewerton
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
