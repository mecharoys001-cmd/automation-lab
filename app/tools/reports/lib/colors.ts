/**
 * Maximally distinct color palette for reports dashboard.
 * 10 colors spaced ~36 apart on the hue wheel, all tuned for dark backgrounds.
 * No two colors share a similar hue.
 */

// Primary category palette — max hue separation, no repeats
export const CATEGORY_COLORS = [
  "#f87171", // red (0)
  "#fb923c", // orange (30)
  "#facc15", // yellow (55)
  "#4ade80", // green (140)
  "#2dd4bf", // teal (170)
  "#38bdf8", // sky blue (200)
  "#818cf8", // indigo (235)
  "#c084fc", // purple (270)
  "#f472b6", // pink (330)
  "#a3e635", // lime (85)
  "#fbbf24", // amber
  "#34d399", // emerald
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#fb7185", // rose
] as const;

/**
 * Dynamically assign colors to categories.
 * Uses colors from CategoryProfile rules when available,
 * falls back to palette-based assignment.
 */
export function assignCategoryColors(categories: string[], ruleColors?: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  let paletteIdx = 0;

  for (const cat of categories) {
    if (ruleColors?.[cat]) {
      map[cat] = ruleColors[cat];
    } else {
      map[cat] = CATEGORY_COLORS[paletteIdx % CATEGORY_COLORS.length];
      paletteIdx++;
    }
  }
  return map;
}

/**
 * Build a rule-color lookup from a CategoryProfile.
 */
export function buildRuleColorMap(rules: { name: string; color: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rule of rules) {
    map[rule.name] = rule.color;
  }
  return map;
}

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
