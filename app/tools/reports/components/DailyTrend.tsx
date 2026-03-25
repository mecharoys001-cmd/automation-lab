"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DailyRevenue, TransactionCategory } from "../lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  "Summer Camps": "#10b981",
  Classes: "#3b82f6",
  "Open Studio": "#f59e0b",
  "Ceramics Retail": "#ef4444",
  Supplies: "#8b5cf6",
  Events: "#ec4899",
  Donations: "#14b8a6",
  "Local Artists": "#f97316",
  "Professional Services": "#6366f1",
  Other: "#84cc16",
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

interface Props {
  data: DailyRevenue[];
}

export default function DailyTrend({ data }: Props) {
  const allCategories = new Set<TransactionCategory>();
  for (const day of data) {
    for (const cat of Object.keys(day.categories) as TransactionCategory[]) {
      if (day.categories[cat]! > 0) allCategories.add(cat);
    }
  }

  const chartData = data.map((d) => ({
    date: d.date,
    ...d.categories,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Daily Revenue Trend
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v) => {
                const d = new Date(v + "T00:00:00");
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              formatter={(value: number, name: string) => [fmt(value), name]}
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#f3f4f6",
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              itemStyle={{ color: "#e5e7eb", padding: "2px 0" }}
              labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: "4px" }}
              labelFormatter={(label) => {
                const d = new Date(label + "T00:00:00");
                return d.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            {Array.from(allCategories).map((cat) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="revenue"
                fill={CATEGORY_COLORS[cat] || "#888"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend below chart to avoid overlap */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {Array.from(allCategories).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-gray-300">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: CATEGORY_COLORS[cat] || "#888" }}
            />
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
}
