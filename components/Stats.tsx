const stats = [
  { value: "3",      label: "Projects Complete", sublabel: "2023-2025" },
  { value: "30+",    label: "Hours Saved Weekly", sublabel: "1,560 hrs/year" },
  { value: "$39K",   label: "Annual Savings",     sublabel: "Across all projects" },
];

export default function Stats() {
  return (
    <section className="stats-bar">
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-around",
          gap: 0,
          flexWrap: "wrap",
        }}
      >
        {stats.map((s, i) => (
          <div key={s.label}>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
              }}
            >
              <div style={{ textAlign: "center", padding: "8px 48px" }}>
                <div className="stats-value">{s.value}</div>
                <div className="stats-label">{s.label}</div>
                <div className="stats-sub">{s.sublabel}</div>
              </div>
              {i < stats.length - 1 && (
                <div className="stats-divider" />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
