"use client";

import type { CampEnrollmentRow } from "../lib/types";

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

interface Props {
  data: CampEnrollmentRow[];
}

export default function CampEnrollment({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Camp Enrollment
        </h3>
        <p className="text-sm text-muted-foreground">
          No camp enrollments found in this data.
        </p>
      </div>
    );
  }

  const totals = data.reduce(
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
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Camp Enrollment
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Program</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Enrollments</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Total Revenue</th>
              <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Paid</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.program} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium text-foreground">{row.program}</td>
                <td className="py-2 pr-4 text-right text-foreground">{row.enrollments}</td>
                <td className="py-2 pr-4 text-right text-foreground">{fmt(row.totalRevenue)}</td>
                <td className="py-2 pr-4 text-right text-emerald-400">{fmt(row.paidRevenue)}</td>
                <td className="py-2 text-right text-orange-400">
                  {row.outstanding > 0 ? fmt(row.outstanding) : "—"}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-2 pr-4 text-foreground">Total</td>
              <td className="py-2 pr-4 text-right text-foreground">{totals.enrollments}</td>
              <td className="py-2 pr-4 text-right text-foreground">{fmt(totals.totalRevenue)}</td>
              <td className="py-2 pr-4 text-right text-emerald-400">{fmt(totals.paidRevenue)}</td>
              <td className="py-2 text-right text-orange-400">
                {totals.outstanding > 0 ? fmt(totals.outstanding) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
