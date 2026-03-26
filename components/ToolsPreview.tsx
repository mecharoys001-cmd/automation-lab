import Link from "next/link";

const tools = [
  {
    id: "csv-dedup",
    name: "CSV Deduplicator",
    description:
      "Clean your mailing lists instantly. Fuzzy matching catches misspelled names, initials, and duplicates. Runs 100% in your browser — your data never leaves your computer.",
    features: ["Fuzzy name matching", "Address normalization", "Smart record selection", "100% browser-based"],
    icon: "🧹",
    href: "/tools/csv-dedup",
    accentRaw: "#6366f1",
  },
  {
    id: "scheduler",
    name: "Symphonix Scheduler",
    description:
      "Automated scheduling platform for educational music programs. Generate sessions from templates, manage instructor availability, and publish schedules.",
    features: ["Template-based scheduling", "Instructor availability", "Conflict detection", "Email notifications"],
    icon: "🎵",
    href: "/tools/scheduler",
    accentRaw: "#1282a2",
  },
  {
    id: "reports",
    name: "Transaction Reports",
    description:
      "Upload your Shopify transaction CSV and get an instant visual dashboard with sales breakdowns, payment method trends, and summary statistics.",
    features: ["Shopify CSV import", "Sales breakdown charts", "Payment method analysis", "100% browser-based"],
    icon: "📊",
    href: "/tools/reports",
    accentRaw: "#10b981",
  },
];

export default function ToolsPreview() {
  return null;
}
