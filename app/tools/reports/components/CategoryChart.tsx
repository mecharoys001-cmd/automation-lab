"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CategoryBreakdown } from "../lib/types";
import { CATEGORY_COLORS as COLORS, TOOLTIP_STYLE } from "../lib/colors";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

interface Props {
  data: CategoryBreakdown[];
}

export default function CategoryChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Revenue by Category
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={2}
              label={false}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={((value: number) => fmt(value)) as any}
              contentStyle={{
                ...TOOLTIP_STYLE,
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              itemStyle={{ color: "#e5e7eb" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Breakdown list — replaces in-chart labels */}
      <div className="mt-4 space-y-1.5">
        {data.map((item, i) => (
          <div key={item.category} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-foreground">{item.category}</span>
            </div>
            <span className="font-medium text-foreground font-semibold">
              {fmt(item.revenue)} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
