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
          We&apos;d love to hear from you.
        </p>
      </div>
    </section>
  );
}
