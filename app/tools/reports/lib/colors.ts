/**
 * Harmonious color palette for reports dashboard.
 * Muted jewel tones that look great on dark backgrounds.
 * Ordered so adjacent categories have good contrast.
 */

// Primary category palette — 10 colors, evenly spaced hues, consistent saturation/lightness
export const CATEGORY_COLORS = [
  "#6ee7b7", // mint (Summer Camps)
  "#7dd3fc", // sky (Classes)
  "#c4b5fd", // lavender (Open Studio)
  "#fda4af", // rose (Ceramics Retail)
  "#fcd34d", // gold (Supplies)
  "#a5b4fc", // periwinkle (Events)
  "#86efac", // spring green (Donations)
  "#fdba74", // peach (Local Artists)
  "#d8b4fe", // orchid (Professional Services)
  "#99f6e4", // teal (Other)
] as const;

// Named mapping for stacked charts (DailyTrend)
export const CATEGORY_COLOR_MAP: Record<string, string> = {
  "Summer Camps": CATEGORY_COLORS[0],
  Classes: CATEGORY_COLORS[1],
  "Open Studio": CATEGORY_COLORS[2],
  "Ceramics Retail": CATEGORY_COLORS[3],
  Supplies: CATEGORY_COLORS[4],
  Events: CATEGORY_COLORS[5],
  Donations: CATEGORY_COLORS[6],
  "Local Artists": CATEGORY_COLORS[7],
  "Professional Services": CATEGORY_COLORS[8],
  Other: CATEGORY_COLORS[9],
};

// Financial status — semantic colors (green=good, yellow=pending, red=problem)
export const STATUS_COLORS: Record<string, string> = {
  paid: "#6ee7b7",
  pending: "#fcd34d",
  partially_paid: "#fdba74",
  refunded: "#fda4af",
  authorized: "#7dd3fc",
  voided: "#9ca3af",
  unknown: "#6b7280",
};

// Payment method colors
export const PAYMENT_COLORS = [
  "#7dd3fc", // sky
  "#c4b5fd", // lavender
  "#6ee7b7", // mint
  "#fcd34d", // gold
  "#fda4af", // rose
  "#a5b4fc", // periwinkle
] as const;

// Tooltip styling constants
export const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#f1f5f9",
} as const;
