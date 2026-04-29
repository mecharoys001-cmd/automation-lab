// Shared catalog of tools listed on the public Tools page.
// The Tools page renders TOOLS_CATALOG; admin views (Operator Overview)
// and the public usage summary use SITE_TOOL_IDS to scope themselves to
// "tools actually on the site," ignoring prototype/external configs.

export type SiteTool = {
  id: string;
  name: string;
  description: string;
  status: 'live';
  features: string[];
  icon: string;
  href: string;
  accent: string;
  usedBy: string;
};

export const TOOLS_CATALOG: SiteTool[] = [
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
    accent: "#0F7490",
    usedBy: "Nonprofits preparing mailing lists from Shopify exports",
  },
  {
    id: "scheduler",
    name: "ASAP! Scheduler",
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

// Stable list of tool IDs that are actually surfaced on /tools. Treat this
// as the source of truth when answering "is this a real site tool?" — e.g.
// when filtering Operator Overview rows or the public savings bar.
export const SITE_TOOL_IDS: ReadonlyArray<string> = TOOLS_CATALOG.map(t => t.id);

export function isSiteTool(toolId: string): boolean {
  return SITE_TOOL_IDS.includes(toolId);
}
