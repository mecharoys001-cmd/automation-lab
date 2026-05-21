"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CsvUploadStep from "./CsvUploadStep";
import ColumnMapper from "./ColumnMapper";
import EventGridEditor from "./EventGridEditor";
import CalendarPreview from "./CalendarPreview";
import {
  downloadBlob,
  parseCsvText,
  toEditorRows,
} from "../lib/csv";
import { applyMapping, suggestMapping } from "../lib/normalize";
import { processRows } from "../lib/processEvents";
import {
  clearAutosave,
  fromProjectJson,
  loadAutosave,
  saveAutosave,
  toProjectJson,
} from "../lib/projectState";
import type {
  ColumnMapping,
  EditorRow,
  GroupedEvents,
  RawCsvEvent,
} from "../lib/types";
import { REQUIRED_FIELDS } from "../lib/types";
import { exportPreviewToPdf } from "../lib/exportPdf";

type Step = "upload" | "map" | "edit" | "preview";

export default function NwctCalendarTool() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRowsRaw, setCsvRowsRaw] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [built, setBuilt] = useState<GroupedEvents | null>(null);
  const [exporting, setExporting] = useState(false);

  const [hasAutosave, setHasAutosaveState] = useState(false);
  useEffect(() => {
    setHasAutosaveState(!!loadAutosave());
  }, []);

  // Autosave whenever rows change in edit/preview states.
  useEffect(() => {
    if (rows.length === 0) return;
    saveAutosave(rows);
    setHasAutosaveState(true);
  }, [rows]);

  const restoreAutosave = useCallback(() => {
    const restored = loadAutosave();
    if (!restored || restored.length === 0) {
      setError("No autosaved session found.");
      return;
    }
    setRows(restored);
    setStep("edit");
    setError(null);
  }, []);

  const applyMappingAndAdvance = useCallback(
    (mapping: ColumnMapping, srcRows?: Record<string, string>[]) => {
      const sourceRows = srcRows ?? csvRowsRaw;
      const canonical = applyMapping(sourceRows, mapping) as unknown as RawCsvEvent[];
      const editorRows = toEditorRows(canonical);
      setRows(editorRows);
      setStep("edit");
    },
    [csvRowsRaw],
  );

  const handleCsvLoaded = useCallback((text: string) => {
    setError(null);
    try {
      const parsed = parseCsvText(text);
      if (!parsed.rows.length) {
        setError("No rows found in the CSV.");
        return;
      }
      setCsvHeaders(parsed.headers);
      setCsvRowsRaw(parsed.rows);

      // Auto-advance if every required field maps cleanly.
      const suggested = suggestMapping(parsed.headers);
      const allRequiredMapped = REQUIRED_FIELDS.every((f) => !!suggested[f]);
      if (allRequiredMapped) {
        applyMappingAndAdvance(suggested, parsed.rows);
      } else {
        setStep("map");
      }
    } catch (e) {
      setError(`Failed to parse CSV: ${(e as Error).message}`);
    }
  }, [applyMappingAndAdvance]);

  const handleBuild = useCallback((latestRows: EditorRow[]) => {
    const grouped = processRows(latestRows);
    setBuilt(grouped);
    setStep("preview");
  }, []);

  const triggerLoadProject = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const restored = fromProjectJson(text);
        if (!restored) {
          setError("Invalid project JSON.");
          return;
        }
        setRows(restored);
        setStep("edit");
        setError(null);
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleSaveProject = useCallback((latestRows: EditorRow[]) => {
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    downloadBlob(
      toProjectJson(latestRows),
      `nwct-calendar-project-${stamp}.json`,
      "application/json;charset=utf-8;",
    );
  }, []);

  const handleResetUpload = useCallback(() => {
    setStep("upload");
    setBuilt(null);
    setError(null);
  }, []);

  const handleStartOver = useCallback(() => {
    if (!confirm("Discard the current session and start over? This clears the autosave.")) return;
    clearAutosave();
    setRows([]);
    setBuilt(null);
    setCsvHeaders([]);
    setCsvRowsRaw([]);
    setHasAutosaveState(false);
    setStep("upload");
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!built) return;
    setExporting(true);
    try {
      const slug = built.monthTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "calendar";
      await exportPreviewToPdf("nwct-calendar-print-root", `nwct-calendar-${slug}.pdf`);
    } catch (e) {
      setError(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }, [built]);

  const stepBadge = useMemo(() => {
    const labels: Record<Step, string> = {
      upload: "1 · Upload CSV",
      map: "2 · Map columns",
      edit: "3 · Edit rows",
      preview: "4 · Preview & export",
    };
    return labels[step];
  }, [step]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-900">
          {stepBadge}
        </span>
        {step !== "upload" && (
          <button
            onClick={handleStartOver}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-red-700 hover:underline"
            title="Discard current session and return to the upload step"
          >
            Start over
          </button>
        )}
      </div>

      {step === "upload" && (
        <CsvUploadStep
          onFileLoaded={handleCsvLoaded}
          onLoadProject={triggerLoadProject}
          hasAutosave={hasAutosave}
          onRestoreAutosave={restoreAutosave}
          error={error}
        />
      )}

      {step === "map" && (
        <ColumnMapper
          headers={csvHeaders}
          onConfirm={(mapping) => applyMappingAndAdvance(mapping)}
          onCancel={handleResetUpload}
        />
      )}

      {step === "edit" && (
        <EventGridEditor
          initialRows={rows}
          onBuild={handleBuild}
          onBack={handleResetUpload}
          onRowsChange={setRows}
          onSaveProject={handleSaveProject}
          onLoadProject={triggerLoadProject}
        />
      )}

      {step === "preview" && built && (
        <CalendarPreview
          data={built}
          onBack={() => setStep("edit")}
          onPrint={handlePrint}
          onExportPdf={handleExportPdf}
          exporting={exporting}
        />
      )}

      {error && step !== "upload" && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}
    </div>
  );
}
