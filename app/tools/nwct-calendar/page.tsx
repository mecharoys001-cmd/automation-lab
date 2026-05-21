import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkToolAccess } from "@/lib/tool-access";
import NwctCalendarTool from "./components/NwctCalendarTool";

export const metadata: Metadata = {
  title: "Calendar Automator | Automation Lab Tools",
  description:
    "Browser-based print-production tool for the monthly NWCT Arts Council calendar. Upload a CSV of events, edit rows in a spreadsheet-style grid, then build a print-ready calendar layout.",
};

const ACCENT = "#D97706";
const TOOL_ID = "nwct-calendar";

export default async function NwctCalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/login?next=/tools/${TOOL_ID}`);
  }

  const { hasAccess } = await checkToolAccess(user.email, TOOL_ID);

  if (!hasAccess) {
    return (
      <div
        style={{
          paddingTop: "80px",
          minHeight: "100vh",
          background: "#f8fafc",
          fontFamily: "'Montserrat', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "2.5rem",
            maxWidth: "420px",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "#1a1a2e",
              marginBottom: "0.75rem",
            }}
          >
            You don&apos;t have access to this tool
          </h1>
          <p
            style={{
              color: "#64748b",
              fontSize: "14px",
              lineHeight: 1.6,
              margin: "0 0 1.5rem",
            }}
          >
            The Calendar Automator hasn&apos;t been shared with your account.
            Contact your suite manager if you think this is a mistake.
          </p>
          <Link
            href="/tools"
            style={{
              display: "inline-block",
              color: ACCENT,
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Back to Tools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        paddingTop: "64px",
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div
        style={{
          padding: "1.5rem",
          borderBottom: "1px solid #e2e8f0",
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
        <span style={{ color: ACCENT }}>Calendar Automator</span>
      </div>

      <div style={{ padding: "3rem 1.5rem 1rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(217,119,6,0.08)",
            border: "1px solid rgba(217,119,6,0.2)",
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
              backgroundColor: ACCENT,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: "12px", color: ACCENT, fontWeight: 600 }}>Live</span>
        </div>
        <h1
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: "0.75rem",
            color: "#1a1a2e",
          }}
        >
          📅 Calendar Automator
        </h1>
        <p style={{ color: "#475569", fontSize: "16px", lineHeight: 1.7, maxWidth: "680px" }}>
          Build the monthly NWCT Arts Council print calendar from a CSV of events. Upload your
          source file, review and edit rows in a spreadsheet-style grid, then generate a
          print-ready preview you can save, print, or export to PDF. Everything runs in your
          browser — no data is uploaded.
        </p>
      </div>

      <NwctCalendarTool />
    </div>
  );
}
