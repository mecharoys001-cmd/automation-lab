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

  const toolSavings = hoursSaved !== null ? Math.round(hoursSaved * 20) : 0;

  const usesDisplay =
    totalUses !== null ? totalUses.toLocaleString() : "\u2014";
  const hoursDisplay =
    hoursSaved !== null ? `${hoursSaved.toLocaleString()}` : "\u2014";
  const savingsDisplay =
    hoursSaved !== null ? `$${toolSavings.toLocaleString()}` : "\u2014";

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

        {/* Cost Savings from tool usage */}
        <div style={{ textAlign: "center" }}>
          <div style={statStyle}>{savingsDisplay}</div>
          <div style={labelStyle}>Cost Savings</div>
        </div>
      </div>
    </section>
  );
}
