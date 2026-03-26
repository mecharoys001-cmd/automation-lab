export default function About() {
  return (
    <section
      id="about"
      style={{
        background: "#ffffff",
        padding: "96px 24px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        {/* Section heading */}
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          About the Project
        </h2>

        {/* Divider */}
        <div
          style={{
            width: "60px",
            height: "3px",
            background: "var(--color-teal)",
            margin: "0 auto 40px",
          }}
        />

        {/* Quote / intro */}
        <blockquote
          style={{
            fontSize: "1.15rem",
            fontStyle: "italic",
            lineHeight: 1.8,
            color: "var(--color-text)",
            textAlign: "center",
            maxWidth: "680px",
            margin: "0 auto 32px",
            padding: "0 16px",
            borderLeft: "none",
          }}
        >
          &ldquo;The Automation Lab is a research-driven pilot exploring how
          responsible, human-centered automation can reduce administrative burden
          and strengthen operational capacity.&rdquo;
        </blockquote>

        {/* Body paragraphs */}
        <p
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.85,
            color: "var(--color-text-muted)",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          The initiative targets arts &amp; culture nonprofits in Northwest Connecticut.
        </p>
        <p
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.85,
            color: "var(--color-text-muted)",
            marginBottom: "56px",
            textAlign: "center",
          }}
        >
          Through discovery, pilot projects, and shared documentation, the
          endeavor aims to identify practical approaches that free up staff time
          for mission-driven work while building reusable infrastructure for the
          sector.
        </p>

        {/* Theory of Change sub-section */}
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "48px",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            Our Theory of Change
          </h3>

          <blockquote
            style={{
              fontSize: "1.1rem",
              fontStyle: "italic",
              lineHeight: 1.8,
              color: "var(--color-text)",
              textAlign: "center",
              maxWidth: "620px",
              margin: "0 auto 32px",
            }}
          >
            &ldquo;We aim to help close the widening AI access gap and ensure
            that arts &amp; culture nonprofits are not left behind&rdquo; as
            technology advances.
          </blockquote>

          <div style={{ textAlign: "center" }}>
            <a
              href="https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "12px 32px",
                background: "var(--color-teal)",
                color: "#ffffff",
                fontFamily: "var(--font-headline)",
                fontWeight: 600,
                fontSize: "0.95rem",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
              }}
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
