const stats = [
  {
    value: "30 hrs",
    label: "Saved per week",
    sublabel: "1,560 hrs/year",
    color: "var(--purple)",
  },
  {
    value: "$39,000",
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2rem",
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="animate-fade-up"
            style={{
              textAlign: "center",
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <div className="stats-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="stats-label">{stat.label}</div>
            <div className="stats-sub">{stat.sublabel}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
