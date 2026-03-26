"use client";

import { useRef, useState, useCallback } from "react";
import type { DashboardData, CategoryProfile } from "../lib/types";
import { encodeShareData } from "../lib/share";
import { assignCategoryColors, buildRuleColorMap } from "../lib/colors";
import SummaryCards from "./SummaryCards";
import CategoryChart from "./CategoryChart";
import DailyTrend from "./DailyTrend";
import PaymentMethods from "./PaymentMethods";
import TopProducts from "./TopProducts";
import CategoryDrilldown from "./CategoryDrilldown";
import FinancialStatus from "./FinancialStatus";

interface Props {
  data: DashboardData;
  fileName: string;
  onReset: () => void;
  isSharedView?: boolean;
  onEditCategories?: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  shopify: "Shopify",
  square: "Square",
  woocommerce: "WooCommerce",
  stripe: "Stripe",
  generic: "CSV",
};

export default function Dashboard({ data, fileName, onReset, isSharedView, onEditCategories }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shortening" | "copied" | "error">("idle");

  // Build dynamic color map from category profile
  const categoryColorMap = (() => {
    const categories = data.categoryBreakdown.map((c) => c.category);
    const ruleColors = data.categoryProfile
      ? buildRuleColorMap(data.categoryProfile.rules)
      : undefined;
    return assignCategoryColors(categories, ruleColors);
  })();

  const shareReport = useCallback(async () => {
    try {
      setShareStatus("shortening");
      const encoded = encodeShareData(data, fileName);

      let shareUrl: string;
      try {
        const res = await fetch("/api/reports/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: encoded }),
        });
        if (res.ok) {
          const { id } = await res.json();
          shareUrl = `${window.location.origin}/tools/reports?s=${id}`;
        } else {
          shareUrl = `${window.location.origin}${window.location.pathname}#d=${encoded}`;
        }
      } catch {
        shareUrl = `${window.location.origin}${window.location.pathname}#d=${encoded}`;
      }

      await navigator.clipboard.writeText(shareUrl);
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
      const computedBg = getComputedStyle(document.documentElement).getPropertyValue("--background")?.trim();
      const bgColor = computedBg ? `hsl(${computedBg})` : "#ffffff";

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: bgColor,
        logging: false,
        windowWidth: el.scrollWidth,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdfWidth = 842;
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
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, "F");
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, "F");
      }

      const dateSlug = `${data.dateRange.start} to ${data.dateRange.end}`.replace(/[^a-zA-Z0-9]/g, "_");
      pdf.save(`Sales_Report_${dateSlug}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Check console for details.");
    } finally {
      setExporting(false);
    }
  }, [data.dateRange]);

  const currency = data.detectedCurrency || "USD";

  const platformLabel = data.detectedPlatform
    ? PLATFORM_LABELS[data.detectedPlatform] || data.detectedPlatform
    : null;

  return (
    <div className="space-y-6">
      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
        {onEditCategories && !isSharedView && (
          <button
            onClick={onEditCategories}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            title="Edit how products are grouped into categories"
          >
            Edit Categories
          </button>
        )}
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
            ? "Link Copied!"
            : shareStatus === "error"
            ? "Failed to copy"
            : shareStatus === "shortening"
            ? "Shortening..."
            : "Share Interactive Link"}
        </button>
        <button
          onClick={exportPDF}
          disabled={exporting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export dashboard as PDF"
        >
          {exporting ? "Generating PDF..." : "Export PDF"}
        </button>
        {!isSharedView && (
          <button
            onClick={onReset}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            title="Upload a different file"
          >
            Upload New File
          </button>
        )}
      </div>

      {/* Captured for PDF */}
      <div ref={reportRef} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Village Center of the Arts Sales Analytics
          </h2>
          <p className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
            {data.dateRange.start} — {data.dateRange.end}
          </p>
          <p className="text-sm text-muted-foreground">
            {fileName} · {data.totalOrders} orders
            {platformLabel && (
              <span
                className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs"
                title={`Detected platform: ${platformLabel}`}
              >
                {platformLabel}
              </span>
            )}
          </p>
        </div>

        <SummaryCards
          totalRevenue={data.totalRevenue}
          totalOrders={data.totalOrders}
          taxCollected={data.taxCollected}
          outstandingBalance={data.outstandingBalance}
          refundTotal={data.refundTotal}
          currency={currency}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CategoryChart data={data.categoryBreakdown} colorMap={categoryColorMap} currency={currency} />
          <FinancialStatus data={data.financialStatus} currency={currency} />
        </div>

        <DailyTrend data={data.dailyRevenue} colorMap={categoryColorMap} currency={currency} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PaymentMethods data={data.paymentMethods} currency={currency} />
          <TopProducts data={data.topProducts} currency={currency} />
        </div>

        <CategoryDrilldown data={data.categoryDrilldown} currency={currency} />
      </div>
    </div>
  );
}
