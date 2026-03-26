/**
 * Maximally distinct color palette for reports dashboard.
 * 10 colors spaced ~36° apart on the hue wheel, all tuned for dark backgrounds.
 * No two colors share a similar hue.
 */

// Primary category palette — max hue separation, no repeats
export const CATEGORY_COLORS = [
  "#f87171", // red (0°)
  "#fb923c", // orange (30°)
  "#facc15", // yellow (55°)
  "#4ade80", // green (140°)
  "#2dd4bf", // teal (170°)
  "#38bdf8", // sky blue (200°)
  "#818cf8", // indigo (235°)
  "#c084fc", // purple (270°)
  "#f472b6", // pink (330°)
  "#a3e635", // lime (85°)
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

// Financial status — semantic colors, distinct from each other
export const STATUS_COLORS: Record<string, string> = {
  paid: "#4ade80",       // green
  pending: "#facc15",    // yellow
  partially_paid: "#fb923c", // orange
  refunded: "#f87171",   // red
  authorized: "#38bdf8", // sky blue
  voided: "#94a3b8",     // slate
  unknown: "#64748b",    // dark slate
};

// Payment method colors — pulled from opposite ends of the palette, no adjacents
export const PAYMENT_COLORS = [
  "#38bdf8", // sky blue
  "#f87171", // red
  "#4ade80", // green
  "#c084fc", // purple
  "#facc15", // yellow
  "#2dd4bf", // teal
  "#fb923c", // orange
  "#f472b6", // pink
] as const;

// Tooltip styling constants
export const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#f1f5f9",
} as const;
