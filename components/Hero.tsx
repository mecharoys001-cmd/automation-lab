import Image from "next/image";

export default function Hero() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {/* Background image */}
      <Image
        src="/images/autolab/hero-bg.jpg"
        alt=""
        fill
        priority
        style={{ objectFit: "cover", objectPosition: "center" }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "800px",
          padding: "40px 24px",
          color: "#ffffff",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "clamp(3rem, 7vw, 5rem)",
            fontWeight: 900,
            letterSpacing: "0.04em",
            lineHeight: 1.1,
            marginBottom: "24px",
            textTransform: "uppercase",
          }}
        >
          Automation Lab
        </h1>

        <p
          style={{
            fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)",
            fontWeight: 400,
            lineHeight: 1.6,
            maxWidth: "640px",
            margin: "0 auto 32px",
            fontFamily: "var(--font-body)",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Reducing Administrative Burden in the Cultural Sector Through Technology
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "1rem",
              color: "rgba(255,255,255,0.8)",
              fontFamily: "var(--font-body)",
            }}
          >
            A pilot initiative by the
          </span>
          <Image
            src="/images/autolab/nwct-logo-white.svg"
            alt="NWCT Arts Council"
            width={180}
            height={50}
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>
    </section>
  );
}
