"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  addEventToGrouped,
  buildEventFromInput,
  deleteEventsFromGrouped,
  duplicateEventsInGrouped,
  findEventInGrouped,
  processRows,
  type NewEventInput,
} from "../lib/processEvents";
import {
  clearAutosave,
  fromProjectJson,
  loadAutosave,
  saveAutosave,
  toProjectJson,
} from "../lib/projectState";
import type {
  AdPageConfig,
  CardStyles,
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
import {
  HISTORY_LIMIT,
  restoreSnapshot,
  snapshot,
  type WorkstationSnapshot,
} from "../lib/workstationHistory";
import { SAMPLE_RAW_EVENTS } from "../lib/sampleFixture";
import { formatMonthYear } from "../lib/dateFormat";
import StyleControls from "./workstation/StyleControls";
import Guide from "./workstation/Guide";
import AddEventModal from "./workstation/AddEventModal";

type Step = "upload" | "map" | "edit" | "preview";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2);
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  // --- Undo / redo history -------------------------------------------------
  const [past, setPast] = useState<WorkstationSnapshot[]>([]);
  const [future, setFuture] = useState<WorkstationSnapshot[]>([]);

  // We need the latest data/layout/selectedIds inside a stable recordHistory
  // without re-creating the callback on every keystroke. Refs do the job.
  const builtRef = useRef(built);
  const layoutRef = useRef(layout);
  const selectedRef = useRef(selectedIds);
  useEffect(() => {
    builtRef.current = built;
  }, [built]);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  useEffect(() => {
    selectedRef.current = selectedIds;
  }, [selectedIds]);

  const recordHistory = useCallback(() => {
    const snap = snapshot(builtRef.current, layoutRef.current, selectedRef.current);
    setPast((prev) => {
      const next = [...prev, snap];
      // Cap stack size to prevent unbounded memory growth.
      if (next.length > HISTORY_LIMIT) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previous = next.pop();
      if (!previous) return prev;
      const current = snapshot(
        builtRef.current,
        layoutRef.current,
        selectedRef.current,
      );
      setFuture((f) => [current, ...f]);
      const restored = restoreSnapshot(previous);
      setBuilt(restored.data);
      setLayout(restored.layout);
      setSelectedIds(restored.selectedIds);
      return next;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const upcoming = next.shift();
      if (!upcoming) return prev;
      const current = snapshot(
        builtRef.current,
        layoutRef.current,
        selectedRef.current,
      );
      setPast((p) => [...p, current]);
      const restored = restoreSnapshot(upcoming);
      setBuilt(restored.data);
      setLayout(restored.layout);
      setSelectedIds(restored.selectedIds);
      return next;
    });
  }, []);

  // Keyboard shortcuts for undo/redo. Active only when in preview step and
  // the focus target is not a text input. (Step is read through a ref to
  // avoid re-binding the listener on every state change.)
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const isTextTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (stepRef.current !== "preview") return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        if (isTextTarget(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === "y") {
        if (isTextTarget(e.target)) return;
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  // --- Autosave ------------------------------------------------------------
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
    setSelectedIds(new Set());
    clearHistory();
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
  }, [clearHistory]);

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

  const handleBuild = useCallback((latestRows: EditorRow[]) => {
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
    setSelectedIds(new Set());
    clearHistory();
    setStep("preview");
  }, [clearHistory]);

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
        setSelectedIds(new Set());
        clearHistory();
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
  }, [clearHistory]);

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

  const handleSaveProjectFromPreview = useCallback(() => {
    handleSaveProject(rows);
  }, [handleSaveProject, rows]);

  const handleResetUpload = useCallback(() => {
    setStep("upload");
    setBuilt(null);
    setSelectedIds(new Set());
    clearHistory();
    setError(null);
  }, [clearHistory]);

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
    setSelectedIds(new Set());
    clearHistory();
    setHasAutosaveState(false);
    setStep("upload");
  }, [clearHistory]);

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

  // --- Mutations (each records history before mutating) -------------------

  const handleEventUpdate = useCallback(
    (updated: ProcessedEvent) => {
      recordHistory();
      setBuilt((prev) => (prev ? updateGroupedEvent(prev, updated) : prev));
    },
    [recordHistory],
  );

  const handleDeleteEvent = useCallback(
    (id: string) => {
      recordHistory();
      setBuilt((prev) => (prev ? deleteGroupedEvent(prev, id) : prev));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [recordHistory],
  );

  const handleDeleteSponsor = useCallback(
    (id: string) => {
      recordHistory();
      setLayout((prev) => ({
        ...prev,
        sponsors: prev.sponsors.filter((s) => s.id !== id),
      }));
    },
    [recordHistory],
  );

  const setCalendarPageCountInternal = useCallback((n: number) => {
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

  const handleSetCalendarPageCount = useCallback(
    (n: number) => {
      recordHistory();
      setCalendarPageCountInternal(n);
    },
    [recordHistory, setCalendarPageCountInternal],
  );

  const handleCoverUpdate = useCallback(
    (c: CoverConfig) => {
      recordHistory();
      setLayout((prev) => ({ ...prev, coverConfig: c }));
    },
    [recordHistory],
  );

  const handleAdPageUpdate = useCallback(
    (p: AdPageConfig) => {
      recordHistory();
      setLayout((prev) => ({
        ...prev,
        adPages: prev.adPages.map((a) => (a.id === p.id ? p : a)),
      }));
    },
    [recordHistory],
  );

  const handleAdPageDelete = useCallback(
    (id: string) => {
      recordHistory();
      setLayout((prev) => ({
        ...prev,
        adPages: prev.adPages.filter((a) => a.id !== id),
      }));
    },
    [recordHistory],
  );

  const handleAddAdPage = useCallback(() => {
    recordHistory();
    setLayout((prev) => ({
      ...prev,
      adPages: [
        ...prev.adPages,
        { id: generateId(), layout: "full", images: [null] },
      ],
    }));
  }, [recordHistory]);

  const handleFooterSlotUpload = useCallback(
    (index: number, files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;
      Promise.all(
        imageFiles.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target?.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
      ).then((dataUrls) => {
        recordHistory();
        setLayout((prev) => {
          const next = prev.footerSlots.slice();
          let cursor = index;
          for (const url of dataUrls) {
            // Find the next slot that can receive an image — start at the
            // target slot, then walk forward through image / empty slots.
            while (
              cursor < next.length &&
              next[cursor] &&
              next[cursor].type !== "image" &&
              next[cursor].type !== "empty"
            ) {
              cursor += 1;
            }
            if (cursor >= next.length) break;
            next[cursor] = { type: "image", content: url };
            cursor += 1;
          }
          return { ...prev, footerSlots: next };
        });
      });
    },
    [recordHistory],
  );

  const handleFooterSlotDelete = useCallback(
    (index: number) => {
      recordHistory();
      setLayout((prev) => {
        const next = prev.footerSlots.slice();
        next[index] = { type: "removed" };
        return { ...prev, footerSlots: next };
      });
    },
    [recordHistory],
  );

  const handleFooterSlotRestore = useCallback(
    (index: number) => {
      recordHistory();
      setLayout((prev) => {
        const next = prev.footerSlots.slice();
        next[index] = { type: "image" };
        return { ...prev, footerSlots: next };
      });
    },
    [recordHistory],
  );

  const handleFooterSlotMove = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      recordHistory();
      setLayout((prev) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.footerSlots.length ||
          toIndex >= prev.footerSlots.length
        )
          return prev;
        const next = prev.footerSlots.slice();
        const tmp = next[fromIndex];
        next[fromIndex] = next[toIndex];
        next[toIndex] = tmp;
        return { ...prev, footerSlots: next };
      });
    },
    [recordHistory],
  );

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = selectedRef.current;
    if (ids.size === 0) return;
    recordHistory();
    setBuilt((prev) => (prev ? deleteEventsFromGrouped(prev, ids) : prev));
    setSelectedIds(new Set());
  }, [recordHistory]);

  const handleBulkDuplicate = useCallback(() => {
    const ids = selectedRef.current;
    if (ids.size === 0) return;
    const current = builtRef.current;
    if (!current) return;
    recordHistory();
    const { grouped, newIds } = duplicateEventsInGrouped(current, ids);
    setBuilt(grouped);
    setSelectedIds(new Set(newIds));
  }, [recordHistory]);

  const handleAddSelectedToCover = useCallback(() => {
    const ids = selectedRef.current;
    if (ids.size !== 1) return;
    const current = builtRef.current;
    if (!current) return;
    const id = ids.values().next().value;
    if (!id) return;
    const event = findEventInGrouped(current, id);
    if (!event) return;
    recordHistory();
    const venue = event.venue?.trim() ?? "";
    const town = event.town?.trim() ?? "";
    const caption = `${event.title}${venue ? ` at ${venue}` : ""}${
      town ? `, ${town}` : ""
    }`;
    setLayout((prev) => ({
      ...prev,
      coverConfig: {
        ...prev.coverConfig,
        heroImageUrl: event.imageUrl
          ? event.imageUrl
          : prev.coverConfig.heroImageUrl,
        credit: caption,
        month: prev.coverConfig.month || current.monthTitle,
      },
    }));
    setSelectedIds(new Set());
  }, [recordHistory]);

  // Placeholder handlers for not-yet-wired toolbar actions. They show a
  // tooltip-aware notice via the error banner so the user knows the button
  // works but the feature is coming in a later patch.
  const notImplemented = useCallback((feature: string) => {
    setError(`${feature} is coming in a later parity patch.`);
  }, []);

  const handleOpenAddEvent = useCallback(() => {
    setShowAddEvent(true);
  }, []);
  const handleAddEventSubmit = useCallback(
    (input: NewEventInput) => {
      const evt = buildEventFromInput(input);
      if (!evt) {
        setError("Could not add event — start date is invalid.");
        return;
      }
      recordHistory();
      setBuilt((prev) => {
        const base = prev ?? {
          shortRuns: {},
          longRuns: [],
          workshops: [],
          sortedDateKeys: [],
          monthTitle: formatMonthYear(evt.startAt).toUpperCase(),
        };
        return addEventToGrouped(base, evt);
      });
      setError(null);
      setShowAddEvent(false);
    },
    [recordHistory],
  );
  const handleAddSponsors = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      Promise.all(
        files.map(
          (file) =>
            new Promise<{ url: string; name: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) =>
                resolve({
                  url: ev.target?.result as string,
                  name: file.name.replace(/\.[^.]+$/, ""),
                });
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
      ).then((results) => {
        if (results.length === 0) return;
        const sel = selectedRef.current;
        const afterId = sel.size === 1 ? sel.values().next().value : undefined;
        recordHistory();
        setLayout((prev) => ({
          ...prev,
          sponsors: [
            ...prev.sponsors,
            ...results.map(({ url, name }) => ({
              id: generateId(),
              imageUrl: url,
              name,
              ...(afterId ? { afterId } : {}),
            })),
          ],
        }));
      });
    };
    input.click();
  }, [recordHistory]);
  const handleSaveImagesPlaceholder = useCallback(() => {
    notImplemented("Save Images");
  }, [notImplemented]);

  const handleToggleGuide = useCallback(() => {
    setShowGuide((v) => !v);
  }, []);
  const handleToggleStyle = useCallback(() => {
    setShowStyle((v) => !v);
  }, []);

  const handleStyleChange = useCallback(
    (next: CardStyles) => {
      recordHistory();
      setLayout((prev) => ({ ...prev, cardStyles: next }));
    },
    [recordHistory],
  );

  const handleLoadSample = useCallback(() => {
    const editorRows = toEditorRows(SAMPLE_RAW_EVENTS);
    setRows(editorRows);
    const grouped = processRows(editorRows);
    setBuilt(grouped);
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
    setSelectedIds(new Set());
    clearHistory();
    setError(null);
    setStep("preview");
  }, [clearHistory]);

  const handleStartBlank = useCallback(() => {
    setRows([]);
    const now = new Date();
    const monthTitle = formatMonthYear(now).toUpperCase();
    const emptyGrouped: GroupedEvents = {
      shortRuns: {},
      longRuns: [],
      workshops: [],
      sortedDateKeys: [],
      monthTitle,
    };
    setBuilt(emptyGrouped);
    setLayout((prev) => ({
      ...prev,
      footerSlots:
        prev.footerSlots.length === prev.calendarPageCount * 3
          ? prev.footerSlots
          : defaultFooterSlotsForPages(prev.calendarPageCount),
      coverConfig: { ...prev.coverConfig, month: prev.coverConfig.month || monthTitle },
    }));
    setSelectedIds(new Set());
    clearHistory();
    setError(null);
    setStep("preview");
  }, [clearHistory]);

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
        {step !== "upload" && step !== "preview" && (
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
          onLoadSample={handleLoadSample}
          onStartBlank={handleStartBlank}
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
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAddEvent={handleOpenAddEvent}
          onAddSponsors={handleAddSponsors}
          onToggleGuide={handleToggleGuide}
          onToggleStyle={handleToggleStyle}
          onSaveImages={handleSaveImagesPlaceholder}
          onClearSelection={handleClearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkDuplicate={handleBulkDuplicate}
          onAddSelectedToCover={handleAddSelectedToCover}
          onAddAdPage={handleAddAdPage}
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
          onFooterSlotMove={handleFooterSlotMove}
          onBack={() => setStep("edit")}
          onPrint={handlePrint}
          onExportPdf={handleExportPdf}
          onSaveProject={handleSaveProjectFromPreview}
          onReset={handleStartOver}
          exporting={exporting}
        />
      )}

      {error && step !== "upload" && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {step === "preview" && showStyle && (
        <StyleControls
          styles={layout.cardStyles}
          onChange={handleStyleChange}
          onClose={() => setShowStyle(false)}
        />
      )}

      {showGuide && <Guide onClose={() => setShowGuide(false)} />}

      {step === "preview" && showAddEvent && (
        <AddEventModal
          onClose={() => setShowAddEvent(false)}
          onAdd={handleAddEventSubmit}
        />
      )}
    </div>
  );
}
