import type { Metadata } from "next";
import Link from "next/link";
import CampSchedulerEmbed from "@/components/CampSchedulerEmbed";

export const metadata: Metadata = {
  title: "Camp Scheduler | Automation Lab Tools",
  description:
    "Free camp activity scheduler with conflict detection, drag-and-drop, instructor management, and Google Sheets integration.",
};

const features = [
  { icon: "📅", label: "Weekly Grid", desc: "Full Mon–Fri view with drag-and-drop between days" },
  { icon: "⚠️", label: "Conflict Detection", desc: "6 conflict types: availability, double-booking, overtime, break violations, sessions" },
  { icon: "✅", label: "Auto-Resolution", desc: "One-click fix suggestions that apply instantly and re-run conflict checks" },
  { icon: "👥", label: "Instructor Mgmt", desc: "Set availability, hour limits, and let staff self-submit their schedules" },
  { icon: "🏛️", label: "Venue Tracking", desc: "16+ facilities with utilization bars and parallel booking support" },
  { icon: "📊", label: "Google Sheets", desc: "Create a template or link an existing sheet — auto-detects column names" },
];

export default function CampSchedulerPage() {
  return (
    <div style={{ paddingTop: "64px", minHeight: "100vh" }}>
      {/* Breadcrumb */}
      <div
        style={{
          padding: "1.5rem",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          gap: "8px",
          fontSize: "13px",
          color: "#64748b",
        }}
      >
        <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>
          Automation Lab
        </Link>
        <span>/</span>
        <Link href="/tools" style={{ color: "#64748b", textDecoration: "none" }}>
          Tools
        </Link>
        <span>/</span>
        <span style={{ color: "#10b981" }}>Camp Scheduler</span>
      </div>

      {/* Hero */}
      <div
        style={{
          padding: "3rem 1.5rem 2rem",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "100px",
                padding: "4px 12px",
                marginBottom: "1rem",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
                Live · Free to Use
              </span>
            </div>
            <h1
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: "0.75rem",
              }}
            >
              📅 Camp Scheduler
            </h1>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "16px",
                lineHeight: 1.7,
                maxWidth: "600px",
              }}
            >
              A professional-grade weekly activity scheduler for camps and summer
              programs. Built during the Automation Lab&apos;s research phase to
              demonstrate how nonprofits can automate complex scheduling workflows.
            </p>
          </div>

          <a
            href="https://script.google.com/macros/s/AKfycbztdub4IHfDhbD2y7Zp3w5wS3oexxhLh54mOeoC8HtVd6PjG9OiU0iGqv9oswbDbXZaMg/exec"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "transparent",
              color: "#10b981",
              padding: "12px 20px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              whiteSpace: "nowrap",
            }}
          >
            Open in New Tab ↗
          </a>
        </div>

        {/* Feature chips */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {features.map((f) => (
            <div
              key={f.label}
              style={{
                backgroundColor: "rgba(17, 24, 39, 0.8)",
                border: "1px solid #1e293b",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "18px" }}>{f.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    marginBottom: "2px",
                  }}
                >
                  {f.label}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Embed */}
      <CampSchedulerEmbed />

      {/* About section */}
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "4rem 1.5rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#111827",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "2rem",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "1rem" }}>
            About This Tool
          </h2>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              lineHeight: 1.7,
              marginBottom: "1rem",
            }}
          >
            The Camp Scheduler was built as part of the NWCT Arts Council&apos;s
            Automation Lab pilot program. It runs entirely on Google Apps Script,
            meaning it requires no servers, no subscriptions, and no technical
            setup — just a Google account.
          </p>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            Link your existing Google Sheet or create a template in one click.
            The scheduler automatically detects column names (supports common
            aliases like &quot;Teacher&quot; → Instructor, &quot;Venue&quot; → Location) and
            saves all changes back to your sheet in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
