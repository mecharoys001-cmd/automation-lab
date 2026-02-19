import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools | The Automation Lab",
  description:
    "Free automation tools built for nonprofits — by the NWCT Arts Council Automation Lab.",
};

const tools = [
  {
    id: "tech-stack",
    name: "Tech Stack Mapper",
    description:
      "Build a visual map of every tool your organization uses and how they connect. Add tools from a library of 45+ nonprofit staples, draw integration lines between them, and instantly spot the manual handoffs that are costing you hours. Export as JSON or share with your team. Runs entirely in your browser.",
    status: "live",
    features: [
      "45+ tools pre-loaded",
      "Category lane layout",
      "Click-to-connect integrations",
      "Gap & isolation detection",
      "Custom tool support",
      "Export / Import JSON",
      "100% browser-based",
      "No data uploaded",
    ],
    icon: "🗺️",
    href: "/tools/tech-stack",
    accent: "#0ea5e9",
    usedBy: "Nonprofits, arts orgs, ops teams doing a tech audit",
  },
  {
    id: "camp-scheduler",
    name: "Camp Scheduler",
    description:
      "A full-featured weekly activity scheduler for camps and summer programs. Built with conflict detection, drag-and-drop scheduling, instructor availability management, multi-venue support, and Google Sheets integration.",
    status: "live",
    features: [
      "50+ activity support",
      "Drag & drop scheduling",
      "6-type conflict detection",
      "Auto-resolution engine",
      "Instructor availability & limits",
      "Employee self-submit portal",
      "16+ venue management with utilization",
      "Google Sheets sync",
      "Print view",
    ],
    icon: "📅",
    href: "/tools/camp-scheduler",
    accent: "#10b981",
    usedBy: "Camps, summer programs, youth organizations",
  },
  {
    id: "csv-dedup",
    name: "CSV Deduplicator",
    description:
      "Upload a mailing list or contacts CSV and get a cleaned file back instantly. Removes exact duplicates and fuzzy matches — catches misspelled names, initials, and concatenated names (like 'Ethan Brewerton', 'Ethen Brewerton', 'E Brewerton', and 'Ebrewerton') when they share the same address. Runs 100% in your browser; your data never leaves your computer.",
    status: "live",
    features: [
      "Fuzzy name matching",
      "Handles misspellings & initials",
      "Address normalization",
      "Smart record selection",
      "Auto-detects columns",
      "100% browser-based",
      "No data uploaded",
      "Download cleaned CSV",
    ],
    icon: "🧹",
    href: "/tools/csv-dedup",
    accent: "#6366f1",
    usedBy: "Nonprofits, arts orgs, event planners with mailing lists",
  },
  { id: 'donation-receipts', name: 'Donation Receipt Generator', icon: '🧾', accent: '#10b981', status: 'live', href: '/tools/donation-receipts', usedBy: 'Nonprofits tracking donations for tax compliance', description: 'Generate and track tax-deductible donation receipts with auto-numbered IDs. Syncs to Google Sheets via Apps Script — or runs offline locally.', features: ['Auto receipt numbers', 'Google Sheets sync', 'Donor email tracking', 'Donation totals', 'Export ready', 'Offline mode'] },
  { id: 'volunteer-tracker', name: 'Volunteer Hour Tracker', icon: '🙌', accent: '#6366f1', status: 'live', href: '/tools/volunteer-tracker', usedBy: 'Volunteer coordinators and program managers', description: 'Log volunteer hours by activity and date. Tracks totals per volunteer, shows a leaderboard, and syncs to Google Sheets.', features: ['Per-volunteer totals', 'Activity tagging', 'Date range filter', 'Leaderboard', 'Google Sheets sync', 'Offline mode'] },
  { id: 'event-scheduler', name: 'Event Schedule Builder', icon: '🗓️', accent: '#f59e0b', status: 'live', href: '/tools/event-scheduler', usedBy: 'Event coordinators and program directors', description: 'Build and manage event schedules with speaker slots, locations, and times. Filter by date, export to Sheets.', features: ['Multi-day scheduling', 'Speaker management', 'Location tracking', 'Date filtering', 'Google Sheets sync', 'Bulk import'] },
  { id: 'mail-merge', name: 'Mail Merge Preview', icon: '✉️', accent: '#ec4899', status: 'live', href: '/tools/mail-merge', usedBy: 'Development teams and program staff', description: 'Write a {{field}} template and preview it merged with your contact list. Send via Gmail through Apps Script.', features: ['{{field}} templates', 'Live preview', 'Gmail send', 'CSV paste', 'Google Sheets source', 'Bulk send'] },
  { id: 'event-attendance', name: 'Event Attendance Checker', icon: '✅', accent: '#14b8a6', status: 'live', href: '/tools/event-attendance', usedBy: 'Event coordinators managing check-in', description: "Compare your registration list against check-ins to instantly see who showed up, who didn't, and who walked in unregistered.", features: ['No-show detection', 'Walk-in tracking', 'Attendance rate %', 'Multi-event support', 'Google Sheets sync', 'Fuzzy matching'] },
  { id: 'donor-thankyou', name: 'Donor Thank-You Generator', icon: '💌', accent: '#f97316', status: 'live', href: '/tools/donor-thankyou', usedBy: 'Development and fundraising staff', description: 'Generate personalized thank-you letters for donors using customizable templates. Send via Gmail with one click.', features: ['Personalized letters', '2 default templates', 'Gmail send', 'Sent tracking', 'Bulk generation', 'Tax receipt option'] },
  { id: 'budget-tracker', name: 'Budget vs. Actual Tracker', icon: '📊', accent: '#8b5cf6', status: 'live', href: '/tools/budget-tracker', usedBy: 'Finance staff and executive directors', description: 'Track budgeted vs. actual spending by category and period. Color-coded variance with summary totals.', features: ['Variance calculation', 'Period filtering', 'Color-coded overage', 'Summary totals', 'Google Sheets sync', 'Multi-period tracking'] },
];

export default function ToolsPage() {
  return (
    <div style={{ paddingTop: "64px", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "4rem 1.5rem",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Link
            href="/"
            style={{
              color: "#64748b",
              textDecoration: "none",
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "2rem",
            }}
          >
            ← Back to Automation Lab
          </Link>
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
            Open Source · Free to Use
          </div>
          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            Automation Tools
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "16px",
              maxWidth: "500px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Practical tools built through the Automation Lab — free for any
            nonprofit or organization to use.
          </p>
        </div>
      </div>

      {/* Tools list */}
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "4rem 1.5rem",
        }}
      >
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="card-glow"
            style={{
              backgroundColor: "#111827",
              borderRadius: "20px",
              padding: "2.5rem",
              border: `1px solid ${tool.accent}30`,
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "14px",
                    backgroundColor: `${tool.accent}20`,
                    border: `1px solid ${tool.accent}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                  }}
                >
                  {tool.icon}
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      marginBottom: "4px",
                    }}
                  >
                    {tool.name}
                  </h2>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Best for: {tool.usedBy}
                  </div>
                </div>
              </div>
              <span
                style={{
                  backgroundColor: `${tool.accent}20`,
                  color: tool.accent,
                  padding: "6px 14px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                ● Live
              </span>
            </div>

            <p
              style={{
                color: "#94a3b8",
                fontSize: "15px",
                lineHeight: 1.7,
                marginBottom: "2rem",
              }}
            >
              {tool.description}
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "2rem",
              }}
            >
              {tool.features.map((f) => (
                <span
                  key={f}
                  style={{
                    backgroundColor: `${tool.accent}10`,
                    color: tool.accent,
                    border: `1px solid ${tool.accent}25`,
                    borderRadius: "8px",
                    padding: "5px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>

            <Link
              href={tool.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: tool.accent,
                color: "#fff",
                padding: "14px 28px",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: `0 0 20px ${tool.accent}30`,
              }}
            >
              Open {tool.name} →
            </Link>
          </div>
        ))}

        {/* Coming soon */}
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            border: "1px dashed #1e293b",
            borderRadius: "20px",
            color: "#475569",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🚧</div>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#64748b" }}>
            More tools coming soon
          </div>
          <div style={{ fontSize: "13px" }}>
            Email Newsletter Automator · Grant Tracker · Board Meeting Minutes Generator · and more
          </div>
        </div>
      </div>
    </div>
  );
}
