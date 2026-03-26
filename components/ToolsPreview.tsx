export default function ToolsPreview() {
  return (
    <section
      id="video"
      style={{
        background: "#ffffff",
        padding: "96px 24px",
      }}
    >
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "clamp(1.4rem, 3vw, 1.8rem)",
            fontWeight: 700,
            color: "var(--color-text)",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          Print Calendar Automation (Before and After)
        </h2>

        <div
          style={{
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-lg)",
            background: "#000",
          }}
        >
          <video
            controls
            playsInline
            preload="metadata"
            poster="/images/autolab/calendar-thumbnail.jpg"
            style={{
              width: "100%",
              display: "block",
            }}
          >
            <source
              src="https://vid.cdn-website.com/04efc271/videos/9zQDpktUQO2X1wIzOdeU_2025+Calendar+Automation+%281%29-v.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
}
