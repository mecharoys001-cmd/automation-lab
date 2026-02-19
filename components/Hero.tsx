"use client";
import Link from "next/link";

const floatingStats = [
  { value: "30 hrs", label: "saved/week", color: "var(--purple)" },
  { value: "$39K", label: "cost offset", color: "var(--teal)" },
  { value: "$315/hr", label: "dev ROI", color: "var(--gold-light)" },
];

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
      {/* Background */}
      <div className="hero-grid-overlay" />
      <div className="hero-glow-purple" />
      <div className="hero-glow-teal" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "960px",
          margin: "0 auto",
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        {/* Phase badge */}
        <div
          className="animate-fade-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(33, 184, 187, 0.1)",
            border: "1px solid rgba(33, 184, 187, 0.28)",
            borderRadius: "var(--radius-pill)",
            padding: "7px 20px",
            marginBottom: "3rem",
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
              fontSize: "12px",
              color: "var(--teal-light)",
              fontWeight: 700,
              letterSpacing: "0.06em",
              fontFamily: "'Montserrat', sans-serif",
              textTransform: "uppercase",
            }}
          >
            Phase 1: Research & Discovery — Underway
          </span>
        </div>

        {/* Main headline — larger, tighter */}
        <h1
          className="animate-fade-up delay-100"
          style={{
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            marginBottom: "0.5rem",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Reducing
        </h1>
        <h1
          className="animate-fade-up delay-100"
          style={{
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            marginBottom: "0.5rem",
            fontFamily: "'Montserrat', sans-serif",
            background: "var(--gradient-brand)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Administrative Burden
        </h1>
        <h1
          className="animate-fade-up delay-100"
          style={{
            fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            marginBottom: "2rem",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          in the Cultural Sector
        </h1>

        {/* Subheading */}
        <p
          className="animate-fade-up delay-200"
          style={{
            fontSize: "clamp(1rem, 2.2vw, 1.15rem)",
            color: "rgba(255,255,255,0.6)",
            maxWidth: "560px",
            margin: "0 auto 3rem",
            lineHeight: 1.8,
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
              borderBottom: "1px solid rgba(104,204,209,0.35)",
            }}
          >
            NWCT Arts Council
          </a>{" "}
          exploring how responsible, human-centered automation can free staff
          time for mission-driven work.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-up delay-300"
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "4rem",
          }}
        >
          <Link href="/tools" className="btn-primary" style={{ fontSize: "15px", padding: "15px 32px" }}>
            🛠️ Try Our Tools
          </Link>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: "15px", padding: "15px 32px" }}
          >
            Join the Research →
          </a>
        </div>

        {/* Floating stat chips */}
        <div
          className="animate-fade-up delay-400"
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {floatingStats.map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "var(--radius-md)",
                padding: "10px 18px",
                backdropFilter: "blur(8px)",
              }}
            >
              <span
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 900,
                  color: s.color,
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div
          className="animate-fade-in delay-500"
          style={{
            marginTop: "4.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            opacity: 0.3,
          }}
        >
          <span style={{ fontSize: "10px", color: "#fff", letterSpacing: "0.18em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
            SCROLL
          </span>
          <div
            style={{
              width: "1px",
              height: "36px",
              background: "linear-gradient(to bottom, #fff, transparent)",
              animation: "scrollLine 2.2s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </section>
  );
}
