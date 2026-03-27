"use client";
import { useState, useEffect } from "react";
import Link from "next/link";


const navLinks = [
  { href: "/#about", label: "About" },
  { href: "/#case-studies", label: "Case Studies" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/#team", label: "Team" },
  { href: "/tools", label: "Tools" },
];

export default function Navigation({ userSlot }: { userSlot?: React.ReactNode } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(top > 10);
      setProgress(height > 0 ? (top / height) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="scroll-progress" style={{ width: `${progress}%` }} />

      <nav
        className={`nav-wrapper${scrolled ? " scrolled" : ""}`}
        style={{ paddingTop: 0 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "var(--nav-height)",
            width: "100%",
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 32px",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "20px",
                color: "#ffffff",
                fontFamily: "var(--font-headline)",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              AUTOMATION LAB
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex" style={{ alignItems: "center", gap: "32px" }}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "var(--radius-pill)",
                fontWeight: 700,
                fontSize: "14px",
                fontFamily: "var(--font-body)",
                textDecoration: "none",
                transition: "background 0.2s, transform 0.2s",
                display: "inline-flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            >
              Take the Self-Assessment
            </a>
            {userSlot}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden"
            style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#ffffff", padding: "4px" }}
            aria-label="Toggle menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: "var(--color-card)", borderTop: "1px solid var(--color-border)", padding: "8px 20px 16px" }}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="nav-link-mobile">
                {link.label}
              </Link>
            ))}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", color: "var(--color-teal)", padding: "12px 0", fontSize: "15px", fontWeight: 700, fontFamily: "var(--font-body)" }}
            >
              Take the Self-Assessment →
            </a>
          </div>
        )}
      </nav>
    </>
  );
}
