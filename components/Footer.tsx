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
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "'Montserrat', sans-serif",
          marginBottom: "14px",
        }}
      >
        {heading}
      </div>
      {links.map((link) =>
        link.external ? (
          <div key={link.href} style={{ marginBottom: "8px" }}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="footer-link">{link.label}</a>
          </div>
        ) : (
          <div key={link.href} style={{ marginBottom: "8px" }}>
            <Link href={link.href} className="footer-link">{link.label}</Link>
          </div>
        )
      )}
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="section-charcoal" style={{ padding: "56px 20px 28px" }}>
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "32px",
            marginBottom: "40px",
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ marginBottom: "4px" }}>
              <div style={{ fontWeight: 800, fontSize: "18px", color: "#ffffff", fontFamily: "'Montserrat', sans-serif", marginBottom: "10px" }}>
                Automation Lab
              </div>
              <img
                src="/images/nwct-logo-white.svg"
                alt="NWCT Arts Council"
                style={{ height: "28px", width: "auto", marginBottom: "16px" }}
              />
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", lineHeight: 1.7, maxWidth: "280px" }}>
              A pilot initiative exploring human-centered automation for arts &amp; culture nonprofits in Northwest Connecticut.
            </p>
          </div>

          {/* Link columns */}
          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
            <FooterLinkGroup heading="Site" links={siteLinks} />
            <FooterLinkGroup heading="Tools" links={toolLinks} />
            <FooterLinkGroup heading="Resources" links={resourceLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
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
              style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
            >
              Ethan S. Brewerton
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
