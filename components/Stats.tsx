const stats = [
  {
    value: "30 hrs",
    label: "Saved per week",
    sublabel: "1,560 hrs/year",
    color: "#10b981",
  },
  {
    value: "$39,000",
    label: "Annual cost offset",
    sublabel: "Across two projects",
    color: "#3b82f6",
  },
  {
    value: "$315/hr",
    label: "Avg. dev time ROI",
    sublabel: "Across all case studies",
    color: "#f59e0b",
  },
  {
    value: "3",
    label: "Automation projects",
    sublabel: "2023–2025",
    color: "#10b981",
  },
];

export default function Stats() {
  return (
    <section
      style={{
        backgroundColor: "rgba(17, 24, 39, 0.5)",
        borderTop: "1px solid #1e293b",
        borderBottom: "1px solid #1e293b",
        padding: "3rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
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
                fontWeight: 800,
                color: stat.color,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#f1f5f9",
                fontWeight: 600,
                marginTop: "4px",
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                marginTop: "2px",
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
