"use client";
import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="section-dark"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        paddingTop: "68px",
      }}
    >
      {/* Background elements */}
      <div className="hero-grid-overlay" />
      <div className="hero-glow-purple" />
      <div className="hero-glow-teal" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "900px",
          margin: "0 auto",
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        {/* Status badge */}
        <div
          className="animate-fade-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(33, 184, 187, 0.12)",
            border: "1px solid rgba(33, 184, 187, 0.3)",
            borderRadius: "var(--radius-pill)",
            padding: "7px 18px",
            marginBottom: "2.5rem",
          }}
        >
          <span
            className="pulse-teal"
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--teal)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              color: "var(--teal-light)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Phase 1: Research & Discovery — Underway
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-hero animate-fade-up delay-100"
          style={{ marginBottom: "1.5rem", color: "#ffffff" }}
        >
          Reducing Administrative
          <br />
          <span className="gradient-text">Burden</span>{" "}
          in the
          <br />
          Cultural Sector
        </h1>

        {/* Subheading */}
        <p
          className="animate-fade-up delay-200"
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            color: "rgba(255,255,255,0.7)",
            maxWidth: "620px",
            margin: "0 auto 3rem",
            lineHeight: 1.75,
          }}
        >
          A research-driven pilot by the{" "}
          <a
            href="https://www.artsnwct.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--teal-light)",
              textDecoration: "none",
              fontWeight: 600,
              borderBottom: "1px solid rgba(104,204,209,0.4)",
            }}
          >
            NWCT Arts Council
          </a>{" "}
          exploring how responsible, human-centered automation can free up
          staff time for mission-driven work.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-up delay-300"
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/tools" className="btn-primary">
            🛠️ Try Our Tools
          </Link>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.22)" }}
          >
            Join the Research →
          </a>
        </div>

        {/* Scroll indicator */}
        <div
          className="animate-fade-in delay-500"
          style={{
            marginTop: "5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            opacity: 0.35,
          }}
        >
          <span
            className="text-label"
            style={{ color: "#fff", fontSize: "11px" }}
          >
            SCROLL
          </span>
          <div
            style={{
              width: "1px",
              height: "40px",
              background: "linear-gradient(to bottom, #fff, transparent)",
              animation: "scrollLine 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </section>
  );
}
