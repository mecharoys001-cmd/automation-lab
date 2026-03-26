"use client";
import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="hero-section"
      style={{ paddingTop: "calc(var(--nav-height) + 96px)", paddingBottom: "96px" }}
    >
      {/* Decorative blob */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "33%",
          height: "100%",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      >
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
          <path
            d="M44.7,-76.4C58.3,-69.2,70.1,-57.4,77.6,-43.3C85.2,-29.2,88.5,-12.8,87.2,3.3C85.9,19.4,80,35.2,70.4,48.6C60.8,61.9,47.6,72.9,32.8,78.2C18,83.5,1.7,83.1,-14.8,79.8C-31.3,76.5,-48,70.3,-61.2,59.3C-74.4,48.3,-84.1,32.5,-87.3,15.7C-90.5,-1.1,-87.2,-18.9,-78.9,-34.2C-70.6,-49.5,-57.3,-62.3,-42.2,-68.8C-27.1,-75.3,-10.1,-75.4,4.2,-81.4C18.5,-87.4,31.1,-83.6,44.7,-76.4Z"
            fill="var(--color-teal)"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "900px",
          padding: "0 24px",
          margin: "0 auto",
        }}
      >
        <h1
          className="heading-hero animate-fade-up"
          style={{ color: "var(--color-navy)", marginBottom: "32px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
        >
          Reducing Administrative Burden in the{" "}
          <span style={{ color: "var(--color-teal)", fontStyle: "italic" }}>Cultural Sector</span>
        </h1>

        <p
          className="animate-fade-up delay-100"
          style={{
            fontSize: "1.25rem",
            color: "var(--color-text)",
            lineHeight: 1.7,
            maxWidth: "640px",
            marginBottom: "48px",
            fontFamily: "var(--font-body)",
          }}
        >
          NWCT Arts Council is exploring responsible, human-centered automation
          to give artists and administrators their time back.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-up delay-200"
          style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
        >
          <Link href="/tools" className="btn-primary">
            Try Our Tools
          </Link>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Take the Self-Assessment
          </a>
        </div>
      </div>
    </section>
  );
}
