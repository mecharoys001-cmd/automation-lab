import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessibleToolIds, getUserSuites, getSuiteToolIds } from "@/lib/tool-access";
import type { UserSuite } from "@/lib/tool-access";
import { getSiteAdmin, isSiteAdmin } from "@/lib/site-rbac";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Tools | The Automation Lab",
    description:
      "Free automation tools built for nonprofits — by the NWCT Arts Council Automation Lab.",
  };
}

const tools = [
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
  {
    id: "reports",
    name: "Transaction Reports",
    description:
      "Upload your Shopify transaction CSV and get an instant visual dashboard. See sales breakdowns by type, payment method trends, net sales over time, and summary statistics. Runs 100% in your browser - no data uploaded.",
    status: "live",
    features: [
      "Shopify CSV import",
      "Sales by type breakdown",
      "Payment method analysis",
      "Time trend charts",
      "Summary statistics",
      "100% browser-based",
      "No data uploaded",
      "Instant results",
    ],
    icon: "📊",
    href: "/tools/reports",
    accent: "#10b981",
    usedBy: "Nonprofits and small businesses tracking Shopify sales",
  },
  {
    id: "mailing-list-builder",
    name: "Mailing List Builder",
    description:
      "Convert a Shopify customer export CSV into a clean, deduplicated Constant Contact mailing list. Parses family-style billing names into first/last, formats phone numbers, removes duplicates, and flags edge cases for review. Runs 100% in your browser; your data never leaves your computer.",
    status: "live",
    features: [
      "Shopify CSV import",
      "Smart name parsing",
      "Family name detection",
      "Phone number formatting",
      "Email deduplication",
      "Flagged items review",
      "Paginated preview",
      "100% browser-based",
      "No data uploaded",
      "Constant Contact ready",
    ],
    icon: "✉️",
    href: "/tools/mailing-list-builder",
    accent: "#1282a2",
    usedBy: "Nonprofits preparing mailing lists from Shopify exports",
  },
  {
    id: "scheduler",
    name: "Symphonix Scheduler",
    icon: "🎵",
    accent: "#a244ae",
    status: "live",
    href: "/tools/scheduler",
    usedBy: "Music program coordinators and education directors",
    description:
      "Automated scheduling platform for educational music programs. Generate sessions from templates, manage instructor availability, track venues, and publish schedules with automated email notifications.",
    features: [
      "Template-based scheduling",
      "Automated session generation",
      "Instructor availability tracking",
      "Multi-venue management",
      "Conflict detection & resolution",
      "Email notification system",
      "School calendar integration",
      "Tag & categorization system",
      "Real-time schedule publishing",
    ],
  },
];

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
  // Tools not in tool_config are treated as public (accessible to all)
  const visibleTools = accessibleToolIds
    ? tools.filter((t) => accessibleToolIds!.includes(t.id))
    : tools;

  // Build a reverse map: toolId -> suite name (for badge display)
  const toolSuiteNameMap: Record<string, string> = {};
  for (const suite of userSuites) {
    for (const toolId of suiteToolMap[suite.suite_id] ?? []) {
      toolSuiteNameMap[toolId] = suite.name;
    }
  }

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

  // For admin badges, fetch visibility from tool_config
  let visibilityMap: Record<string, string> = {};
  if (isAdmin) {
    const { createServiceClient } = await import("@/lib/supabase-service");
    const svc = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs } = await (svc.from("tool_config") as any)
      .select("tool_id, visibility");
    if (configs) {
      visibilityMap = Object.fromEntries(
        configs.map((c: { tool_id: string; visibility: string | null }) => [
          c.tool_id,
          c.visibility ?? "public",
        ]),
      );
    }
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
          <div
            style={{
              fontSize: "12px",
              color: "var(--color-teal)",
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
                      backgroundColor: `${tool.accent}12`,
                      border: `1px solid ${tool.accent}25`,
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
                        color: "var(--color-navy)",
                      }}
                    >
                      {tool.name}
                    </h2>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                      Best for: {tool.usedBy}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  {toolSuiteNameMap[tool.id] && (
                    <span
                      style={{
                        backgroundColor: "#eff6ff",
                        color: "#3b82f6",
                        padding: "4px 10px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {toolSuiteNameMap[tool.id]}
                    </span>
                  )}
                  {isAdmin && visibilityMap[tool.id] && visibilityMap[tool.id] !== "public" && (
                    <span
                      style={{
                        backgroundColor: visibilityMap[tool.id] === "restricted" ? "#fef3c7" : "#f1f5f9",
                        color: visibilityMap[tool.id] === "restricted" ? "#d97706" : "#64748b",
                        padding: "4px 10px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {visibilityMap[tool.id]}
                    </span>
                  )}
                  {isAdmin && visibilityMap[tool.id] === "public" && (
                    <span
                      style={{
                        backgroundColor: "#dcfce7",
                        color: "#16a34a",
                        padding: "4px 10px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Public
                    </span>
                  )}
                  <span
                    style={{
                      backgroundColor: `${tool.accent}12`,
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
                      backgroundColor: `${tool.accent}0a`,
                      color: tool.accent,
                      border: `1px solid ${tool.accent}20`,
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
