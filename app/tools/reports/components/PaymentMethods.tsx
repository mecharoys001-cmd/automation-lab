"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { PaymentMethodBreakdown } from "../lib/types";
import { PAYMENT_COLORS as COLORS, TOOLTIP_STYLE } from "../lib/colors";
import { makeCurrencyFormatter, currencySymbol } from "../lib/currency";

interface Props {
  data: PaymentMethodBreakdown[];
  currency: string;
}

export default function PaymentMethods({ data, currency }: Props) {
  const fmt = makeCurrencyFormatter(currency);
  const sym = currencySymbol(currency);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Payment Methods
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v) => `${sym}${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="method"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              width={140}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: number) => [fmt(value), "Amount"]) as any}
              contentStyle={{
                ...TOOLTIP_STYLE,
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
