const stats = [
  {
    value: "30 hrs",
    label: "Saved per week",
    sublabel: "1,560 hrs/year",
    color: "#a244ae",
  },
  {
    value: "$39,000",
    label: "Annual cost offset",
    sublabel: "Across two projects",
    color: "#21b8bb",
  },
  {
    value: "$315/hr",
    label: "Avg. dev time ROI",
    sublabel: "Across all case studies",
    color: "#a28231",
  },
  {
    value: "3",
    label: "Automation projects",
    sublabel: "2023–2025",
    color: "#1282a2",
  },
];

export default function Stats() {
  return (
    <section
      style={{
        background: "linear-gradient(90deg, #1a1a38 0%, #270339 50%, #1a2e38 100%)",
        padding: "3.5rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2rem",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{ textAlign: "center" }}
          >
            <div
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                fontWeight: 900,
                color: stat.color,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "rgba(255,255,255,0.9)",
                fontWeight: 700,
                marginTop: "6px",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.45)",
                marginTop: "3px",
              }}
            >
              {stat.sublabel}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
