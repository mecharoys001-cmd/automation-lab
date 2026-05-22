import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessibleToolIds, getUserSuites, getSuiteToolIds } from "@/lib/tool-access";
import type { UserSuite } from "@/lib/tool-access";
import { getSiteAdmin, isSiteAdmin } from "@/lib/site-rbac";
import { TOOLS_CATALOG } from "./tool-catalog";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Tools | The Automation Lab",
    description:
      "Automation tools built for nonprofits — by the NWCT Arts Council Automation Lab.",
  };
}

const tools = TOOLS_CATALOG;

export default async function ToolsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let accessibleToolIds: string[] | null = null;
  let isAdmin = false;
  let userSuites: UserSuite[] = [];
  let suiteToolMap: Record<string, string[]> = {};

  if (user?.email) {
    const adminInfo = await getSiteAdmin(user.email);
    isAdmin = isSiteAdmin(adminInfo);
    accessibleToolIds = await getUserAccessibleToolIds(user.email);

    // Fetch suites and their tool IDs
    userSuites = await getUserSuites(user.email);
    if (userSuites.length > 0) {
      const entries = await Promise.all(
        userSuites.map(async (s) => [s.suite_id, await getSuiteToolIds(s.suite_id)] as const),
      );
      suiteToolMap = Object.fromEntries(entries);
    }
  }

  // Filter tools: if we have an access list, only show accessible tools
  // Only explicitly public tools + granted tools are visible
  const visibleTools = accessibleToolIds
    ? tools.filter((t) => accessibleToolIds!.includes(t.id))
    : tools;

  // Group tools by suite
  const hasSuites = userSuites.length > 0;
  type ToolGroup = { label: string | null; accent: string | null; tools: typeof visibleTools; isManager?: boolean };
  let toolGroups: ToolGroup[] = [];

  if (hasSuites) {
    // Collect tool IDs that belong to any suite
    const allSuiteToolIds = new Set(Object.values(suiteToolMap).flat());
    const ungrouped = visibleTools.filter((t) => !allSuiteToolIds.has(t.id));
    const grouped: ToolGroup[] = [];

    if (ungrouped.length > 0) {
      grouped.push({ label: null, accent: null, tools: ungrouped });
    }

    for (const suite of userSuites) {
      const ids = suiteToolMap[suite.suite_id] ?? [];
      const suiteTools = visibleTools.filter((t) => ids.includes(t.id));
      if (suiteTools.length > 0) {
        grouped.push({ label: suite.name, accent: suiteTools[0]?.accent ?? null, tools: suiteTools, isManager: suite.role === 'manager' });
      }
    }
    toolGroups = grouped;
  } else {
    toolGroups = [{ label: null, accent: null, tools: visibleTools }];
  }

  return (
    <div style={{ paddingTop: "64px", minHeight: "100vh", backgroundColor: "var(--color-bg)", fontFamily: "'Montserrat', sans-serif" }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--color-border)",
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
              "radial-gradient(circle, rgba(18, 130, 162, 0.06) 0%, transparent 70%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Link
            href="/"
            style={{
              color: "var(--color-text-muted)",
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
          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
              color: "var(--color-navy)",
            }}
          >
            Automation Tools
          </h1>
          <p
            style={{
              color: "var(--color-text)",
              fontSize: "16px",
              maxWidth: "500px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Practical tools built through the Automation Lab for
            nonprofit and arts organizations.
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
        {user && visibleTools.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              background: "var(--color-card)",
              borderRadius: "16px",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#0F749012",
                border: "1px solid #0F749025",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                margin: "0 auto 1.5rem",
              }}
            >
              ⚡
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--color-navy)",
                marginBottom: "0.75rem",
              }}
            >
              Your account is active
            </h2>
            <p
              style={{
                color: "var(--color-text)",
                fontSize: "15px",
                lineHeight: 1.7,
                maxWidth: "400px",
                margin: "0 auto",
              }}
            >
              You&#39;re signed in, but no tools have been assigned to your account yet.
              Contact your suite manager if you think this is a mistake.
            </p>
          </div>
        ) : null}
        {toolGroups.map((group, gi) => (
          <div key={group.label ?? "__ungrouped"}>
            {group.label && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "1.5rem",
                  marginTop: gi > 0 ? "3rem" : 0,
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--color-text-muted)",
                    margin: 0,
                  }}
                >
                  {group.label}
                </h3>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: "var(--color-border)",
                  }}
                />
                {(group.isManager || isAdmin) && (
                  <Link
                    href="/tools/admin/suite-manager"
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-teal)",
                      textDecoration: "none",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      border: "1px solid var(--color-teal)",
                      transition: "background 0.2s, color 0.2s",
                      whiteSpace: "nowrap",
                    }}
                    title="Manage who has access to these tools"
                  >
                    👥 Manage Access
                  </Link>
                )}
              </div>
            )}
        {group.tools.map((tool) => (
          <div
            key={tool.id}
            style={{
              backgroundColor: "var(--color-card)",
              borderRadius: "20px",
              padding: "0",
              border: "1px solid var(--color-border)",
              marginBottom: "2rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Accent bar on top */}
            <div style={{ height: "4px", backgroundColor: tool.accent }} />
            <div style={{ padding: "2.5rem" }}>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2
                  style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    marginBottom: "4px",
                    color: "var(--color-navy)",
                  }}
                >
                  {tool.name}
                </h2>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  Best for: {tool.usedBy}
                </div>
              </div>

              <p
                style={{
                  color: "var(--color-text)",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  marginBottom: "2rem",
                }}
              >
                {tool.description}
              </p>

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
                  boxShadow: `0 2px 8px ${tool.accent}30`,
                }}
              >
                Open {tool.name} →
              </Link>
            </div>
          </div>
        ))}
          </div>
        ))}


      </div>
    </div>
  );
}
