"use client";

export default function SurveyBanner() {
  return (
    <section
      id="contact"
      style={{
        background: "var(--color-bg-alt)",
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "1.6rem",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "16px",
          }}
        >
          Have a Question?
        </h2>
        <p
          style={{
            fontSize: "1.05rem",
            color: "var(--color-text-muted)",
            lineHeight: 1.7,
          }}
        >
          Reach out to us at{" "}
          <a
            href="mailto:info@artsnwct.org"
            style={{
              color: "var(--color-teal)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            info@artsnwct.org
          </a>
        </p>
      </div>
    </section>
  );
}
