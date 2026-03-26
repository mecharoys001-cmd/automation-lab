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
        background: "#ffffff",
      }}
    >
      {/* Wave background at bottom */}
      <Image
        src="/images/autolab/wave-bg.jpg"
        alt=""
        fill
        priority
        style={{ objectFit: "cover", objectPosition: "center bottom", opacity: 0.35 }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "800px",
          padding: "40px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0",
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
            color: "#1a1a1a",
          }}
        >
          Automation Lab
        </h1>

        {/* Gold/amber divider line */}
        <div
          style={{
            width: "100px",
            height: "3px",
            background: "#c8962e",
            marginBottom: "24px",
          }}
        />

        <p
          style={{
            fontSize: "clamp(0.75rem, 1.5vw, 0.9rem)",
            fontWeight: 500,
            lineHeight: 1.8,
            maxWidth: "640px",
            marginBottom: "28px",
            fontFamily: "var(--font-body)",
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          Reducing Administrative Burden in the Cultural Sector Through Technology
        </p>

        <p
          style={{
            fontSize: "0.95rem",
            fontStyle: "italic",
            color: "#9ca3af",
            fontFamily: "var(--font-body)",
            marginBottom: "16px",
          }}
        >
          A pilot initiative by the
        </p>

        <Image
          src="/images/autolab/nwct-logo.svg"
          alt="NWCT Arts Council"
          width={200}
          height={56}
          style={{ objectFit: "contain" }}
        />
      </div>
    </section>
  );
}
