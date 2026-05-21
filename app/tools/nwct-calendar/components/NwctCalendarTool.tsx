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
  AdPageConfig,
  ColumnMapping,
  CoverConfig,
  EditorRow,
  FooterSlot,
  GroupedEvents,
  LayoutState,
  ProcessedEvent,
  RawCsvEvent,
} from "../lib/types";
import {
  defaultFooterSlotsForPages,
  defaultLayoutState,
  REQUIRED_FIELDS,
} from "../lib/types";
import { exportPreviewToPdf } from "../lib/exportPdf";

type Step = "upload" | "map" | "edit" | "preview";

function updateGroupedEvent(
  grouped: GroupedEvents,
  updated: ProcessedEvent,
): GroupedEvents {
  const apply = (e: ProcessedEvent) => (e.id === updated.id ? updated : e);
  const shortRuns: Record<string, ProcessedEvent[]> = {};
  for (const [k, list] of Object.entries(grouped.shortRuns)) {
    shortRuns[k] = list.map(apply);
  }
  return {
    ...grouped,
    shortRuns,
    longRuns: grouped.longRuns.map(apply),
    workshops: grouped.workshops.map(apply),
  };
}

function deleteGroupedEvent(grouped: GroupedEvents, id: string): GroupedEvents {
  const reject = (e: ProcessedEvent) => e.id !== id;
  const shortRuns: Record<string, ProcessedEvent[]> = {};
  for (const [k, list] of Object.entries(grouped.shortRuns)) {
    const filtered = list.filter(reject);
    if (filtered.length > 0) shortRuns[k] = filtered;
  }
  const sortedDateKeys = grouped.sortedDateKeys.filter((k) => shortRuns[k]);
  return {
    ...grouped,
    shortRuns,
    sortedDateKeys,
    longRuns: grouped.longRuns.filter(reject),
    workshops: grouped.workshops.filter(reject),
  };
}

export default function NwctCalendarTool() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRowsRaw, setCsvRowsRaw] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [built, setBuilt] = useState<GroupedEvents | null>(null);
  const [layout, setLayout] = useState<LayoutState>(defaultLayoutState);
  const [exporting, setExporting] = useState(false);

  const [hasAutosave, setHasAutosaveState] = useState(false);
  useEffect(() => {
    setHasAutosaveState(!!loadAutosave());
  }, []);

  // Autosave whenever rows / built / layout change while in edit or preview.
  useEffect(() => {
    if (rows.length === 0) return;
    saveAutosave({ rows, data: built, layout });
    setHasAutosaveState(true);
  }, [rows, built, layout]);

  const restoreAutosave = useCallback(() => {
    const restored = loadAutosave();
    if (!restored || restored.rows.length === 0) {
      setError("No autosaved session found.");
      return;
    }
    setRows(restored.rows);
    if (restored.data) {
      setBuilt(restored.data);
      setLayout(restored.layout ?? defaultLayoutState());
      setStep("preview");
    } else {
      setBuilt(null);
      setLayout(defaultLayoutState());
      setStep("edit");
    }
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

  const handleCsvLoaded = useCallback(
    (text: string) => {
      setError(null);
      try {
        const parsed = parseCsvText(text);
        if (!parsed.rows.length) {
          setError("No rows found in the CSV.");
          return;
        }
        setCsvHeaders(parsed.headers);
        setCsvRowsRaw(parsed.rows);

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
    },
    [applyMappingAndAdvance],
  );

  const handleBuild = useCallback(
    (latestRows: EditorRow[]) => {
      const grouped = processRows(latestRows);
      setBuilt(grouped);
      // Reset layout footer slots to match the current page count if the
      // grouped data has nothing yet, but preserve any existing edits.
      setLayout((prev) => ({
        ...prev,
        footerSlots:
          prev.footerSlots.length === prev.calendarPageCount * 3
            ? prev.footerSlots
            : defaultFooterSlotsForPages(prev.calendarPageCount),
        coverConfig: {
          ...prev.coverConfig,
          month: prev.coverConfig.month || grouped.monthTitle,
        },
      }));
      setStep("preview");
    },
    [],
  );

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
        setRows(restored.rows);
        if (restored.data) {
          setBuilt(restored.data);
          setLayout(restored.layout ?? defaultLayoutState());
          setStep("preview");
        } else {
          setBuilt(null);
          setLayout(defaultLayoutState());
          setStep("edit");
        }
        setError(null);
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleSaveProject = useCallback(
    (latestRows: EditorRow[]) => {
      const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
      downloadBlob(
        toProjectJson({ rows: latestRows, data: built, layout }),
        `nwct-calendar-project-${stamp}.json`,
        "application/json;charset=utf-8;",
      );
    },
    [built, layout],
  );

  const handleResetUpload = useCallback(() => {
    setStep("upload");
    setBuilt(null);
    setError(null);
  }, []);

  const handleStartOver = useCallback(() => {
    if (
      !confirm("Discard the current session and start over? This clears the autosave.")
    )
      return;
    clearAutosave();
    setRows([]);
    setBuilt(null);
    setLayout(defaultLayoutState());
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
      const slug =
        built.monthTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "calendar";
      await exportPreviewToPdf("nwct-calendar-print-root", `nwct-calendar-${slug}.pdf`);
    } catch (e) {
      setError(`PDF export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }, [built]);

  const handleEventUpdate = useCallback((updated: ProcessedEvent) => {
    setBuilt((prev) => (prev ? updateGroupedEvent(prev, updated) : prev));
  }, []);

  const handleDeleteEvent = useCallback((id: string) => {
    setBuilt((prev) => (prev ? deleteGroupedEvent(prev, id) : prev));
  }, []);

  const handleDeleteSponsor = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      sponsors: prev.sponsors.filter((s) => s.id !== id),
    }));
  }, []);

  const handleSetCalendarPageCount = useCallback((n: number) => {
    setLayout((prev) => {
      const clamped = Math.max(1, Math.min(20, n));
      const targetCount = clamped * 3;
      let footerSlots: FooterSlot[];
      if (prev.footerSlots.length === targetCount) {
        footerSlots = prev.footerSlots;
      } else if (prev.footerSlots.length > targetCount) {
        footerSlots = prev.footerSlots.slice(0, targetCount);
      } else {
        footerSlots = [
          ...prev.footerSlots,
          ...defaultFooterSlotsForPages(clamped).slice(prev.footerSlots.length),
        ];
      }
      return { ...prev, calendarPageCount: clamped, footerSlots };
    });
  }, []);

  const handleCoverUpdate = useCallback((c: CoverConfig) => {
    setLayout((prev) => ({ ...prev, coverConfig: c }));
  }, []);

  const handleAdPageUpdate = useCallback((p: AdPageConfig) => {
    setLayout((prev) => ({
      ...prev,
      adPages: prev.adPages.map((a) => (a.id === p.id ? p : a)),
    }));
  }, []);

  const handleAdPageDelete = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      adPages: prev.adPages.filter((a) => a.id !== id),
    }));
  }, []);

  const handleFooterSlotUpload = useCallback((index: number, files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLayout((prev) => {
        const next = prev.footerSlots.slice();
        next[index] = { type: "image", content: dataUrl };
        return { ...prev, footerSlots: next };
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFooterSlotDelete = useCallback((index: number) => {
    setLayout((prev) => {
      const next = prev.footerSlots.slice();
      next[index] = { type: "removed" };
      return { ...prev, footerSlots: next };
    });
  }, []);

  const handleFooterSlotRestore = useCallback((index: number) => {
    setLayout((prev) => {
      const next = prev.footerSlots.slice();
      next[index] = { type: "image" };
      return { ...prev, footerSlots: next };
    });
  }, []);

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
          cardStyles={layout.cardStyles}
          sponsors={layout.sponsors}
          footerSlots={layout.footerSlots}
          calendarPageCount={layout.calendarPageCount}
          coverConfig={layout.coverConfig}
          adPages={layout.adPages}
          onEventUpdate={handleEventUpdate}
          onDeleteEvent={handleDeleteEvent}
          onDeleteSponsor={handleDeleteSponsor}
          onSetCalendarPageCount={handleSetCalendarPageCount}
          onCoverUpdate={handleCoverUpdate}
          onAdPageUpdate={handleAdPageUpdate}
          onAdPageDelete={handleAdPageDelete}
          onFooterSlotUpload={handleFooterSlotUpload}
          onFooterSlotDelete={handleFooterSlotDelete}
          onFooterSlotRestore={handleFooterSlotRestore}
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
