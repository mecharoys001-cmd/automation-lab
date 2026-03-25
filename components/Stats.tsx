const stats = [
  { value: "3",      label: "Projects complete", sublabel: "2023-2025",        color: "var(--teal)" },
  { value: "30 hrs", label: "Saved per week",    sublabel: "1,560 hrs/year",   color: "var(--teal)" },
  { value: "$39K",   label: "Annual savings",    sublabel: "Across all projects", color: "var(--gold-light)" },
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
        }}
      >
        {stats.map((s, i) => (
          <>
            <div
              key={s.label}
              style={{ textAlign: "center", flex: "1 1 180px", padding: "8px 28px" }}
            >
              <div className="stats-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stats-label">{s.label}</div>
              <div className="stats-sub">{s.sublabel}</div>
            </div>
            {i < stats.length - 1 && (
              <div key={`d-${i}`} className="stats-divider" />
            )}
          </>
        ))}
      </div>
    </section>
  );
}
