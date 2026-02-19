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
    <section id="team" style={{ padding: "6rem 1.5rem", backgroundColor: "#ffffff" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div className="tag-teal" style={{ display: "inline-block", marginBottom: "1.25rem" }}>
            Who We Are
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              color: "#1a1a38",
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            Our Team
          </h2>
          <p style={{ color: "#6b7a8f", fontSize: "16px", maxWidth: "480px", margin: "0 auto", lineHeight: 1.65 }}>
            Two collaborators bridging nonprofit operations and modern technology.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "2rem",
            maxWidth: "820px",
            margin: "0 auto",
          }}
        >
          {team.map((member) => (
            <div
              key={member.name}
              className="card-light"
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
                  height: "220px",
                  overflow: "hidden",
                  background: `linear-gradient(135deg, ${member.accentColor}20, ${member.accentColor}08)`,
                }}
              >
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  style={{ objectFit: "cover", objectPosition: "center top" }}
                  sizes="(max-width: 768px) 100vw, 400px"
                />
                {/* Gradient overlay at bottom */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "80px",
                    background: "linear-gradient(to top, rgba(255,255,255,0.95), transparent)",
                  }}
                />
                {/* Role badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    backgroundColor: member.accentColor,
                    color: "#fff",
                    padding: "5px 12px",
                    borderRadius: "100px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    fontFamily: "'Montserrat', sans-serif",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  {member.role}
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: "1.75rem 2rem 2rem" }}>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#1a1a38",
                    marginBottom: "0.25rem",
                  }}
                >
                  {member.name}
                </h3>
                <a
                  href={member.orgHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    color: member.accentColor,
                    textDecoration: "none",
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                    display: "inline-block",
                    marginBottom: "1.1rem",
                  }}
                >
                  {member.org} ↗
                </a>

                <p
                  style={{
                    color: "#5a6a7e",
                    fontSize: "14px",
                    lineHeight: 1.75,
                    marginBottom: "1.5rem",
                  }}
                >
                  {member.bio}
                </p>

                {/* Highlights */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {member.highlights.map((h) => (
                    <div
                      key={h}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        fontSize: "13px",
                        color: "#3d4a5c",
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: member.accentColor,
                          flexShrink: 0,
                          display: "inline-block",
                        }}
                      />
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
