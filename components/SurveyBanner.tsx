"use client";
export default function SurveyBanner() {
  return (
    <section
      style={{
        background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
        padding: "96px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="survey-grid-overlay" />

      <div
        className="animate-fade-up"
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h2
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            marginBottom: "20px",
            color: "#ffffff",
            fontFamily: "var(--font-headline)",
            lineHeight: 1.2,
          }}
        >
          Is Your Organization a Fit?
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.9)",
            fontSize: "1.1rem",
            lineHeight: 1.8,
            maxWidth: "540px",
            margin: "0 auto 36px",
          }}
        >
          We are currently seeking feedback from arts &amp; culture nonprofit
          organizations in Northwest Connecticut. Fill out our brief survey to
          share your experience and see if you might be a good match to partner
          with us.
        </p>

        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-survey"
        >
          Take the Self-Assessment →
        </a>

        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginTop: "18px" }}>
          Takes 5-10 minutes · Open to NWCT arts &amp; culture nonprofits
        </p>
      </div>
    </section>
  );
}
