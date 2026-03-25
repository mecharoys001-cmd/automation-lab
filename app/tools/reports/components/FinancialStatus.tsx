"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { FinancialStatusBreakdown } from "../lib/types";

const STATUS_COLORS: Record<string, string> = {
  paid: "#10b981",
  pending: "#f59e0b",
  partially_paid: "#f97316",
  refunded: "#ef4444",
  authorized: "#3b82f6",
  voided: "#6b7280",
  unknown: "#9ca3af",
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function statusLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  data: FinancialStatusBreakdown[];
}

export default function FinancialStatus({ data }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Financial Status
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={false}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_COLORS[entry.status] || "#6b7280"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={((value: number, name: string) => [fmt(value), statusLabel(name)]) as any}
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#f3f4f6",
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              itemStyle={{ color: "#e5e7eb" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Status breakdown below chart */}
      <div className="mt-4 space-y-1.5">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[entry.status] || "#6b7280" }}
              />
              <span className="text-foreground">{statusLabel(entry.status)}</span>
            </div>
            <span className="font-medium text-foreground font-semibold">
              {fmt(entry.amount)} ({entry.count} orders)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
