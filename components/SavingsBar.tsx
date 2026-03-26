"use client";

import { useEffect, useState } from "react";

const statStyle = {
  fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
  fontWeight: 700,
  fontFamily: "var(--font-headline)",
  color: "#ffffff",
  letterSpacing: "-0.02em",
  lineHeight: 1,
} as const;

const labelStyle = {
  fontSize: "13px",
  fontWeight: 700,
  fontFamily: "var(--font-body)",
  color: "rgba(255,255,255,0.9)",
  marginTop: "8px",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

const dividerStyle = {
  width: "1px",
  height: "56px",
  background: "rgba(255,255,255,0.2)",
} as const;

export default function SavingsBar() {
  const [totalUses, setTotalUses] = useState<number | null>(null);
  const [hoursSaved, setHoursSaved] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/usage/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setTotalUses(data.total_uses);
        setHoursSaved(data.total_hours_saved);
      })
      .catch(() => {
        // fallback to static numbers
        setTotalUses(null);
        setHoursSaved(null);
      });
  }, []);

  const usesDisplay =
    totalUses !== null ? totalUses.toLocaleString() : "\u2014";
  const hoursDisplay =
    hoursSaved !== null ? `${hoursSaved.toLocaleString()}+` : "\u2014";

  return (
    <section
      style={{
        background: "var(--color-teal)",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "48px",
          flexWrap: "wrap",
        }}
      >
        {/* Tool Uses */}
        <div style={{ textAlign: "center" }}>
          <div style={statStyle}>{usesDisplay}</div>
          <div style={labelStyle}>Tool Uses</div>
        </div>

        <div style={dividerStyle} />

        {/* Hours Saved */}
        <div style={{ textAlign: "center" }}>
          <div style={statStyle}>{hoursDisplay}</div>
          <div style={labelStyle}>Hours Saved by Tools</div>
        </div>

        <div style={dividerStyle} />

        {/* Operational Savings (static) */}
        <div style={{ textAlign: "center" }}>
          <div style={statStyle}>$39,000</div>
          <div style={labelStyle}>Operational Savings / yr</div>
        </div>
      </div>
    </section>
  );
}
