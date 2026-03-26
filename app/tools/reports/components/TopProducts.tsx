"use client";

import type { TopProduct } from "../lib/types";
import { makeCurrencyFormatter } from "../lib/currency";

interface Props {
  data: TopProduct[];
  currency: string;
}

export default function TopProducts({ data, currency }: Props) {
  const fmt = makeCurrencyFormatter(currency);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Top 10 Products
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted-foreground">#</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Product</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Category</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Qty</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={item.name} className="border-b border-border/50">
                <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-4 font-medium text-foreground">{item.name}</td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.category}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right text-foreground">{item.quantity}</td>
                <td className="py-2 text-right font-medium text-emerald-400">
                  {fmt(item.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
