import Link from "next/link";

const siteLinks = [
  { href: "/#about", label: "About" },
  { href: "/#case-studies", label: "Case Studies" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/#team", label: "Team" },
];

const toolLinks = [
  { href: "/tools", label: "All Tools" },
  { href: "/tools/camp-scheduler", label: "Camp Scheduler" },
];

const resourceLinks = [
  { href: "https://www.artsnwct.org", label: "NWCT Arts Council", external: true },
  {
    href: "https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf",
    label: "Theory of Change",
    external: true,
  },
];

function FooterLinkGroup({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <div
        className="text-label"
        style={{
          color: "rgba(255,255,255,0.3)",
          marginBottom: "1rem",
          fontSize: "10px",
        }}
      >
        {heading}
      </div>
      {links.map((link) =>
        link.external ? (
          <div key={link.href} style={{ marginBottom: "8px" }}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              {link.label}
            </a>
          </div>
        ) : (
          <div key={link.href} style={{ marginBottom: "8px" }}>
            <Link href={link.href} className="footer-link">
              {link.label}
            </Link>
          </div>
        )
      )}
    </div>
  );
}

export default function Footer() {
  return (
    <footer
      className="section-dark"
      style={{ padding: "4rem 1.5rem 2rem" }}
    >
      <div
        className="container"
        style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}
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
                className="icon-box icon-box-sm"
                style={{ background: "var(--gradient-brand)", fontSize: "16px" }}
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
                    color: "var(--teal-light)",
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
                color: "rgba(255,255,255,0.4)",
                fontSize: "13px",
                lineHeight: 1.7,
                maxWidth: "280px",
              }}
            >
              A pilot initiative exploring human-centered automation
              for the cultural sector in Northwest Connecticut.
            </p>
          </div>

          {/* Link columns */}
          <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
            <FooterLinkGroup heading="Site" links={siteLinks} />
            <FooterLinkGroup heading="Tools" links={toolLinks} />
            <FooterLinkGroup heading="Resources" links={resourceLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "1.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            © 2026 NWCT Arts Council · Automation Lab
          </span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            Built by{" "}
            <a
              href="https://www.ethansbrewerton.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--teal-light)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Ethan S. Brewerton
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
