"use client";

import { useCallback, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type {
  AdPageConfig,
  CardStyles,
  CoverConfig,
  FooterSlot,
  GroupedEvents,
  ProcessedEvent,
  Sponsor,
} from "../lib/types";
import { interCalendar, oswaldCalendar } from "../lib/fonts";
import { PrintLayout } from "./print/PrintLayout";
import "../nwct-calendar.css";

interface Props {
  data: GroupedEvents;

  // Layout state
  cardStyles: CardStyles;
  sponsors: Sponsor[];
  footerSlots: FooterSlot[];
  calendarPageCount: number;
  coverConfig: CoverConfig;
  adPages: AdPageConfig[];

  // Mutators
  onEventUpdate: (e: ProcessedEvent) => void;
  onDeleteEvent: (id: string) => void;
  onDeleteSponsor: (id: string) => void;
  onSetCalendarPageCount: (n: number) => void;
  onCoverUpdate: (c: CoverConfig) => void;
  onAdPageUpdate: (p: AdPageConfig) => void;
  onAdPageDelete: (id: string) => void;
  onFooterSlotUpload: (index: number, files: File[]) => void;
  onFooterSlotDelete: (index: number) => void;
  onFooterSlotRestore: (index: number) => void;

  // Top-level actions
  onBack: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  exporting?: boolean;
}

export default function CalendarPreview({
  data,
  cardStyles,
  sponsors,
  footerSlots,
  calendarPageCount,
  coverConfig,
  adPages,
  onEventUpdate,
  onDeleteEvent,
  onDeleteSponsor,
  onSetCalendarPageCount,
  onCoverUpdate,
  onAdPageUpdate,
  onAdPageDelete,
  onFooterSlotUpload,
  onFooterSlotDelete,
  onFooterSlotRestore,
  onBack,
  onPrint,
  onExportPdf,
  exporting,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totalEvents =
    data.longRuns.length +
    data.workshops.length +
    data.sortedDateKeys.reduce(
      (sum, k) => sum + (data.shortRuns[k]?.length ?? 0),
      0,
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-sm text-foreground">
          <span className="font-semibold">{totalEvents}</span> events grouped ·{" "}
          {data.sortedDateKeys.length} daily section
          {data.sortedDateKeys.length === 1 ? "" : "s"} · {data.longRuns.length}{" "}
          long runs · {data.workshops.length} workshops
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Pages
            </span>
            <button
              onClick={() =>
                onSetCalendarPageCount(Math.max(1, calendarPageCount - 1))
              }
              className="rounded p-1 text-foreground hover:bg-background disabled:opacity-50"
              disabled={calendarPageCount <= 1}
              title="Remove one calendar page"
            >
              <Minus size={14} />
            </button>
            <span className="min-w-[20px] text-center text-sm font-bold">
              {calendarPageCount}
            </span>
            <button
              onClick={() => onSetCalendarPageCount(calendarPageCount + 1)}
              className="rounded p-1 text-foreground hover:bg-background"
              title="Add one calendar page"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={onBack}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Return to the row editor"
          >
            ← Back to editor
          </button>
          <button
            onClick={onPrint}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Open the browser print dialog — works for paper or system PDF export"
          >
            Print…
          </button>
          <button
            onClick={onExportPdf}
            disabled={exporting}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Render the preview to a multi-page PDF using jsPDF and html2canvas"
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div
        id="nwct-calendar-print-root"
        className={`${interCalendar.variable} ${oswaldCalendar.variable} nwct-calendar-fonts overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 print:border-0 print:bg-white print:p-0`}
      >
        <PrintLayout
          data={data}
          onEventUpdate={onEventUpdate}
          onDeleteEvent={onDeleteEvent}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          cardStyles={cardStyles}
          sponsors={sponsors}
          onDeleteSponsor={onDeleteSponsor}
          footerSlots={footerSlots}
          onFooterSlotUpload={onFooterSlotUpload}
          onFooterSlotDelete={onFooterSlotDelete}
          onFooterSlotRestore={onFooterSlotRestore}
          calendarPageCount={calendarPageCount}
          coverConfig={coverConfig}
          onCoverUpdate={onCoverUpdate}
          adPages={adPages}
          onAdPageUpdate={onAdPageUpdate}
          onAdPageDelete={onAdPageDelete}
        />
      </div>
    </div>
  );
}
