"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/#about", label: "About" },
  { href: "/#case-studies", label: "Case Studies" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/#team", label: "Team" },
  { href: "/tools", label: "Tools" },
];

export default function Navigation() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(scrollTop > 20);
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const userDisplay = user?.user_metadata?.full_name as string | undefined
    ?? user?.email
    ?? "Account";

  return (
    <>
      {/* Scroll progress */}
      <div
        className="scroll-progress"
        style={{ width: `${progress}%` }}
      />

      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          transition: "background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
          backgroundColor: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${scrolled ? "var(--border-light)" : "transparent"}`,
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
                className="icon-box icon-box-sm"
                style={{ background: "var(--gradient-brand)" }}
              >
                ⚡
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "15px",
                    color: "var(--navy)",
                    lineHeight: 1.15,
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  Automation Lab
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--teal)",
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
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}

            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--navy)",
                    fontFamily: "'Inter', sans-serif",
                    maxWidth: "160px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={userDisplay}
                >
                  {userDisplay}
                </span>
                <button
                  onClick={handleSignOut}
                  style={{
                    padding: "9px 18px",
                    fontSize: "13px",
                    background: "transparent",
                    border: "1.5px solid var(--teal)",
                    borderRadius: "8px",
                    color: "var(--teal)",
                    fontWeight: 700,
                    fontFamily: "'Montserrat', sans-serif",
                    cursor: "pointer",
                    transition: "background 0.2s, color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--teal)";
                    (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--teal)";
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ padding: "9px 18px", fontSize: "13px" }}
              >
                Take the Survey →
              </a>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "none",
              border: "none",
              color: "var(--navy)",
              cursor: "pointer",
              fontSize: "22px",
              padding: "4px",
            }}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            style={{
              backgroundColor: "var(--bg-white)",
              borderTop: "1px solid var(--border-light)",
              padding: "1rem 1.5rem",
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="nav-link-mobile"
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <div style={{ paddingTop: "8px" }}>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--navy)",
                    fontFamily: "'Inter', sans-serif",
                    margin: "0 0 8px",
                  }}
                >
                  {userDisplay}
                </p>
                <button
                  onClick={() => { setMenuOpen(false); handleSignOut(); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--teal)",
                    fontWeight: 700,
                    fontSize: "15px",
                    fontFamily: "'Montserrat', sans-serif",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSctZRxGj5IGsjgKg-AVRtBKfAeWr1MS2tsdLUNkwYcrz7H4wA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  color: "var(--purple)",
                  textDecoration: "none",
                  padding: "12px 0",
                  fontSize: "15px",
                  fontWeight: 700,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Take the Survey →
              </a>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
