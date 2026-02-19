"use client";
export default function SurveyBanner() {
  return (
    <section
      className="section-teal"
      style={{ padding: "72px 20px", position: "relative", overflow: "hidden" }}
    >
      <div className="survey-grid-overlay" />

      <div
        className="animate-fade-up"
        style={{
          maxWidth: "660px",
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255,255,255,0.25)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: "var(--radius-pill)",
            padding: "6px 18px",
            marginBottom: "24px",
          }}
        >
          <span>📋</span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--navy-dark)",
              fontWeight: 700,
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            Call for Nonprofit Participation
          </span>
        </div>

        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 900,
            letterSpacing: "-0.015em",
            marginBottom: "18px",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
            lineHeight: 1.2,
          }}
        >
          Is Your Organization a Fit?
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.88)",
            fontSize: "15px",
            lineHeight: 1.8,
            maxWidth: "520px",
            margin: "0 auto 32px",
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
          Take the Survey →
        </a>

        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginTop: "16px" }}>
          Takes 5–10 minutes · Open to NWCT arts &amp; culture nonprofits
        </p>
      </div>
    </section>
  );
}
