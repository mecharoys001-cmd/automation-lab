export default function SavingsBar() {
  return (
    <section
      style={{
        background: "var(--color-teal)",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "48px",
          flexWrap: "wrap",
        }}
      >
        {/* Money Saved */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
              fontWeight: 700,
              fontFamily: "var(--font-headline)",
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            $39,000
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              color: "rgba(255,255,255,0.9)",
              marginTop: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Annual Cost Savings
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "56px",
            background: "rgba(255,255,255,0.2)",
          }}
        />

        {/* Hours Saved */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
              fontWeight: 700,
              fontFamily: "var(--font-headline)",
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            1,950+
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              color: "rgba(255,255,255,0.9)",
              marginTop: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Hours Saved Annually
          </div>
        </div>
      </div>
    </section>
  );
}
