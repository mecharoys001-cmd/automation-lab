import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        background: "linear-gradient(135deg, #1a1a38 0%, #270339 60%, #1a2e38 100%)",
        padding: "4rem 1.5rem 2rem",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
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
                gap: "12px",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "9px",
                  background: "linear-gradient(90deg, #a244ae, #21b8bb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  flexShrink: 0,
                }}
              >
                ⚡
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "15px",
                    color: "#ffffff",
                    fontFamily: "'Montserrat', sans-serif",
                    lineHeight: 1.15,
                  }}
                >
                  Automation Lab
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#68ccd1",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  NWCT Arts Council
                </div>
              </div>
            </div>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "13px",
                lineHeight: 1.7,
                maxWidth: "280px",
              }}
            >
              A pilot initiative exploring human-centered automation
              for the cultural sector in Northwest Connecticut.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.35)",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                  fontFamily: "'Montserrat', sans-serif",
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
                <div key={link.href} style={{ marginBottom: "8px" }}>
                  <Link
                    href={link.href}
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 500,
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
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.35)",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Tools
              </div>
              {[
                { href: "/tools", label: "All Tools" },
                { href: "/tools/camp-scheduler", label: "Camp Scheduler" },
              ].map((link) => (
                <div key={link.href} style={{ marginBottom: "8px" }}>
                  <Link
                    href={link.href}
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 500,
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
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.35)",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Resources
              </div>
              {[
                { href: "https://www.artsnwct.org", label: "NWCT Arts Council" },
                { href: "https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf", label: "Theory of Change" },
              ].map((link) => (
                <div key={link.href} style={{ marginBottom: "8px" }}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    {link.label}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: "1.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
            © 2026 NWCT Arts Council · Automation Lab
          </span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
            Built by{" "}
            <a
              href="https://www.ethansbrewerton.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#68ccd1", textDecoration: "none", fontWeight: 600 }}
            >
              Ethan S. Brewerton
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
