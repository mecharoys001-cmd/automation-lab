import Image from "next/image";

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
            marginBottom: "0",
            textAlign: "center",
          }}
        >
          Through discovery, pilot projects, and shared documentation, the
          endeavor aims to identify practical approaches that free up staff time
          for mission-driven work while building reusable infrastructure for the
          sector.
        </p>
      </div>

      {/* Theory of Change - full-width split section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          margin: "64px -24px 0",
          overflow: "hidden",
          minHeight: "420px",
        }}
      >
        {/* Left column - dark teal background */}
        <div
          style={{
            background: "#1e3a4c",
            padding: "56px 48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "1.6rem",
              fontWeight: 700,
              fontStyle: "italic",
              color: "#ffffff",
              marginBottom: "24px",
            }}
          >
            Our Theory of Change
          </h3>

          <p
            style={{
              fontSize: "1.05rem",
              lineHeight: 1.8,
              color: "rgba(255,255,255,0.9)",
              marginBottom: "32px",
            }}
          >
            We aim to help close the widening AI access gap and{" "}
            <strong style={{ color: "#ffffff" }}>
              ensure that arts &amp; culture nonprofits are not left behind
            </strong>{" "}
            as technology advances.
          </p>

          <div>
            <a
              href="https://irp.cdn-website.com/04efc271/files/uploaded/Theory+of+Change+_+Why+This+Matters+Now.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "12px 32px",
                background: "transparent",
                color: "#ffffff",
                fontFamily: "var(--font-headline)",
                fontWeight: 600,
                fontSize: "0.95rem",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                border: "2px solid #ffffff",
              }}
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Right column - full-bleed image */}
        <div style={{ position: "relative", minHeight: "420px" }}>
          <Image
            src="/images/autolab/theory-code.jpg"
            alt="Crab plush with code on monitor"
            fill
            style={{ objectFit: "cover" }}
          />
        </div>
      </div>
    </section>
  );
}
