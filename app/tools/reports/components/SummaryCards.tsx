"use client";

interface Props {
  totalRevenue: number;
  totalOrders: number;
  taxCollected: number;
  outstandingBalance: number;
  refundTotal: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

const cards = [
  { key: "totalRevenue", label: "Total Revenue", icon: "💰", color: "text-emerald-400" },
  { key: "totalOrders", label: "Total Orders", icon: "📦", color: "text-blue-400" },
  { key: "taxCollected", label: "Tax Collected", icon: "🏛️", color: "text-amber-400" },
  { key: "outstandingBalance", label: "Outstanding Balance", icon: "⏳", color: "text-orange-400" },
  { key: "refundTotal", label: "Refund Total", icon: "↩️", color: "text-red-400" },
] as const;

export default function SummaryCards(props: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ key, label, icon, color }) => {
        const value = props[key];
        return (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-4 shadow-md"
            title={label}
          >
            <div className="mb-1 text-sm text-muted-foreground">
              <span className="mr-1.5">{icon}</span>
              {label}
            </div>
            <div className={`text-2xl font-bold ${color}`}>
              {key === "totalOrders"
                ? value.toLocaleString()
                : fmt(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
