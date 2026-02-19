"use client";
export default function SurveyBanner() {
  return (
    <section
      style={{
        padding: "5rem 1.5rem",
        background: "linear-gradient(90deg, #a244ae 0%, #21b8bb 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "100px",
            padding: "7px 18px",
            marginBottom: "2rem",
          }}
        >
          <span style={{ fontSize: "16px" }}>📋</span>
          <span
            style={{
              fontSize: "13px",
              color: "#fff",
              fontWeight: 600,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Call for Nonprofit Participation
          </span>
        </div>

        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginBottom: "1.25rem",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Is Your Organization a Fit?
        </h2>

        <p
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: "16px",
            lineHeight: 1.75,
            marginBottom: "2.5rem",
            maxWidth: "560px",
            margin: "0 auto 2.5rem",
          }}
        >
          We are currently seeking feedback from arts & culture nonprofit
          organizations in Northwest Connecticut. Fill out our brief survey to
          share your experience and see if you might be a good match to partner
          with us.
        </p>

        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#ffffff",
            color: "#a244ae",
            padding: "16px 36px",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            fontFamily: "'Montserrat', sans-serif",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
          }}
        >
          Take the Survey →
        </a>

        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "13px",
            marginTop: "1.25rem",
          }}
        >
          Takes 5–10 minutes · Open to NWCT arts & culture nonprofits
        </p>
      </div>
    </section>
  );
}
