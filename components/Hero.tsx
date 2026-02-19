"use client";
import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="hero-section"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: "68px" }}
    >
      {/* Dot pattern */}
      <div className="hero-pattern" />

      {/* Soft glow blobs */}
      <div
        className="hero-glow"
        style={{
          top: "-10%", left: "-5%",
          width: "500px", height: "500px",
          background: "rgba(255,255,255,0.12)",
        }}
      />
      <div
        className="hero-glow"
        style={{
          bottom: "0%", right: "-5%",
          width: "350px", height: "350px",
          background: "rgba(28,35,48,0.08)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "820px",
          margin: "0 auto",
          padding: "5rem 1.5rem",
          textAlign: "center",
        }}
      >
        {/* Overline */}
        <div
          className="animate-fade-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: "var(--radius-pill)",
            padding: "6px 18px",
            marginBottom: "2rem",
          }}
        >
          <span
            className="pulse-teal"
            style={{
              width: "7px", height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--navy-dark)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "12px",
              color: "var(--navy-dark)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              fontFamily: "'Montserrat', sans-serif",
              textTransform: "uppercase",
            }}
          >
            Phase 1: Research & Discovery — Underway
          </span>
        </div>

        {/* Headline */}
        <h1
          className="heading-hero animate-fade-up delay-100"
          style={{ color: "#ffffff", marginBottom: "0.5rem" }}
        >
          Reducing Administrative Burden
        </h1>
        <h1
          className="heading-hero animate-fade-up delay-100"
          style={{ color: "var(--navy-dark)", marginBottom: "1.75rem" }}
        >
          in the Cultural Sector
        </h1>

        {/* Org attribution */}
        <p
          className="animate-fade-up delay-200"
          style={{
            fontSize: "13px",
            color: "rgba(28,35,48,0.7)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            fontFamily: "'Montserrat', sans-serif",
            textTransform: "uppercase",
            marginBottom: "0.75rem",
          }}
        >
          A pilot initiative by the NWCT Arts Council
        </p>

        <p
          className="text-intro animate-fade-up delay-200"
          style={{
            color: "rgba(255,255,255,0.88)",
            maxWidth: "580px",
            margin: "0 auto 2.5rem",
          }}
        >
          Exploring how responsible, human-centered automation can free up staff
          time for mission-driven work — and build reusable infrastructure for
          arts & culture nonprofits across Northwest Connecticut.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-up delay-300"
          style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginBottom: "3.5rem" }}
        >
          <Link href="/tools" className="btn-primary">
            🛠️ Try Our Tools
          </Link>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline-white"
          >
            Join the Research →
          </a>
        </div>

        {/* Quick stats row */}
        <div
          className="animate-fade-up delay-400"
          style={{
            display: "flex",
            gap: "0",
            justifyContent: "center",
            flexWrap: "wrap",
            background: "rgba(255,255,255,0.15)",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(255,255,255,0.25)",
            overflow: "hidden",
          }}
        >
          {[
            { value: "30 hrs", label: "Saved / Week" },
            { value: "$39K", label: "Annual Savings" },
            { value: "$315/hr", label: "Dev ROI" },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 160px",
                padding: "18px 24px",
                textAlign: "center",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.2)" : "none",
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", fontFamily: "'Montserrat', sans-serif", letterSpacing: "-0.02em" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "4px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
