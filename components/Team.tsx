import Image from "next/image";

const team = [
  {
    name: "Steph Burr",
    role: "Project Manager",
    bio: "Nonprofit leader with hands-on experience improving operations through technology, automation, and systems design. As Executive Director of the NWCT Arts Council, she has implemented workflows across fundraising, grants, and membership programs using a wide range of software platforms.",
    highlights: ["Zapier Wizard's Guild member", "Executive Director, NWCT Arts Council", "Fundraising & grants automation"],
    photo: "/images/team/steph.jpg",
    accentColor: "#a244ae",
    org: "artsnwct.org",
    orgHref: "https://www.artsnwct.org",
  },
  {
    name: "Ethan S. Brewerton",
    role: "Development Lead",
    bio: "Creative technologist dedicated to operational efficiency. With two years of specialized experience in computational models and generative scripting, Ethan has mastered automating intricate, multi-step processes — applying that expertise to the nonprofit sector.",
    highlights: ["Computational modeling & generative scripting", "Custom tool development", "AI workflow architecture"],
    photo: "/images/team/ethan.png",
    accentColor: "#21b8bb",
    org: "ethansbrewerton.com",
    orgHref: "https://www.ethansbrewerton.com",
  },
];

export default function Team() {
  return (
    <section id="team" className="section section-light">
      <div className="container">
        {/* Header */}
        <div className="section-header" data-reveal="fade">
          <div className="label-overline" style={{ marginBottom: "10px" }}>Who We Are</div>
          <h2 className="heading-section">Our Team</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", maxWidth: "440px", margin: "0 auto" }}>
            Two collaborators bridging nonprofit operations and modern technology.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            maxWidth: "780px",
            margin: "0 auto",
          }}
        >
          {team.map((member) => (
            <div
              key={member.name}
              className="card"
              data-reveal
              style={{
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Photo header */}
              <div
                style={{
                  position: "relative",
                  aspectRatio: "1 / 1",
                  overflow: "hidden",
                  background: `linear-gradient(135deg, ${member.accentColor}15, ${member.accentColor}05)`,
                }}
              >
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  style={{ objectFit: "contain", objectPosition: "center center" }}
                  sizes="(max-width: 768px) 100vw, 400px"
                />
                {/* Role badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    backgroundColor: "rgba(28,35,48,0.75)",
                    color: "#fff",
                    padding: "5px 12px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    fontFamily: "'Montserrat', sans-serif",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {member.role}
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: "1.75rem 2rem 2rem" }}>
                <h3 className="heading-card" style={{ fontSize: "18px", marginBottom: "3px" }}>
                  {member.name}
                </h3>
                <a
                  href={member.orgHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    color: "var(--teal-dark)",
                    textDecoration: "none",
                    fontWeight: 600,
                    display: "inline-block",
                    marginBottom: "16px",
                  }}
                >
                  {member.org} ↗
                </a>

                <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.75, marginBottom: "20px" }}>
                  {member.bio}
                </p>

                {/* Highlights */}
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {member.highlights.map((h) => (
                    <div key={h} style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", color: "var(--text-body)" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--teal)", flexShrink: 0, display: "inline-block" }} />
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
