"use client";
import { useState, useEffect, useRef } from "react";

export default function UserIndicatorClient({ email, isAdmin = false, isSuiteManager = false }: { email: string | null; isAdmin?: boolean; isSuiteManager?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  };

  if (!email) return null;

  const initials = email
    .split("@")[0]
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        title={email}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          border: "1.5px solid rgba(255,255,255,0.3)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "var(--font-body)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
          letterSpacing: "0.02em",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.25)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
        }
      >
        {initials}
      </button>

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "var(--color-card, #fff)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            minWidth: 220,
            padding: "12px 0",
            zIndex: 999,
          }}
        >
          <div
            style={{
              padding: "8px 16px 12px",
              borderBottom: "1px solid var(--color-border, #e2e8f0)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted, #64748b)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              Signed in as
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text, #374151)",
                fontWeight: 500,
                wordBreak: "break-all",
              }}
            >
              {email}
            </div>
          </div>
          {isAdmin && (
            <a
              href="/tools/admin/impact"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 16px",
                background: "none",
                border: "none",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-teal, #1282a2)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-bg-alt, #f1f5f9)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "none")
              }
            >
              ⚡ Impact Dashboard
            </a>
          )}
          {isSuiteManager && (
            <a
              href="/tools/admin/suite-manager"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 16px",
                background: "none",
                border: "none",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-teal, #1282a2)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-bg-alt, #f1f5f9)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "none")
              }
            >
              👥 Manage Team Access
            </a>
          )}
          <button
            onClick={handleSignOut}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 16px",
              background: "none",
              border: "none",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-coral, #d4664e)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--color-bg-alt, #f1f5f9)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "none")
            }
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
