const team = [
  {
    name: "Steph Burr",
    role: "Project Manager",
    bio: "Nonprofit leader with hands-on experience improving operations through technology, automation, and systems design. As Executive Director of the NWCT Arts Council, she has implemented workflows across fundraising, grants, and membership programs using a wide range of software platforms.",
    highlights: ["Zapier Wizard's Guild member", "Executive Director, NWCT Arts Council", "Fundraising & grants automation"],
    avatar: "SB",
    color: "#10b981",
  },
  {
    name: "Ethan S. Brewerton",
    role: "Development Lead",
    bio: "Creative technologist dedicated to operational efficiency. With two years of specialized experience in computational models and generative scripting, Ethan has mastered automating intricate, multi-step processes — applying that expertise to the nonprofit sector.",
    highlights: ["Computational modeling & generative scripting", "Custom tool development", "AI workflow architecture"],
    avatar: "EB",
    color: "#3b82f6",
    website: "https://www.ethansbrewerton.com",
  },
];

export default function Team() {
  return (
    <section id="team" style={{ padding: "6rem 1.5rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div
            style={{
              fontSize: "12px",
              color: "#10b981",
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Who We Are
          </div>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Our Team
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "2rem",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          {team.map((member) => (
            <div
              key={member.name}
              className="card-glow"
              style={{
                backgroundColor: "#111827",
                borderRadius: "20px",
                padding: "2.5rem",
                border: "1px solid #1e293b",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${member.color}40, ${member.color}20)`,
                  border: `2px solid ${member.color}50`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 800,
                  color: member.color,
                  marginBottom: "1.5rem",
                }}
              >
                {member.avatar}
              </div>

              {/* Name / Role */}
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                {member.name}
              </h3>
              <div
                style={{
                  fontSize: "13px",
                  color: member.color,
                  fontWeight: 600,
                  marginBottom: "1rem",
                }}
              >
                {member.role}
              </div>

              {/* Bio */}
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "14px",
                  lineHeight: 1.7,
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
                      gap: "8px",
                      fontSize: "13px",
                      color: "#64748b",
                    }}
                  >
                    <span style={{ color: member.color }}>▸</span>
                    {h}
                  </div>
                ))}
              </div>

              {/* Website link */}
              {member.website && (
                <a
                  href={member.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "1.5rem",
                    color: member.color,
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Visit Website →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
