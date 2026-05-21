"use client";

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
import WorkstationToolbar from "./workstation/WorkstationToolbar";
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

  // Selection (lifted to NwctCalendarTool so undo/redo can capture it)
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;

  // Undo/redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Toolbar placeholders for features landing in later patches
  onAddEvent: () => void;
  onAddSponsors: () => void;
  onToggleGuide: () => void;
  onToggleStyle: () => void;
  onSaveImages: () => void;

  // Wired toolbar actions
  onAddAdPage: () => void;
  onSaveProject: () => void;
  onReset: () => void;

  // Layout mutators
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
  selectedIds,
  onToggleSelection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddEvent,
  onAddSponsors,
  onToggleGuide,
  onToggleStyle,
  onSaveImages,
  onAddAdPage,
  onSaveProject,
  onReset,
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
  const totalEvents =
    data.longRuns.length +
    data.workshops.length +
    data.sortedDateKeys.reduce(
      (sum, k) => sum + (data.shortRuns[k]?.length ?? 0),
      0,
    );

  return (
    <div className="flex flex-col gap-3">
      <WorkstationToolbar
        calendarPageCount={calendarPageCount}
        canUndo={canUndo}
        canRedo={canRedo}
        exporting={exporting}
        onAddEvent={onAddEvent}
        onUndo={onUndo}
        onRedo={onRedo}
        onPageCountDecrement={() =>
          onSetCalendarPageCount(Math.max(1, calendarPageCount - 1))
        }
        onPageCountIncrement={() => onSetCalendarPageCount(calendarPageCount + 1)}
        onAddAdPage={onAddAdPage}
        onAddSponsors={onAddSponsors}
        onToggleGuide={onToggleGuide}
        onToggleStyle={onToggleStyle}
        onExportPdf={onExportPdf}
        onSaveImages={onSaveImages}
        onSaveProject={onSaveProject}
        onReset={onReset}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-sm text-foreground">
          <span className="font-semibold">{totalEvents}</span> events grouped ·{" "}
          {data.sortedDateKeys.length} daily section
          {data.sortedDateKeys.length === 1 ? "" : "s"} · {data.longRuns.length}{" "}
          long runs · {data.workshops.length} workshops
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Return to the row editor"
          >
            ← Back to editor
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Open the browser print dialog — works for paper or system PDF export"
          >
            Print…
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
          onToggleSelection={onToggleSelection}
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
