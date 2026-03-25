"use client";

import { useRef, useState, useCallback } from "react";
import type { DashboardData } from "../lib/types";
import { encodeShareData } from "../lib/share";
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
  const [shareStatus, setShareStatus] = useState<"idle" | "shortening" | "copied" | "error">("idle");

  const shareReport = useCallback(async () => {
    try {
      setShareStatus("shortening");
      const encoded = encodeShareData(data, fileName);
      const longUrl = `${window.location.origin}${window.location.pathname}#d=${encoded}`;
      
      // Shorten via TinyURL (free, no auth)
      let shortUrl: string;
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (res.ok) {
          shortUrl = await res.text();
        } else {
          shortUrl = longUrl; // Fallback to long URL
        }
      } catch {
        shortUrl = longUrl; // Fallback if TinyURL is down
      }
      
      await navigator.clipboard.writeText(shortUrl);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 3000);
    } catch (err) {
      console.error("Share failed:", err);
      setShareStatus("error");
      setTimeout(() => setShareStatus("idle"), 3000);
    }
  }, [data, fileName]);

  const exportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setExporting(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const el = reportRef.current;

      // Detect actual background color from the page
      const computedBg = getComputedStyle(document.documentElement).getPropertyValue("--background")?.trim();
      const bgColor = computedBg ? `hsl(${computedBg})` : "#ffffff";

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: bgColor,
        logging: false,
        // Ensure full width capture even if scrolled
        windowWidth: el.scrollWidth,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdfWidth = 842; // A4 landscape
      const pdfHeight = 595;
      const margin = 24;

      const contentWidth = pdfWidth - margin * 2;
      const scaleFactor = contentWidth / imgWidth;
      const scaledHeight = imgHeight * scaleFactor;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      // Multi-page with clipping to avoid content bleeding across pages
      const pageContentHeight = pdfHeight - margin * 2;
      const totalPages = Math.ceil(scaledHeight / pageContentHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        pdf.addImage(
          imgData,
          "PNG",
          margin,
          margin - page * pageContentHeight,
          imgWidth * scaleFactor,
          scaledHeight
        );

        // White-out overflow at top and bottom to prevent bleed
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, "F");
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, "F");
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
      {/* Buttons — outside capture area */}
      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        <button
          onClick={shareReport}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
            shareStatus === "copied"
              ? "bg-emerald-600"
              : shareStatus === "error"
              ? "bg-red-600"
              : shareStatus === "shortening"
              ? "bg-purple-500 cursor-wait"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
          disabled={shareStatus === "shortening"}
          title="Copy a shareable link with full interactive dashboard"
        >
          {shareStatus === "copied"
            ? "✅ Link Copied!"
            : shareStatus === "error"
            ? "❌ Failed to copy"
            : shareStatus === "shortening"
            ? "⏳ Shortening..."
            : "🔗 Share Interactive Link"}
        </button>
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

      {/* Everything below is captured for PDF */}
      <div ref={reportRef} className="space-y-6">
        {/* Header — included in PDF */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Transaction Report
          </h2>
          <p className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
            📅 {data.dateRange.start} — {data.dateRange.end}
          </p>
          <p className="text-sm text-muted-foreground">
            {fileName} · {data.totalOrders} orders
          </p>
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
    </div>
  );
}
