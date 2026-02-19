"use client";
import Link from "next/link";

export default function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        paddingTop: "68px",
        background: "linear-gradient(135deg, #1a1a38 0%, #270339 50%, #1a2e38 100%)",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(104, 204, 209, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(104, 204, 209, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />
      {/* Glow blobs */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(162, 68, 174, 0.15) 0%, transparent 70%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "10%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(33, 184, 187, 0.12) 0%, transparent 70%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

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
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(33, 184, 187, 0.12)",
            border: "1px solid rgba(33, 184, 187, 0.3)",
            borderRadius: "100px",
            padding: "7px 18px",
            marginBottom: "2.5rem",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "#21b8bb",
              display: "inline-block",
            }}
            className="pulse-teal"
          />
          <span
            style={{
              fontSize: "13px",
              color: "#68ccd1",
              fontWeight: 600,
              letterSpacing: "0.04em",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Phase 1: Research & Discovery — Underway
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: "1.5rem",
            letterSpacing: "-0.02em",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Reducing Administrative
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #a244ae 0%, #21b8bb 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Burden
          </span>{" "}
          in the
          <br />
          Cultural Sector
        </h1>

        <p
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
            style={{ color: "#68ccd1", textDecoration: "none", fontWeight: 600 }}
          >
            NWCT Arts Council
          </a>{" "}
          exploring how responsible, human-centered automation can free up staff
          time for mission-driven work.
        </p>

        {/* CTAs */}
        <div
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
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#68ccd1";
              e.currentTarget.style.background = "rgba(33,184,187,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            Join the Research →
          </a>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            marginTop: "5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            opacity: 0.35,
          }}
        >
          <span style={{ fontSize: "11px", color: "#fff", letterSpacing: "0.15em", fontFamily: "'Montserrat', sans-serif" }}>
            SCROLL
          </span>
          <div
            style={{
              width: "1px",
              height: "40px",
              background: "linear-gradient(to bottom, #fff, transparent)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
