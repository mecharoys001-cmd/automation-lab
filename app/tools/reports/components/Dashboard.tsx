"use client";

import type { DashboardData } from "../lib/types";
import SummaryCards from "./SummaryCards";
import CategoryChart from "./CategoryChart";
import DailyTrend from "./DailyTrend";
import PaymentMethods from "./PaymentMethods";
import TopProducts from "./TopProducts";
import CampEnrollment from "./CampEnrollment";
import FinancialStatus from "./FinancialStatus";

interface Props {
  data: DashboardData;
  fileName: string;
  onReset: () => void;
}

export default function Dashboard({ data, fileName, onReset }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Transaction Report
          </h2>
          <p className="mt-1 text-lg font-semibold text-blue-400">
            📅 {data.dateRange.start} &mdash; {data.dateRange.end}
          </p>
          <p className="text-sm text-muted-foreground">
            {fileName} &mdash; {data.totalOrders} orders
          </p>
        </div>
        <button
          onClick={onReset}
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          title="Upload a different file"
        >
          Upload New File
        </button>
      </div>

      {/* Summary */}
      <SummaryCards
        totalRevenue={data.totalRevenue}
        totalOrders={data.totalOrders}
        taxCollected={data.taxCollected}
        outstandingBalance={data.outstandingBalance}
        refundTotal={data.refundTotal}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryChart data={data.categoryBreakdown} />
        <FinancialStatus data={data.financialStatus} />
      </div>

      {/* Daily trend full width */}
      <DailyTrend data={data.dailyRevenue} />

      {/* Payment + Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentMethods data={data.paymentMethods} />
        <TopProducts data={data.topProducts} />
      </div>

      {/* Camp enrollment full width */}
      <CampEnrollment data={data.campEnrollment} />
    </div>
  );
}
