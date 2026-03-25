"use client";

import { useRef, useState, useCallback } from "react";
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
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setExporting(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const el = reportRef.current;

      // Capture at 2x for crisp output
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#111827",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Letter size in points: 612 x 792
      // Use landscape for wider charts
      const pdfWidth = 842; // A4 landscape width in points
      const pdfHeight = 595; // A4 landscape height in points
      const margin = 20;

      const contentWidth = pdfWidth - margin * 2;
      const scaleFactor = contentWidth / imgWidth;
      const scaledHeight = imgHeight * scaleFactor;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      // Multi-page: slice the image across pages
      let yOffset = 0;
      let page = 0;
      const pageContentHeight = pdfHeight - margin * 2;

      while (yOffset < scaledHeight) {
        if (page > 0) pdf.addPage();

        pdf.addImage(
          imgData,
          "PNG",
          margin,
          margin - yOffset,
          imgWidth * scaleFactor,
          scaledHeight
        );

        yOffset += pageContentHeight;
        page++;
      }

      const dateSlug = `${data.dateRange.start} to ${data.dateRange.end}`.replace(/[^a-zA-Z0-9]/g, "_");
      pdf.save(`Transaction_Report_${dateSlug}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Check console for details.");
    } finally {
      setExporting(false);
    }
  }, [data.dateRange]);

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
        <div className="flex gap-3">
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export dashboard as PDF"
          >
            {exporting ? "⏳ Generating PDF..." : "📄 Export PDF"}
          </button>
          <button
            onClick={onReset}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            title="Upload a different file"
          >
            Upload New File
          </button>
        </div>
      </div>

      {/* Report content — captured for PDF */}
      <div ref={reportRef} className="space-y-6">
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
    </div>
  );
}
