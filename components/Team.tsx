import Image from "next/image";

const team = [
  {
    name: "Steph Burr",
    role: "Project Manager",
    photo: "/images/autolab/steph-burr.jpg",
    bio: [
      "Steph Burr is a nonprofit leader with hands-on experience improving operations through technology, automation, and systems design.",
      "As Executive Director of the NWCT Arts Council, she has implemented workflows across fundraising, grants, and membership programs using a wide range of software platforms. She has extensive technical proficiency and is a member of the Zapier Wizard\u2019s Guild.",
    ],
  },
  {
    name: "Ethan S. Brewerton",
    role: "Development Lead",
    photo: "/images/autolab/ethan-brewerton.png",
    bio: [
      "Ethan S. Brewerton is a creative technologist dedicated to operational efficiency. With two years of specialized experience in computational models and generative scripting, he has mastered the art of automating intricate, multi-step processes.",
      "Previously using these skills to enhance hand made artistic production, Ethan now applies his automation expertise to the non-profit sector. He helps organizations modernize their operations by building custom tools that democratize access to technology, streamline daily tasks, and amplify overall impact.",
    ],
  },
];

export default function Team() {
  return (
    <section
      id="team"
      style={{
        background: "#ffffff",
        padding: "96px 24px",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
            fontWeight: 700,
            color: "var(--color-text)",
            textAlign: "center",
            marginBottom: "56px",
          }}
        >
          Our Team
        </h2>

        {/* Team cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "40px",
          }}
        >
          {team.map((member) => (
            <div
              key={member.name}
              style={{
                textAlign: "center",
              }}
            >
              {/* Circular photo */}
              <div
                style={{
                  width: "180px",
                  height: "180px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  margin: "0 auto 24px",
                  position: "relative",
                  border: "4px solid var(--color-teal-light)",
                }}
              >
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  sizes="180px"
                />
              </div>

              {/* Name & role */}
              <h3
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: "4px",
                }}
              >
                {member.name}
              </h3>
              <p
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--color-teal)",
                  marginBottom: "20px",
                }}
              >
                {member.role}
              </p>

              {/* Bio */}
              {member.bio.map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "0.925rem",
                    lineHeight: 1.8,
                    color: "var(--color-text-muted)",
                    textAlign: "left",
                    marginBottom: i < member.bio.length - 1 ? "12px" : 0,
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
