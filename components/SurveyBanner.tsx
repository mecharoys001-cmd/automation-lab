"use client";
export default function SurveyBanner() {
  return (
    <section
      style={{
        padding: "6rem 1.5rem",
        background: "var(--gradient-brand)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid overlay */}
      <div className="survey-grid-overlay" />

      {/* Glow accents */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          right: "8%",
          width: "250px",
          height: "250px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

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
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: "var(--radius-pill)",
            padding: "7px 20px",
            marginBottom: "2.25rem",
          }}
        >
          <span style={{ fontSize: "15px" }}>📋</span>
          <span
            style={{
              fontSize: "12px",
              color: "#fff",
              fontWeight: 700,
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Call for Nonprofit Participation
          </span>
        </div>

        <h2
          style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 900,
            letterSpacing: "-0.025em",
            marginBottom: "1.25rem",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
            lineHeight: 1.1,
          }}
        >
          Is Your Organization a Fit?
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: "16px",
            lineHeight: 1.75,
            maxWidth: "540px",
            margin: "0 auto 2.75rem",
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

        <p
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "13px",
            marginTop: "1.25rem",
          }}
        >
          Takes 5–10 minutes · Open to NWCT arts &amp; culture nonprofits
        </p>
      </div>
    </section>
  );
}
