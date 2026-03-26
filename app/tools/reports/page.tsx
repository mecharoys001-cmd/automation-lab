"use client";

import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { parseCSVData } from "./lib/parseCSV";
import { decodeShareData } from "./lib/share";
import { detectPlatform } from "./lib/platforms";
import type { DashboardData, ColumnMapping, CategoryProfile, PlatformId, RawCSVRow } from "./lib/types";
import Dashboard from "./components/Dashboard";
import ColumnMapper from "./components/ColumnMapper";
import CategoryEditor from "./components/CategoryEditor";
import { trackToolUsage, hashCSVContent } from "@/lib/usage-tracking";

const PLATFORM_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  shopify: {
    title: "How to export from Shopify:",
    steps: [
      "Go to Shopify Admin \u2192 Orders",
      "Set the date range filter",
      "Click \u201cExport\u201d \u2192 \u201cAll orders\u201d \u2192 CSV for Excel",
      "Upload the downloaded file here",
    ],
  },
  square: {
    title: "How to export from Square:",
    steps: [
      "Go to Square Dashboard \u2192 Transactions",
      "Set the date range and click \u201cExport\u201d",
      "Choose CSV format and download",
      "Upload the downloaded file here",
    ],
  },
  woocommerce: {
    title: "How to export from WooCommerce:",
    steps: [
      "Go to WooCommerce \u2192 Orders",
      "Click \u201cExport\u201d at the top",
      "Select date range and columns, then download CSV",
      "Upload the downloaded file here",
    ],
  },
  stripe: {
    title: "How to export from Stripe:",
    steps: [
      "Go to Stripe Dashboard \u2192 Payments",
      "Click \u201cExport\u201d in the top right",
      "Select date range and download as CSV",
      "Upload the downloaded file here",
    ],
  },
};

type ViewState = "upload" | "column-mapper" | "dashboard" | "category-editor";

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("upload");

  // For column mapper flow
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  // Saved profile from localStorage
  const [savedProfileKey, setSavedProfileKey] = useState<string | null>(null);

  // On mount, check for shared data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("s");

    if (shareId) {
      fetch(`/api/reports/share?id=${encodeURIComponent(shareId)}`)
        .then((res) => res.ok ? res.json() : Promise.reject("Not found"))
        .then(({ data: encoded }) => {
          const result = decodeShareData(encoded);
          if (result) {
            setData(result.data);
            setFileName(result.fileName);
            setIsSharedView(true);
            setViewState("dashboard");
          }
        })
        .catch(() => setError("Shared report not found or expired."));
      return;
    }

    const hash = window.location.hash.slice(1);
    if (!hash || !hash.startsWith("d=")) return;

    const encoded = hash.slice(2);
    const result = decodeShareData(encoded);
    if (result) {
      setData(result.data);
      setFileName(result.fileName);
      setIsSharedView(true);
      setViewState("dashboard");
    }
  }, []);

  const processCSV = useCallback((text: string, file: File, customMapping?: ColumnMapping) => {
    try {
      // Load saved category profile if available
      let categoryProfile: CategoryProfile | undefined;
      try {
        const saved = localStorage.getItem("reports-profile");
        if (saved) {
          const parsed = JSON.parse(saved);
          categoryProfile = parsed.categoryProfile;
        }
      } catch { /* ignore */ }

      const parsed = parseCSVData(text, { customMapping, categoryProfile });
      if (parsed.totalOrders === 0) {
        setError("No orders found in the CSV. Check the file format.");
        return;
      }
      setData(parsed);
      setViewState("dashboard");

      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname);
      }

      // Save profile to localStorage
      if (parsed.categoryProfile && parsed.detectedPlatform) {
        try {
          localStorage.setItem("reports-profile", JSON.stringify({
            platform: parsed.detectedPlatform,
            columnMapping: customMapping,
            categoryProfile: parsed.categoryProfile,
            lastUsed: new Date().toISOString(),
          }));
        } catch { /* ignore */ }
      }

      hashCSVContent(text).then((hash) => {
        trackToolUsage("reports", {
          contentHash: hash,
          metadata: {
            total_orders: parsed.totalOrders,
            file_name: file.name,
            platform: parsed.detectedPlatform,
          },
        });
      });
    } catch (err) {
      setError(`Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  const processFile = useCallback((file: File) => {
    setError("");
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }
    setFileName(file.name);
    setIsSharedView(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);

      // Quick-parse to check headers
      const preview = Papa.parse<RawCSVRow>(text, {
        header: true,
        preview: 1,
        transformHeader: (h) => h.trim(),
      });
      const headers = preview.meta.fields || [];
      setCsvHeaders(headers);

      const { platformId } = detectPlatform(headers);

      if (platformId === "generic") {
        // Unknown format — show column mapper
        setViewState("column-mapper");
      } else {
        // Known platform — process directly
        processCSV(text, file);
      }
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
  }, [processCSV]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const reset = useCallback(() => {
    setData(null);
    setFileName("");
    setError("");
    setCsvText(null);
    setCsvHeaders([]);
    setIsSharedView(false);
    setViewState("upload");
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleColumnMapConfirm = useCallback((mapping: ColumnMapping) => {
    if (!csvText) return;
    processCSV(csvText, new File([csvText], fileName), mapping);
  }, [csvText, fileName, processCSV]);

  const handleCategoryApply = useCallback((profile: CategoryProfile) => {
    if (!data) return;
    // Re-parse with updated category profile — recompute all aggregates
    if (csvText) {
      const reparsed = parseCSVData(csvText, { categoryProfile: profile });
      setData(reparsed);
    }
    setViewState("dashboard");

    // Save to localStorage
    try {
      localStorage.setItem("reports-profile", JSON.stringify({
        platform: data.detectedPlatform || "generic",
        categoryProfile: profile,
        lastUsed: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
  }, [data, csvText]);

  const handleExportProfile = useCallback(() => {
    if (!data?.categoryProfile) return;
    const blob = new Blob([JSON.stringify(data.categoryProfile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `category-profile-${data.categoryProfile.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const handleImportProfile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const profile = JSON.parse(ev.target?.result as string) as CategoryProfile;
          if (profile.rules && profile.uncategorizedLabel) {
            handleCategoryApply(profile);
          } else {
            setError("Invalid profile format.");
          }
        } catch {
          setError("Failed to parse profile JSON.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [handleCategoryApply]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Sales Analytics Dashboard
        </h1>
        <p className="mb-8 text-muted-foreground">
          {isSharedView
            ? "You're viewing a shared interactive report."
            : "Upload a CSV export from Shopify, Square, WooCommerce, Stripe, or any POS to visualize your sales."}
        </p>

        {viewState === "upload" && (
          <div className="flex flex-col items-center">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
                dragOver
                  ? "border-emerald-400 bg-emerald-400/10"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <svg
                className="mb-4 h-16 w-16 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <span className="mb-2 text-lg font-semibold text-foreground">
                Drop your sales CSV here
              </span>
              <span className="mb-4 text-sm text-muted-foreground">
                or click to browse files
              </span>
              <span className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
                Select CSV File
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                aria-label="Upload CSV export"
              />
            </label>

            {/* Platform export instructions */}
            <div className="mt-6 max-w-2xl space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(PLATFORM_INSTRUCTIONS).map(([key, info]) => (
                  <details
                    key={key}
                    className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
                  >
                    <summary className="cursor-pointer font-medium text-foreground" title={`Show export instructions for ${info.title.replace("How to export from ", "").replace(":", "")}`}>
                      {info.title}
                    </summary>
                    <ol className="mt-2 list-inside list-decimal space-y-1">
                      {info.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground/70">
                Don&apos;t see your platform? Upload any CSV and we&apos;ll help you map the columns.
                All data is processed locally in your browser.
              </p>
            </div>

            {/* Profile import */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleImportProfile}
                className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
                title="Import a saved category profile from a JSON file"
              >
                Import Profile
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {viewState === "column-mapper" && (
          <ColumnMapper
            headers={csvHeaders}
            onConfirm={handleColumnMapConfirm}
            onCancel={reset}
          />
        )}

        {viewState === "category-editor" && data && (
          <CategoryEditor
            orders={data.orders}
            profile={data.categoryProfile || { id: "custom", name: "Custom", rules: [], uncategorizedLabel: "Other" }}
            onApply={handleCategoryApply}
            onClose={() => setViewState("dashboard")}
          />
        )}

        {viewState === "dashboard" && data && (
          <div className="space-y-4">
            <Dashboard
              data={data}
              fileName={fileName}
              onReset={reset}
              isSharedView={isSharedView}
              onEditCategories={() => setViewState("category-editor")}
            />
            {/* Profile export button */}
            {!isSharedView && data.categoryProfile && (
              <div className="flex justify-end gap-2 print:hidden">
                <button
                  onClick={handleExportProfile}
                  className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
                  title="Export your category profile as a JSON file to share with others"
                >
                  Export Category Profile
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
