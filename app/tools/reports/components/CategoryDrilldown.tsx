"use client";

import { useState, useMemo } from "react";
import type { CategoryDrilldownRow } from "../lib/types";
import { makeCurrencyFormatter } from "../lib/currency";

interface Props {
  data: CategoryDrilldownRow[];
  currency: string;
}

export default function CategoryDrilldown({ data, currency }: Props) {
  const fmt = makeCurrencyFormatter(currency);
  // Get unique categories sorted by total revenue
  const categories = useMemo(() => {
    const catRevenue = new Map<string, number>();
    for (const row of data) {
      catRevenue.set(row.category, (catRevenue.get(row.category) || 0) + row.totalRevenue);
    }
    return Array.from(catRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [data]);

  // Default to highest-revenue category
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const activeCategory = selectedCategory || categories[0] || "";

  const filtered = useMemo(
    () => data.filter((row) => row.category === activeCategory),
    [data, activeCategory]
  );

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Category Deep Dive
        </h3>
        <p className="text-sm text-muted-foreground">
          No items found in this data.
        </p>
      </div>
    );
  }

  const totals = filtered.reduce(
    (acc, row) => ({
      enrollments: acc.enrollments + row.enrollments,
      totalRevenue: acc.totalRevenue + row.totalRevenue,
      paidRevenue: acc.paidRevenue + row.paidRevenue,
      outstanding: acc.outstanding + row.outstanding,
    }),
    { enrollments: 0, totalRevenue: 0, paidRevenue: 0, outstanding: 0 }
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Category Deep Dive
        </h3>
        <select
          value={activeCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          title="Select a category to drill down into"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted-foreground" title="Product or service name">Item</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground" title="Quantity sold">Qty</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground" title="Total revenue for this item">Total Revenue</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground" title="Revenue from paid orders">Paid</th>
              <th className="pb-2 text-right font-medium text-muted-foreground" title="Outstanding balance">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.program} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium text-foreground">{row.program}</td>
                <td className="py-2 pr-4 text-right text-foreground">{row.enrollments}</td>
                <td className="py-2 pr-4 text-right text-foreground">{fmt(row.totalRevenue)}</td>
                <td className="py-2 pr-4 text-right text-emerald-700">{fmt(row.paidRevenue)}</td>
                <td className="py-2 text-right text-orange-700">
                  {row.outstanding > 0 ? fmt(row.outstanding) : "—"}
                </td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2 pr-4 text-foreground">Total</td>
                <td className="py-2 pr-4 text-right text-foreground">{totals.enrollments}</td>
                <td className="py-2 pr-4 text-right text-foreground">{fmt(totals.totalRevenue)}</td>
                <td className="py-2 pr-4 text-right text-emerald-700">{fmt(totals.paidRevenue)}</td>
                <td className="py-2 text-right text-orange-700">
                  {totals.outstanding > 0 ? fmt(totals.outstanding) : "—"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
