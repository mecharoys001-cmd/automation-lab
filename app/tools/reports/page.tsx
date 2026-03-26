"use client";

import { useState, useCallback, useEffect } from "react";
import { parseCSVData } from "./lib/parseCSV";
import { decodeShareData } from "./lib/share";
import type { DashboardData } from "./lib/types";
import Dashboard from "./components/Dashboard";
import { trackToolUsage, hashCSVContent } from "@/lib/usage-tracking";

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);

  // On mount, check for shared data via ?s= (server-stored) or #d= (legacy hash)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("s");

    if (shareId) {
      // Fetch from server
      fetch(`/api/reports/share?id=${encodeURIComponent(shareId)}`)
        .then((res) => res.ok ? res.json() : Promise.reject("Not found"))
        .then(({ data: encoded }) => {
          const result = decodeShareData(encoded);
          if (result) {
            setData(result.data);
            setFileName(result.fileName);
            setIsSharedView(true);
          }
        })
        .catch(() => setError("Shared report not found or expired."));
      return;
    }

    // Legacy: check URL hash
    const hash = window.location.hash.slice(1);
    if (!hash || !hash.startsWith("d=")) return;

    const encoded = hash.slice(2);
    const result = decodeShareData(encoded);
    if (result) {
      setData(result.data);
      setFileName(result.fileName);
      setIsSharedView(true);
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
      try {
        const text = e.target?.result as string;
        const parsed = parseCSVData(text);
        if (parsed.totalOrders === 0) {
          setError("No orders found in the CSV. Check the file format.");
          return;
        }
        setData(parsed);

        // Clear any share hash from URL
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname);
        }

        console.log('[usage-tracking] Tracking reports usage...');
        hashCSVContent(text).then((hash) => {
          console.log('[usage-tracking] Hash generated:', hash.slice(0, 12));
          trackToolUsage('reports', {
            contentHash: hash,
            metadata: {
              total_orders: parsed.totalOrders,
              file_name: file.name,
            },
          });
        }).catch((err) => {
          console.error('[usage-tracking] Hash failed:', err);
        });
      } catch (err) {
        setError(`Failed to parse CSV: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
  }, []);

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
    setIsSharedView(false);
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Shopify Transaction Reports
        </h1>
        <p className="mb-8 text-muted-foreground">
          {isSharedView
            ? "You're viewing a shared interactive report."
            : "Upload a Shopify CSV export to visualize revenue, categories, and trends."}
        </p>

        {!data ? (
          <div className="flex flex-col items-center">
            {/* Upload area */}
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
                Drop your Shopify CSV here
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
                aria-label="Upload Shopify CSV export"
              />
            </label>

            <div className="mt-6 max-w-2xl rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">How to export from Shopify:</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Go to Shopify Admin &rarr; Orders</li>
                <li>Set the date range filter</li>
                <li>Click &ldquo;Export&rdquo; &rarr; &ldquo;All orders&rdquo; &rarr; CSV for Excel</li>
                <li>Upload the downloaded file here</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground/70">
                All data is processed locally in your browser. Nothing is uploaded to any server.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        ) : (
          <Dashboard data={data} fileName={fileName} onReset={reset} />
        )}
      </div>
    </div>
  );
}
