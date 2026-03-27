"use client";

import { useState, useMemo } from "react";
import type { CategoryProfile, CategoryRule, Order } from "../lib/types";
import { PRESET_PROFILES, categorizeItem } from "../lib/categorize";
import { CATEGORY_COLORS } from "../lib/colors";

interface Props {
  orders: Order[];
  profile: CategoryProfile;
  onApply: (profile: CategoryProfile) => void;
  onClose: () => void;
}

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function CategoryEditor({ orders, profile: initialProfile, onApply, onClose }: Props) {
  const [profile, setProfile] = useState<CategoryProfile>(() => ({
    ...initialProfile,
    rules: initialProfile.rules.map((r) => ({ ...r })),
  }));
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Compute items per category
  const categorization = useMemo(() => {
    const catItems = new Map<string, { name: string; count: number; revenue: number }[]>();
    const itemMap = new Map<string, { count: number; revenue: number; category: string }>();

    for (const order of orders) {
      for (const li of order.lineItems) {
        const cat = categorizeItem(li.name, profile, order.vendor, order.tags);
        const key = `${cat}::${li.name}`;
        const existing = itemMap.get(key) || { count: 0, revenue: 0, category: cat };
        existing.count += li.quantity;
        existing.revenue += li.price * li.quantity;
        itemMap.set(key, existing);
      }
    }

    for (const [key, data] of itemMap) {
      const [cat, name] = key.split("::");
      if (!catItems.has(cat)) catItems.set(cat, []);
      catItems.get(cat)!.push({ name, ...data });
    }

    // Sort items within each category by revenue
    for (const items of catItems.values()) {
      items.sort((a, b) => b.revenue - a.revenue);
    }

    return catItems;
  }, [orders, profile]);

  const categoryStats = useMemo(() => {
    const stats: { name: string; itemCount: number; revenue: number; color: string }[] = [];
    for (const rule of profile.rules) {
      const items = categorization.get(rule.name) || [];
      stats.push({
        name: rule.name,
        itemCount: items.reduce((s, i) => s + i.count, 0),
        revenue: items.reduce((s, i) => s + i.revenue, 0),
        color: rule.color,
      });
    }
    // Uncategorized
    const uncatItems = categorization.get(profile.uncategorizedLabel) || [];
    if (uncatItems.length > 0) {
      stats.push({
        name: profile.uncategorizedLabel,
        itemCount: uncatItems.reduce((s, i) => s + i.count, 0),
        revenue: uncatItems.reduce((s, i) => s + i.revenue, 0),
        color: "#64748b",
      });
    }
    return stats;
  }, [categorization, profile]);

  const updateRule = (ruleId: string, updates: Partial<CategoryRule>) => {
    setProfile((prev) => ({
      ...prev,
      rules: prev.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    }));
  };

  const addRule = () => {
    const colorIdx = profile.rules.length % CATEGORY_COLORS.length;
    const newRule: CategoryRule = {
      id: generateId(),
      name: "New Category",
      color: CATEGORY_COLORS[colorIdx],
      keywords: [],
    };
    setProfile((prev) => ({ ...prev, rules: [...prev.rules, newRule] }));
    setExpandedRule(newRule.id);
  };

  const removeRule = (ruleId: string) => {
    setProfile((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
  };

  const loadPreset = (preset: CategoryProfile) => {
    setProfile({
      ...preset,
      rules: preset.rules.map((r) => ({ ...r })),
    });
  };

  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Category Editor
        </h3>
        <div className="flex gap-2">
          <select
            onChange={(e) => {
              const preset = PRESET_PROFILES.find((p) => p.id === e.target.value);
              if (preset) loadPreset(preset);
              e.target.value = "";
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            defaultValue=""
            title="Load a preset category profile"
          >
            <option value="" disabled>Load Preset...</option>
            {PRESET_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Review and edit how products are categorized. Add keywords to match product names to categories.
      </p>

      {/* Category list */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {categoryStats.map((stat) => {
          const rule = profile.rules.find((r) => r.name === stat.name);
          const isExpanded = rule && expandedRule === rule.id;
          const items = categorization.get(stat.name) || [];

          return (
            <div
              key={stat.name}
              className="rounded-lg border border-border/50 bg-background p-3"
            >
              {/* Category header row */}
              <div
                className="flex cursor-pointer items-center justify-between"
                onClick={() => rule && setExpandedRule(isExpanded ? null : rule.id)}
                title={rule ? "Click to expand and edit category rules" : "Uncategorized items"}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  {rule ? (
                    <input
                      type="text"
                      value={rule.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                      className="bg-transparent text-sm font-medium text-foreground border-b border-transparent focus:border-border outline-none"
                      title="Edit category name"
                    />
                  ) : (
                    <span className="text-sm font-medium text-foreground">{stat.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span title="Number of items">{stat.itemCount} items</span>
                  <span title="Total revenue">{fmtCurrency(stat.revenue)}</span>
                  {rule && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRule(rule.id); }}
                      className="text-red-700 hover:text-red-800"
                      title="Remove this category"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded rule editor */}
              {isExpanded && rule && (
                <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                  <div>
                    <label className="text-xs text-muted-foreground" title="Comma-separated keywords that match product names">
                      Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={rule.keywords.join(", ")}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                      title="Enter keywords that match product names to this category"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground" title="Color for charts">Color</label>
                    <input
                      type="color"
                      value={rule.color}
                      onChange={(e) => updateRule(rule.id, { color: e.target.value })}
                      className="ml-2 h-6 w-8 cursor-pointer rounded border border-border"
                      title="Pick a color for this category in charts"
                    />
                  </div>
                  {/* Items in this category */}
                  {items.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Items ({items.length}):</p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {items.slice(0, 20).map((item) => (
                          <div key={item.name} className="flex justify-between text-xs text-foreground/80">
                            <span className="truncate mr-2">{item.name}</span>
                            <span className="shrink-0">{fmtCurrency(item.revenue)}</span>
                          </div>
                        ))}
                        {items.length > 20 && (
                          <p className="text-xs text-muted-foreground">...and {items.length - 20} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={addRule}
          className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          title="Add a new category rule"
        >
          + Add Category
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            title="Close without applying changes"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(profile)}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            title="Apply category changes and regenerate dashboard"
          >
            Apply Categories
          </button>
        </div>
      </div>
    </div>
  );
}
