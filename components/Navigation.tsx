"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/#about", label: "About" },
    { href: "/#case-studies", label: "Case Studies" },
    { href: "/#roadmap", label: "Roadmap" },
    { href: "/#team", label: "Team" },
    { href: "/tools", label: "Tools" },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "all 0.3s ease",
        backgroundColor: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: scrolled ? "1px solid #e0e7ef" : "1px solid transparent",
        boxShadow: scrolled ? "0 2px 16px rgba(26,26,56,0.08)" : "none",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "68px",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(90deg, #a244ae 0%, #21b8bb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                flexShrink: 0,
              }}
            >
              ⚡
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "15px",
                  color: "#1a1a38",
                  lineHeight: 1.15,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Automation Lab
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#21b8bb",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                NWCT Arts Council
              </div>
            </div>
          </div>
        </Link>

        {/* Desktop Links */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2rem",
          }}
          className="hidden md:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: "#3d4a5c",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 600,
                transition: "color 0.2s",
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#21b8bb")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#3d4a5c")}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ padding: "9px 18px", fontSize: "13px" }}
          >
            Take the Survey →
          </a>
        </div>

        {/* Mobile button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: "none",
            border: "none",
            color: "#1a1a38",
            cursor: "pointer",
            fontSize: "22px",
          }}
          className="md:hidden"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e0e7ef",
            padding: "1rem 1.5rem",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block",
                color: "#3d4a5c",
                textDecoration: "none",
                padding: "12px 0",
                fontSize: "15px",
                fontWeight: 600,
                borderBottom: "1px solid #e0e7ef",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              color: "#a244ae",
              textDecoration: "none",
              padding: "12px 0",
              fontSize: "15px",
              fontWeight: 700,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Take the Survey →
          </a>
        </div>
      )}
    </nav>
  );
}
