export default function SurveyBanner() {
  return (
    <section
      style={{
        padding: "5rem 1.5rem",
        backgroundColor: "rgba(17, 24, 39, 0.3)",
        borderTop: "1px solid #1e293b",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "100px",
            padding: "6px 16px",
            marginBottom: "2rem",
          }}
        >
          <span style={{ fontSize: "16px" }}>📋</span>
          <span
            style={{
              fontSize: "13px",
              color: "#10b981",
              fontWeight: 500,
            }}
          >
            Call for Nonprofit Participation
          </span>
        </div>

        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: "1rem",
          }}
        >
          Is Your Organization a Fit?
        </h2>

        <p
          style={{
            color: "#94a3b8",
            fontSize: "16px",
            lineHeight: 1.7,
            marginBottom: "2.5rem",
          }}
        >
          We are currently seeking feedback from arts & culture nonprofit
          organizations in Northwest Connecticut to help identify common pain
          points and opportunities for sector-wide capacity building. Fill out
          our brief survey to share your experience and see if you might be a
          good match to partner with us.
        </p>

        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#10b981",
            color: "#fff",
            padding: "16px 32px",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 0 30px rgba(16, 185, 129, 0.3)",
            transition: "all 0.2s ease",
          }}
        >
          Take the Survey
          <span style={{ fontSize: "20px" }}>→</span>
        </a>

        <p
          style={{
            color: "#475569",
            fontSize: "13px",
            marginTop: "1rem",
          }}
        >
          Takes 5–10 minutes · Open to NWCT arts & culture nonprofits
        </p>
      </div>
    </section>
  );
}
