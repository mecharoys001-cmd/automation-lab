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
  { href: "https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf", label: "Theory of Change", external: true },
];

function FooterLinkGroup({ heading, links }: { heading: string; links: { href: string; label: string; external?: boolean }[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: "#ffffff",
          fontFamily: "var(--font-body)",
          marginBottom: "16px",
        }}
      >
        {heading}
      </div>
      {links.map((link) =>
        link.external ? (
          <div key={link.href} style={{ marginBottom: "10px" }}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="footer-link">{link.label}</a>
          </div>
        ) : (
          <div key={link.href} style={{ marginBottom: "10px" }}>
            <Link href={link.href} className="footer-link">{link.label}</Link>
          </div>
        )
      )}
    </div>
  );
}

export default function Footer() {
  return (
    <footer style={{ background: "var(--color-navy-deep)", padding: "64px 24px 32px" }}>
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "48px",
            marginBottom: "48px",
            maxWidth: "1200px",
            margin: "0 auto 48px",
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "24px",
                color: "#ffffff",
                fontFamily: "var(--font-headline)",
                marginBottom: "16px",
              }}
            >
              Automation Lab
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", lineHeight: 1.7, maxWidth: "300px" }}>
              A program of the NWCT Arts Council exploring the intersection of technology and creativity.
            </p>
          </div>

          {/* Link columns */}
          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
            <FooterLinkGroup heading="Project" links={siteLinks} />
            <FooterLinkGroup heading="Tools" links={toolLinks} />
            <FooterLinkGroup heading="Connect" links={resourceLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
            © 2026 NWCT Arts Council · Automation Lab
          </span>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
            Built by{" "}
            <a
              href="https://www.ethansbrewerton.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#c8962e", fontWeight: 600, textDecoration: "none" }}
            >
              Ethan S. Brewerton
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
