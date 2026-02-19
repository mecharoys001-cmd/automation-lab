/**
 * Tech Stack Mapper — data types, tool library, helpers.
 * Runs 100% client-side; no data leaves the browser.
 */

export type Category =
  | "CRM & Donors"
  | "Finance"
  | "Communication"
  | "Email & Marketing"
  | "Events"
  | "Productivity"
  | "Website & CMS"
  | "Other";

export const CATEGORIES: Category[] = [
  "CRM & Donors", "Finance", "Communication", "Email & Marketing",
  "Events", "Productivity", "Website & CMS", "Other",
];

export const CAT_COLOR: Record<Category, string> = {
  "CRM & Donors":      "#8b5cf6",
  "Finance":           "#10b981",
  "Communication":     "#3b82f6",
  "Email & Marketing": "#f59e0b",
  "Events":            "#ef4444",
  "Productivity":      "#06b6d4",
  "Website & CMS":     "#ec4899",
  "Other":             "#6b7280",
};

export interface LibTool { name: string; category: Category; icon: string; }

export const TOOL_LIBRARY: LibTool[] = [
  // CRM & Donors
  { name: "Salesforce",          category: "CRM & Donors",      icon: "☁️" },
  { name: "DonorPerfect",        category: "CRM & Donors",      icon: "💜" },
  { name: "Bloomerang",          category: "CRM & Donors",      icon: "🌸" },
  { name: "Little Green Light",  category: "CRM & Donors",      icon: "🟢" },
  { name: "Raiser's Edge",       category: "CRM & Donors",      icon: "🏛️" },
  { name: "HubSpot",             category: "CRM & Donors",      icon: "🧡" },
  { name: "Kindful",             category: "CRM & Donors",      icon: "💛" },
  // Finance
  { name: "QuickBooks",          category: "Finance",           icon: "📊" },
  { name: "Xero",                category: "Finance",           icon: "💹" },
  { name: "FreshBooks",          category: "Finance",           icon: "📗" },
  { name: "Stripe",              category: "Finance",           icon: "💳" },
  { name: "PayPal",              category: "Finance",           icon: "🅿️" },
  { name: "Square",              category: "Finance",           icon: "⬛" },
  { name: "Expensify",           category: "Finance",           icon: "🧾" },
  // Communication
  { name: "Slack",               category: "Communication",     icon: "💬" },
  { name: "Microsoft Teams",     category: "Communication",     icon: "🔵" },
  { name: "Zoom",                category: "Communication",     icon: "📹" },
  { name: "Google Meet",         category: "Communication",     icon: "📞" },
  { name: "Discord",             category: "Communication",     icon: "🎮" },
  { name: "WhatsApp",            category: "Communication",     icon: "📱" },
  // Email & Marketing
  { name: "Mailchimp",           category: "Email & Marketing", icon: "🐒" },
  { name: "Constant Contact",    category: "Email & Marketing", icon: "📧" },
  { name: "ActiveCampaign",      category: "Email & Marketing", icon: "📮" },
  { name: "Gmail",               category: "Email & Marketing", icon: "📩" },
  { name: "Outlook",             category: "Email & Marketing", icon: "📨" },
  { name: "SendGrid",            category: "Email & Marketing", icon: "✉️" },
  // Events
  { name: "Eventbrite",          category: "Events",            icon: "🎟️" },
  { name: "Cvent",               category: "Events",            icon: "📅" },
  { name: "SignUpGenius",        category: "Events",            icon: "✍️" },
  { name: "Accelevents",         category: "Events",            icon: "⚡" },
  { name: "RegFox",              category: "Events",            icon: "🦊" },
  // Productivity
  { name: "Google Workspace",    category: "Productivity",      icon: "🗂️" },
  { name: "Microsoft 365",       category: "Productivity",      icon: "📋" },
  { name: "Notion",              category: "Productivity",      icon: "📓" },
  { name: "Airtable",            category: "Productivity",      icon: "🗃️" },
  { name: "Zapier",              category: "Productivity",      icon: "⚡" },
  { name: "Make",                category: "Productivity",      icon: "🔄" },
  { name: "Trello",              category: "Productivity",      icon: "📌" },
  { name: "Asana",               category: "Productivity",      icon: "🎯" },
  { name: "Monday.com",          category: "Productivity",      icon: "📆" },
  // Website & CMS
  { name: "WordPress",           category: "Website & CMS",     icon: "📝" },
  { name: "Squarespace",         category: "Website & CMS",     icon: "⬜" },
  { name: "Webflow",             category: "Website & CMS",     icon: "🌊" },
  { name: "Wix",                 category: "Website & CMS",     icon: "🌐" },
  { name: "GiveLively",          category: "Website & CMS",     icon: "❤️" },
  { name: "Donately",            category: "Website & CMS",     icon: "🎁" },
];

export interface StackTool {
  id: string;
  name: string;
  category: Category;
  icon: string;
}

export interface Connection {
  id: string;
  a: string; // StackTool.id
  b: string; // StackTool.id
}

export interface StackMap {
  title: string;
  tools: StackTool[];
  connections: Connection[];
}

export function newMap(): StackMap {
  return { title: "Our Tech Stack", tools: [], connections: [] };
}

/** Stable, order-independent key for a connection between two tool IDs. */
export function connKey(a: string, b: string): string {
  return [a, b].sort().join("||");
}

export function downloadJson(map: StackMap): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${map.title.toLowerCase().replace(/\s+/g, "-") || "tech-stack"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
