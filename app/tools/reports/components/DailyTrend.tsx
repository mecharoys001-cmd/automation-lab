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
import type { DailyRevenue } from "../lib/types";
import { TOOLTIP_STYLE } from "../lib/colors";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

interface Props {
  data: DailyRevenue[];
  colorMap: Record<string, string>;
}

export default function DailyTrend({ data, colorMap }: Props) {
  const allCategories = new Set<string>();
  for (const day of data) {
    for (const cat of Object.keys(day.categories)) {
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
              tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
              tickFormatter={(v) => {
                const d = new Date(v + "T00:00:00");
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              formatter={((value: number, name: string) => [fmt(value), name]) as any}
              contentStyle={{
                ...TOOLTIP_STYLE,
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              itemStyle={{ color: "#e2e8f0", padding: "2px 0" }}
              labelStyle={{ color: "#f8fafc", fontWeight: 600, marginBottom: "4px" }}
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
                fill={colorMap[cat] || "#888"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {Array.from(allCategories).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-foreground">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: colorMap[cat] || "#888" }}
            />
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
}
