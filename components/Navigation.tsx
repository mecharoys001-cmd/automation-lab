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
        backgroundColor: scrolled
          ? "rgba(10, 14, 26, 0.95)"
          : "rgba(10, 14, 26, 0.7)",
        backdropFilter: "blur(12px)",
        borderBottom: scrolled
          ? "1px solid rgba(30, 41, 59, 0.8)"
          : "1px solid transparent",
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
          height: "64px",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #10b981, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
              }}
            >
              ⚡
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "15px",
                  color: "#f1f5f9",
                  lineHeight: 1.1,
                }}
              >
                Automation Lab
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#10b981",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
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
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "#f1f5f9")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "#94a3b8")
              }
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: "#10b981",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#059669")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#10b981")
            }
          >
            Take the Survey →
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: "24px",
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
            backgroundColor: "rgba(10, 14, 26, 0.98)",
            borderTop: "1px solid rgba(30, 41, 59, 0.8)",
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
                color: "#94a3b8",
                textDecoration: "none",
                padding: "12px 0",
                fontSize: "15px",
                borderBottom: "1px solid rgba(30, 41, 59, 0.5)",
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
              color: "#10b981",
              textDecoration: "none",
              padding: "12px 0",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            Take the Survey →
          </a>
        </div>
      )}
    </nav>
  );
}
