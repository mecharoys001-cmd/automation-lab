import type { CategoryRule, CategoryProfile, Order, LineItem } from "./types";

// ─── Built-in Presets ───────────────────────────────────────

/** NWCT Arts Studio preset — preserves exact original category detection */
export const ARTS_STUDIO_PROFILE: CategoryProfile = {
  id: "arts-studio",
  name: "Arts Studio (NWCT)",
  uncategorizedLabel: "Other",
  rules: [
    {
      id: "summer-camps",
      name: "Summer Camps",
      color: "#f87171",
      keywords: ["FD #", "HD #", "SP #", "FD#", "HD#", "SP#"],
    },
    {
      id: "classes",
      name: "Classes",
      color: "#fb923c",
      keywords: ["pottery wheel", "cartooning", "mud puppies", "sculpture", "saturday clay", "ewow", "friday pottery"],
    },
    {
      id: "open-studio",
      name: "Open Studio",
      color: "#facc15",
      keywords: ["open studio"],
    },
    {
      id: "ceramics-retail",
      name: "Ceramics Retail",
      color: "#4ade80",
      keywords: ["cer "],
    },
    {
      id: "supplies",
      name: "Supplies",
      color: "#2dd4bf",
      keywords: ["misc supplies", "canvas", "25 lb mid fire clay", "high fire clay"],
    },
    {
      id: "events",
      name: "Events",
      color: "#38bdf8",
      keywords: ["birthday party", "birthday dep", "ddn", "clay play", "date night"],
    },
    {
      id: "donations",
      name: "Donations",
      color: "#818cf8",
      keywords: ["tag sale donation", "donation", "firing"],
    },
    {
      id: "local-artists",
      name: "Local Artists",
      color: "#c084fc",
      keywords: ["local artists", "roberta baker", "patricia "],
    },
    {
      id: "professional-services",
      name: "Professional Services",
      color: "#f472b6",
      keywords: ["prof fee", "special rate private lesson", "pottery wheel lessons", "special pottery", "nceca shipping"],
    },
  ],
};

const RETAIL_PROFILE: CategoryProfile = {
  id: "retail",
  name: "Retail Store",
  uncategorizedLabel: "Other",
  rules: [
    { id: "apparel", name: "Apparel", color: "#f87171", keywords: ["shirt", "pants", "dress", "jacket", "hat", "shoes", "clothing"] },
    { id: "electronics", name: "Electronics", color: "#38bdf8", keywords: ["phone", "laptop", "tablet", "charger", "cable", "adapter"] },
    { id: "home", name: "Home & Garden", color: "#4ade80", keywords: ["furniture", "decor", "garden", "plant", "candle", "pillow"] },
    { id: "food", name: "Food & Beverage", color: "#fb923c", keywords: ["coffee", "tea", "snack", "chocolate", "wine", "beer"] },
    { id: "beauty", name: "Beauty & Health", color: "#c084fc", keywords: ["soap", "cream", "shampoo", "lotion", "vitamin"] },
  ],
};

const FOOD_BEV_PROFILE: CategoryProfile = {
  id: "food-bev",
  name: "Food & Beverage",
  uncategorizedLabel: "Other",
  rules: [
    { id: "entrees", name: "Entrees", color: "#f87171", keywords: ["burger", "sandwich", "pizza", "pasta", "steak", "chicken", "fish", "salad"] },
    { id: "drinks", name: "Drinks", color: "#38bdf8", keywords: ["coffee", "latte", "tea", "juice", "smoothie", "soda", "water", "beer", "wine", "cocktail"] },
    { id: "appetizers", name: "Appetizers", color: "#facc15", keywords: ["appetizer", "starter", "soup", "fries", "wings", "nachos"] },
    { id: "desserts", name: "Desserts", color: "#c084fc", keywords: ["cake", "cookie", "pie", "ice cream", "brownie", "pastry", "muffin"] },
    { id: "sides", name: "Sides", color: "#4ade80", keywords: ["side", "rice", "beans", "bread", "roll"] },
  ],
};

export const PRESET_PROFILES: CategoryProfile[] = [
  ARTS_STUDIO_PROFILE,
  RETAIL_PROFILE,
  FOOD_BEV_PROFILE,
];

// ─── Categorization Engine ──────────────────────────────────

/**
 * Apply a category profile's rules to a single item name.
 * Returns the matching category name or the uncategorized label.
 */
export function categorizeItem(
  itemName: string,
  profile: CategoryProfile,
  vendor?: string,
  tags?: string
): string {
  if (!itemName) return profile.uncategorizedLabel;
  const lower = itemName.toLowerCase();
  const lowerVendor = (vendor || "").toLowerCase();
  const lowerTags = (tags || "").toLowerCase();

  for (const rule of profile.rules) {
    // Keyword match on item name
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return rule.name;
    }
    // Vendor match
    if (rule.vendors?.some((v) => lowerVendor.includes(v.toLowerCase()))) {
      return rule.name;
    }
    // Tags match
    if (rule.tags?.some((t) => lowerTags.includes(t.toLowerCase()))) {
      return rule.name;
    }
  }

  return profile.uncategorizedLabel;
}

/**
 * Apply a category profile to all line items in orders.
 * Returns new orders with updated categories (does not mutate originals).
 */
export function applyCategories(
  orders: Order[],
  profile: CategoryProfile
): Order[] {
  return orders.map((order) => ({
    ...order,
    lineItems: order.lineItems.map((li) => ({
      ...li,
      category: categorizeItem(li.name, profile, order.vendor, order.tags),
    })),
  }));
}

/**
 * Auto-detect categories from product names using keyword clustering.
 * Groups items by shared significant words, then creates rules.
 */
export function autoDetectCategories(orders: Order[]): CategoryProfile {
  // Collect all unique item names
  const itemNames = new Set<string>();
  for (const order of orders) {
    for (const li of order.lineItems) {
      if (li.name) itemNames.add(li.name);
    }
  }

  const names = Array.from(itemNames);
  if (names.length === 0) {
    return { id: "auto", name: "Auto-detected", rules: [], uncategorizedLabel: "Other" };
  }

  // Stop words to ignore
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for",
    "is", "it", "by", "with", "from", "as", "was", "be", "are", "this",
    "that", "which", "each", "per", "no", "not", "-", "&", "+", "x",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  ]);

  // Count word frequencies across all items
  const wordCounts = new Map<string, Set<string>>();
  for (const name of names) {
    const words = name.toLowerCase().split(/[\s\-\/,()]+/).filter(
      (w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w)
    );
    for (const word of words) {
      if (!wordCounts.has(word)) wordCounts.set(word, new Set());
      wordCounts.get(word)!.add(name);
    }
  }

  // Find significant words (appearing in 2+ items but < 70% of all items)
  const significant = Array.from(wordCounts.entries())
    .filter(([, items]) => items.size >= 2 && items.size < names.length * 0.7)
    .sort((a, b) => b[1].size - a[1].size);

  // Greedily assign categories from most common keywords
  const assigned = new Set<string>();
  const rules: CategoryRule[] = [];
  const palette = [
    "#f87171", "#fb923c", "#facc15", "#4ade80", "#2dd4bf",
    "#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#a3e635",
    "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#fb7185",
  ];

  for (const [word, items] of significant) {
    if (rules.length >= 12) break;
    // Skip if most items in this group are already assigned
    const unassigned = Array.from(items).filter((n) => !assigned.has(n));
    if (unassigned.length < 2) continue;

    const categoryName = word.charAt(0).toUpperCase() + word.slice(1);
    rules.push({
      id: `auto-${word}`,
      name: categoryName,
      color: palette[rules.length % palette.length],
      keywords: [word],
    });

    for (const name of items) {
      assigned.add(name);
    }
  }

  // Also try vendor-based grouping
  const vendorCounts = new Map<string, number>();
  for (const order of orders) {
    if (order.vendor) {
      vendorCounts.set(order.vendor, (vendorCounts.get(order.vendor) || 0) + 1);
    }
  }
  for (const [vendor, count] of vendorCounts) {
    if (count >= 2 && rules.length < 12 && vendor.trim()) {
      // Check if this vendor isn't already covered by a keyword rule
      const vendorLower = vendor.toLowerCase();
      const alreadyCovered = rules.some((r) =>
        r.keywords.some((k) => vendorLower.includes(k.toLowerCase()))
      );
      if (!alreadyCovered) {
        rules.push({
          id: `auto-vendor-${vendor.toLowerCase().replace(/\s+/g, "-")}`,
          name: vendor,
          color: palette[rules.length % palette.length],
          keywords: [],
          vendors: [vendor],
        });
      }
    }
  }

  return {
    id: "auto",
    name: "Auto-detected",
    rules,
    uncategorizedLabel: "Other",
  };
}

/**
 * Check if a profile likely matches the data well.
 * Returns the percentage of items that get categorized (not "Other").
 */
export function profileMatchScore(orders: Order[], profile: CategoryProfile): number {
  let total = 0;
  let matched = 0;
  for (const order of orders) {
    for (const li of order.lineItems) {
      total++;
      const cat = categorizeItem(li.name, profile, order.vendor, order.tags);
      if (cat !== profile.uncategorizedLabel) matched++;
    }
  }
  return total > 0 ? (matched / total) * 100 : 0;
}

/**
 * Select the best profile for the data.
 * Tries NWCT preset first (backward compat), then auto-detect if < 30% match.
 */
export function selectBestProfile(orders: Order[]): CategoryProfile {
  // Try NWCT preset first for backward compatibility
  const nwctScore = profileMatchScore(orders, ARTS_STUDIO_PROFILE);
  if (nwctScore >= 30) return ARTS_STUDIO_PROFILE;

  // Try other presets
  for (const preset of PRESET_PROFILES.slice(1)) {
    const score = profileMatchScore(orders, preset);
    if (score >= 30) return preset;
  }

  // Fall back to auto-detection
  return autoDetectCategories(orders);
}
