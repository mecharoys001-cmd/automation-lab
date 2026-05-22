"use client";

import { useCallback, useEffect, useRef } from "react";
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
import BulkSelectionToolbar from "./workstation/BulkSelectionToolbar";
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

  // Bulk selection actions
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkDuplicate: () => void;
  onAddSelectedToCover: () => void;

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
  onFooterSlotMove: (fromIndex: number, toIndex: number) => void;
  onReorderEvent: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
  onAnchorSponsor: (sponsorId: string, targetId: string) => void;

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
  onClearSelection,
  onBulkDelete,
  onBulkDuplicate,
  onAddSelectedToCover,
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
  onFooterSlotMove,
  onReorderEvent,
  onAnchorSponsor,
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

  const totalPages = 1 + calendarPageCount + adPages.length;

  const prevCalendarCountRef = useRef(calendarPageCount);
  const prevAdCountRef = useRef(adPages.length);

  // Scroll a specific page into view. The preview wrapper is the nearest
  // scrollable ancestor of #page-N, so scrollIntoView walks up to it and
  // adjusts both horizontal (right pages of a spread) and vertical position.
  const scrollPageIntoView = useCallback((pageIndex: number) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(`page-${pageIndex}`);
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "start",
    });
  }, []);

  // Auto-scroll to the newly added page when the count grows. Layout work
  // inside PrintLayout runs in useLayoutEffect, so we defer one frame so the
  // DOM node for the new page exists before we try to find it by id.
  useEffect(() => {
    if (calendarPageCount > prevCalendarCountRef.current) {
      const newPageIndex = calendarPageCount; // 1 + (count - 1)
      const raf = requestAnimationFrame(() => scrollPageIntoView(newPageIndex));
      prevCalendarCountRef.current = calendarPageCount;
      return () => cancelAnimationFrame(raf);
    }
    prevCalendarCountRef.current = calendarPageCount;
  }, [calendarPageCount, scrollPageIntoView]);

  useEffect(() => {
    if (adPages.length > prevAdCountRef.current) {
      const newPageIndex = 1 + calendarPageCount + adPages.length - 1;
      const raf = requestAnimationFrame(() => scrollPageIntoView(newPageIndex));
      prevAdCountRef.current = adPages.length;
      return () => cancelAnimationFrame(raf);
    }
    prevAdCountRef.current = adPages.length;
  }, [adPages.length, calendarPageCount, scrollPageIntoView]);

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

      <BulkSelectionToolbar
        count={selectedIds.size}
        canAddToCover={selectedIds.size === 1}
        onClearSelection={onClearSelection}
        onDeleteSelected={onBulkDelete}
        onDuplicateSelected={onBulkDuplicate}
        onAddToCover={onAddSelectedToCover}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 print:hidden">
        <div className="text-sm text-foreground">
          <span className="font-semibold">{totalPages}</span> page
          {totalPages === 1 ? "" : "s"} ·{" "}
          <span title="The front cover counts as page 1">1 cover</span> ·{" "}
          <span title="Calendar pages render two columns of events per spread">
            {calendarPageCount} calendar
          </span>{" "}
          ·{" "}
          <span title="Blank ad pages appear after the calendar pages">
            {adPages.length} ad
          </span>
        </div>
        <div
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          aria-label="Jump to page"
        >
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            Jump to:
          </span>
          <button
            type="button"
            onClick={() => scrollPageIntoView(0)}
            className="whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            title="Scroll the cover page into view"
          >
            Cover
          </button>
          {Array.from({ length: calendarPageCount }, (_, i) => {
            const pageIndex = 1 + i;
            return (
              <button
                key={`jump-cal-${i}`}
                type="button"
                onClick={() => scrollPageIntoView(pageIndex)}
                className="whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                title={`Scroll calendar page ${i + 1} of ${calendarPageCount} into view`}
              >
                Cal {i + 1}
              </button>
            );
          })}
          {adPages.map((_, i) => {
            const pageIndex = 1 + calendarPageCount + i;
            return (
              <button
                key={`jump-ad-${i}`}
                type="button"
                onClick={() => scrollPageIntoView(pageIndex)}
                className="whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                title={`Scroll ad page ${i + 1} of ${adPages.length} into view`}
              >
                Ad {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="nwct-calendar-print-root"
        className={`${interCalendar.variable} ${oswaldCalendar.variable} nwct-calendar-fonts max-h-[80vh] overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0`}
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
          onFooterSlotMove={onFooterSlotMove}
          calendarPageCount={calendarPageCount}
          coverConfig={coverConfig}
          onCoverUpdate={onCoverUpdate}
          adPages={adPages}
          onAdPageUpdate={onAdPageUpdate}
          onAdPageDelete={onAdPageDelete}
          isExporting={exporting}
          onReorderEvent={onReorderEvent}
          onAnchorSponsor={onAnchorSponsor}
        />
      </div>
    </div>
  );
}
