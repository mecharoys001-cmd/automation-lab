const stats = [
  {
    value: "30 hrs",
    label: "Saved per week",
    sublabel: "1,560 hrs/year",
    color: "var(--purple)",
  },
  {
    value: "$39K",
    label: "Annual cost offset",
    sublabel: "Across two projects",
    color: "var(--teal)",
  },
  {
    value: "$315/hr",
    label: "Avg. dev time ROI",
    sublabel: "Across all case studies",
    color: "var(--gold-light)",
  },
  {
    value: "3",
    label: "Automation projects",
    sublabel: "2023–2025",
    color: "var(--teal-dark)",
  },
];

export default function Stats() {
  return (
    <section className="stats-bar">
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          gap: 0,
          flexWrap: "wrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        {stats.map((stat, i) => (
          <>
            <div
              key={stat.label}
              style={{
                textAlign: "center",
                flex: "1 1 180px",
                padding: "1rem 2rem",
              }}
            >
              <div className="stats-value" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="stats-label">{stat.label}</div>
              <div className="stats-sub">{stat.sublabel}</div>
            </div>
            {i < stats.length - 1 && (
              <div
                key={`divider-${i}`}
                className="stats-divider"
                style={{ display: "block" }}
              />
            )}
          </>
        ))}
      </div>
    </section>
  );
}
