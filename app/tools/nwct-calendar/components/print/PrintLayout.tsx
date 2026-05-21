"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Image as ImageIcon, PlusCircle, X } from "lucide-react";
import type {
  AdPageConfig,
  CardStyles,
  CoverConfig,
  FooterSlot,
  GroupedEvents,
  ProcessedEvent,
  Sponsor,
} from "../../lib/types";
import { AdPage } from "./AdPage";
import { CoverPage } from "./CoverPage";
import { EventCard } from "./EventCard";
import { SponsorBlock } from "./SponsorBlock";
import { WorkshopEvent } from "./WorkshopEvent";
import { WorkshopVenueHeader } from "./WorkshopVenueHeader";

interface PrintLayoutProps {
  data: GroupedEvents;
  onEventUpdate: (updatedEvent: ProcessedEvent) => void;
  onDeleteEvent: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  cardStyles: CardStyles;
  sponsors: Sponsor[];
  onDeleteSponsor: (id: string) => void;
  footerSlots: FooterSlot[];
  onFooterSlotUpload: (index: number, files: File[]) => void;
  onFooterSlotDelete: (index: number) => void;
  onFooterSlotRestore: (index: number) => void;
  calendarPageCount: number;
  coverConfig: CoverConfig;
  onCoverUpdate: (c: CoverConfig) => void;
  adPages: AdPageConfig[];
  onAdPageUpdate: (p: AdPageConfig) => void;
  onAdPageDelete: (id: string) => void;
  isExporting?: boolean;
}

// ---------------------------------------------------------------------------
// Geometry constants
// ---------------------------------------------------------------------------

// Pages are rendered at logical (96 DPI) dimensions on screen and in print —
// 8.5 x 11in maps natively to 816 x 1056 CSS pixels, so the preview is
// visible without horizontal scrolling and print() lays out 1:1 on paper.
// The PDF exporter upscales the capture via html2canvas's `scale` option.
const LOGICAL_DPI = 96;

const LOGICAL_PAGE_WIDTH = 8.5 * LOGICAL_DPI;
const LOGICAL_PAGE_HEIGHT = 11 * LOGICAL_DPI;

const PADDING_PX = 0.5 * LOGICAL_DPI;
const BOTTOM_MARGIN_PX = 10;
const FOOTER_HEIGHT_PX = 0.8 * LOGICAL_DPI;
const FOOTER_GAP_PX = 10;

const CONTENT_HEIGHT_PX =
  LOGICAL_PAGE_HEIGHT - PADDING_PX - BOTTOM_MARGIN_PX - FOOTER_HEIGHT_PX - FOOTER_GAP_PX;
const FULL_HEIGHT_PX = LOGICAL_PAGE_HEIGHT - PADDING_PX - BOTTOM_MARGIN_PX;

const BRANDING_OFFSET = 1.05 * LOGICAL_DPI;

const MARGIN_STD = 16;
const MARGIN_COMPACT = 8;

const INTERNAL_COL_GAP = 16;

type LayoutItemType =
  | "date-header"
  | "section-header"
  | "event"
  | "workshop-venue-header"
  | "workshop-event"
  | "sponsor"
  | "main-header";

interface LayoutItem {
  id: string;
  type: LayoutItemType;
  content: unknown;
}

interface WorkshopHeaderContent {
  venue: string;
  events: ProcessedEvent[];
  isContinuation?: boolean;
}

function getDynamicItemMargin(
  type: LayoutItemType,
  paddingSetting: number,
): number {
  let margin = MARGIN_STD;
  if (type === "section-header") margin = MARGIN_COMPACT;
  if (type === "workshop-venue-header") margin = 0;
  if (type === "workshop-event") margin = 0;
  if (type === "sponsor") margin = MARGIN_STD;
  if (type === "main-header") margin = 24;

  if (paddingSetting < 4) {
    const reduction = (4 - paddingSetting) * 0.75;
    margin = Math.max(1, margin - reduction);
  }
  if (type === "date-header") {
    margin = Math.max(4, 12 + (paddingSetting - 4));
  }
  return Math.round(margin);
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function MainHeaderBlock({ title, color }: { title: string; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    let fontSize = 48;
    text.style.fontSize = `${fontSize}px`;
    text.style.whiteSpace = "nowrap";
    const maxWidth = container.clientWidth;
    if (maxWidth <= 0) return;

    while (text.scrollWidth > maxWidth && fontSize > 10) {
      fontSize -= 1;
      text.style.fontSize = `${fontSize}px`;
    }
  });

  return (
    <div ref={containerRef} className="flex flex-col justify-start w-full overflow-hidden">
      <h1
        ref={textRef}
        className="header-font font-bold uppercase tracking-tighter leading-none mb-1 whitespace-nowrap"
        style={{ color, fontSize: "48px" }}
      >
        {title}
      </h1>
      <h2
        className="header-font text-sm font-bold opacity-70 uppercase tracking-widest leading-tight"
        style={{ color }}
      >
        Online &amp; In-Person Events
      </h2>
    </div>
  );
}

function DateHeader({
  text,
  bgColor,
  padding,
  width = "full",
}: {
  text: string;
  bgColor: string;
  padding: number;
  width?: "full" | "fit";
}) {
  return (
    <div
      className={`text-white px-4 pointer-events-none rounded-sm flex items-center justify-center -ml-1 ${
        width === "full" ? "w-full" : "w-fit"
      }`}
      style={{
        backgroundColor: bgColor,
        paddingTop: `${Math.max(0, padding)}px`,
        paddingBottom: `${Math.max(0, padding)}px`,
        minHeight: `${Math.max(20, 24 + padding * 2)}px`,
      }}
    >
      <h3 className="header-font text-lg font-bold uppercase tracking-widest leading-none m-0 whitespace-nowrap">
        {text}
      </h3>
    </div>
  );
}

function SectionHeader({
  text,
  color,
  padding,
  width = "full",
}: {
  text: string;
  color: string;
  padding: number;
  width?: "full" | "fit";
}) {
  return (
    <div
      className={`text-white px-4 py-2 pointer-events-none rounded-sm flex items-center justify-center -ml-1 ${
        width === "full" ? "w-full" : "w-fit"
      }`}
      style={{
        backgroundColor: color,
        paddingTop: `${Math.max(0, padding)}px`,
        paddingBottom: `${Math.max(0, padding)}px`,
        minHeight: `${Math.max(20, 24 + padding * 2)}px`,
      }}
    >
      <h3 className="header-font text-lg font-bold uppercase tracking-widest leading-none m-0 text-center">
        {text}
      </h3>
    </div>
  );
}

function BrandingBlock({ linkColor }: { linkColor: string }) {
  return (
    <div className="flex items-stretch justify-end gap-3 w-full h-full select-none pointer-events-none">
      <div className="text-right h-full flex flex-col justify-center py-1 gap-3">
        <div className="flex flex-col items-end text-gray-900 leading-none">
          <p className="header-font text-[15px] font-bold text-black tracking-tight mb-0.5">
            NWCT Arts Council
          </p>
          <p className="text-[11px] font-medium text-gray-600 leading-tight">
            40 Main Street, Suite 1
          </p>
          <p className="text-[11px] font-medium text-gray-600 leading-tight">
            Torrington, CT 06790
          </p>
        </div>
        <div className="flex flex-col items-end text-gray-900 leading-none">
          <p className="text-[12px] font-medium text-gray-800 tracking-wide mb-0.5">
            860.618.0075
          </p>
          <p
            className="header-font text-[15px] font-bold tracking-wide"
            style={{ color: linkColor }}
          >
            artsnwct.org
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function QrPlaceholder({ label }: { label: string }) {
  // Inline placeholder block. Visual stand-in for a printable QR code —
  // production QR rendering can be added behind a server-side path later
  // (see TODO at top of file).
  return (
    <div className="bg-white border border-gray-300 shrink-0 flex items-center justify-center text-[7px] uppercase text-gray-400 font-bold tracking-wider"
      style={{ width: 58, height: 58 }}
    >
      {label}
    </div>
  );
}

function FooterSegment({
  slot,
  linkColor,
  onDelete,
  onRestore,
  onUpload,
}: {
  slot: FooterSlot;
  linkColor: string;
  onDelete: () => void;
  onRestore: () => void;
  onUpload: (files: File[]) => void;
}) {
  const renderDeleteButton = () => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 print:hidden cursor-pointer z-20"
      title="Clear/Remove Slot"
    >
      <X size={12} />
    </button>
  );

  if (slot.type === "removed") {
    return (
      <div className="w-full h-full flex flex-col justify-end items-center pointer-events-none">
        <button
          onClick={onRestore}
          className="mb-1 p-1 bg-white/50 hover:bg-blue-100 rounded-full text-blue-400 hover:text-blue-600 shadow-sm pointer-events-auto transition-colors print:hidden opacity-50 hover:opacity-100"
          title="Restore Slot"
        >
          <PlusCircle size={16} />
        </button>
      </div>
    );
  }

  if (slot.type === "info") {
    return (
      <div className="relative group w-full h-full flex items-center gap-3 justify-start bg-transparent">
        <QrPlaceholder label="QR" />
        <div className="flex flex-col justify-center">
          <h4 className="header-font font-bold text-black uppercase text-lg leading-none tracking-tight mb-0.5 whitespace-nowrap">
            MORE DETAILS
          </h4>
          <p
            className="header-font font-bold text-sm leading-none tracking-wide uppercase"
            style={{ color: linkColor }}
          >
            ARTSNWCT.ORG/EVENTS-1
          </p>
        </div>
      </div>
    );
  }

  if (slot.type === "donate") {
    return (
      <div className="relative group w-full h-full flex items-center gap-3 justify-end bg-transparent">
        <div className="flex flex-col items-end justify-center">
          <h4 className="header-font font-bold text-black uppercase text-lg leading-none tracking-tight mb-0.5 whitespace-nowrap text-right">
            DONATE TO THE COUNCIL
          </h4>
          <p
            className="header-font font-bold text-sm leading-none tracking-wide uppercase text-right"
            style={{ color: linkColor }}
          >
            ARTSNWCT.ORG/DONATE
          </p>
        </div>
        <QrPlaceholder label="QR" />
      </div>
    );
  }

  const hasImage = slot.type === "image" && slot.content;
  return (
    <div
      className={`h-[58px] w-full flex flex-col items-center justify-center relative group overflow-hidden rounded-lg border-2 ${
        hasImage
          ? "border-transparent bg-transparent"
          : "border-dashed border-gray-200 bg-gray-50/50 hover:bg-blue-50/50 hover:border-blue-300 print:border-transparent print:bg-transparent"
      }`}
    >
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.content}
            alt="Sponsor"
            className="w-full h-full object-contain pointer-events-none"
          />
          {renderDeleteButton()}
        </>
      ) : (
        <div className="relative w-full h-full">
          {renderDeleteButton()}
          <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center print:hidden">
            <ImageIcon size={18} className="mb-0.5 opacity-50 text-gray-400 group-hover:text-blue-400" />
            <span className="text-[8px] font-bold uppercase tracking-wider text-gray-300 group-hover:text-blue-400">
              Logo
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onUpload(Array.from(e.target.files));
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function PageFooter({
  slots,
  linkColor,
  startIndex,
  onUpload,
  onDelete,
  onRestore,
}: {
  slots: FooterSlot[];
  linkColor: string;
  startIndex: number;
  onUpload: (index: number, files: File[]) => void;
  onDelete: (index: number) => void;
  onRestore: (index: number) => void;
}) {
  return (
    <div
      className="page-footer-dropzone w-full grid grid-cols-3 items-center pointer-events-none"
      style={{ height: `${FOOTER_HEIGHT_PX}px`, gap: `${INTERNAL_COL_GAP}px` }}
    >
      {slots.map((slot, idx) => {
        const globalIdx = startIndex + idx;
        return (
          <div
            key={idx}
            className="flex items-center justify-center h-full w-full pointer-events-auto"
          >
            <FooterSegment
              slot={slot}
              linkColor={linkColor}
              onDelete={() => onDelete(globalIdx)}
              onRestore={() => onRestore(globalIdx)}
              onUpload={(files) => onUpload(globalIdx, files)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function PrintLayout({
  data,
  onEventUpdate,
  onDeleteEvent,
  selectedIds,
  onToggleSelection,
  cardStyles,
  sponsors,
  onDeleteSponsor,
  footerSlots,
  onFooterSlotUpload,
  onFooterSlotDelete,
  onFooterSlotRestore,
  calendarPageCount,
  coverConfig,
  onCoverUpdate,
  adPages,
  onAdPageUpdate,
  onAdPageDelete,
  isExporting = false,
}: PrintLayoutProps) {
  const measureContainerRef = useRef<HTMLDivElement>(null);

  const totalCalendarColumns = calendarPageCount * 3;
  const [columns, setColumns] = useState<LayoutItem[][]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const foldGap = cardStyles.columnGap ?? 32;
  const halfFoldGap = foldGap / 2;

  const effectiveContentWidth = LOGICAL_PAGE_WIDTH - PADDING_PX - halfFoldGap;
  const colWidth = (effectiveContentWidth - INTERNAL_COL_GAP * 2) / 3;

  const dateHeaderBg = cardStyles.dateHeaderBgColor || "#7FA5BC";
  const sectionHeaderBg = dateHeaderBg;
  const monthTitleColor = cardStyles.monthTitleColor || "#7FA5BC";
  const websiteLinkColor = cardStyles.websiteLinkColor || "#7FA5BC";
  const workshopHeaderBg = cardStyles.workshopHeaderBgColor || "#C7D4DF";
  const workshopBg = cardStyles.workshopBgColor || "#E5EDF1";
  const dateHeaderPadding = cardStyles.dateHeaderPadding ?? 8;
  const headerWidth = cardStyles.headerWidth || "full";

  const linearItems = useMemo<LayoutItem[]>(() => {
    const rawList: LayoutItem[] = [];
    const sponsorsByTarget: Record<string, Sponsor[]> = {};
    const orphanedSponsors: Sponsor[] = [];
    sponsors.forEach((s) => {
      if (s.afterId) {
        if (!sponsorsByTarget[s.afterId]) sponsorsByTarget[s.afterId] = [];
        sponsorsByTarget[s.afterId].push(s);
      } else {
        orphanedSponsors.push(s);
      }
    });

    const visitedIds = new Set<string>();
    const pushItem = (item: LayoutItem) => {
      if (visitedIds.has(item.id)) return;
      visitedIds.add(item.id);
      rawList.push(item);
      if (sponsorsByTarget[item.id]) {
        const followers = sponsorsByTarget[item.id];
        delete sponsorsByTarget[item.id];
        followers.forEach((s) => {
          pushItem({ type: "sponsor", id: s.id, content: s });
        });
      }
    };

    pushItem({
      type: "main-header",
      id: "main-title-block",
      content: data.monthTitle,
    });

    data.sortedDateKeys.forEach((date) => {
      pushItem({ type: "date-header", id: `dh-${date}`, content: date });
      (data.shortRuns[date] ?? []).forEach((evt) =>
        pushItem({ type: "event", id: evt.id, content: evt }),
      );
    });

    if (data.longRuns.length > 0) {
      pushItem({ type: "section-header", id: "sh-long", content: "Long Runs" });
      data.longRuns.forEach((evt) =>
        pushItem({ type: "event", id: evt.id, content: evt }),
      );
    }

    if (data.workshops.length > 0) {
      pushItem({
        type: "section-header",
        id: "sh-work",
        content: "Workshops",
      });
      const workshopGroups: Record<string, ProcessedEvent[]> = {};
      data.workshops.forEach((evt) => {
        const v = evt.venue || "Other Locations";
        if (!workshopGroups[v]) workshopGroups[v] = [];
        workshopGroups[v].push(evt);
      });
      Object.keys(workshopGroups)
        .sort()
        .forEach((venue) => {
          const venueEvents = workshopGroups[venue];
          pushItem({
            type: "workshop-venue-header",
            id: `wvh-${venue}`,
            content: { venue, events: venueEvents } satisfies WorkshopHeaderContent,
          });
          venueEvents.forEach((evt) => {
            pushItem({
              type: "workshop-event",
              id: evt.id,
              content: evt,
            });
          });
        });
    }

    orphanedSponsors.forEach((s) =>
      pushItem({ type: "sponsor", id: s.id, content: s }),
    );
    Object.values(sponsorsByTarget)
      .flat()
      .forEach((s) => pushItem({ type: "sponsor", id: s.id, content: s }));

    return rawList;
  }, [data, sponsors]);

  // Watch for size changes that might require a relayout.
  useEffect(() => {
    if (!measureContainerRef.current) return;
    const observer = new ResizeObserver(() =>
      setLayoutRevision((r) => r + 1),
    );
    Array.from(measureContainerRef.current.children).forEach((child) =>
      observer.observe(child as Element),
    );
    return () => observer.disconnect();
  }, [linearItems.length]);

  useLayoutEffect(() => {
    if (!measureContainerRef.current) return;

    const children = Array.from(
      measureContainerRef.current.children,
    ) as HTMLElement[];
    const newColumns: LayoutItem[][] = Array.from(
      { length: totalCalendarColumns },
      () => [],
    );

    let colIndex = 0;
    let currentH = 0;
    const currentPadding = cardStyles.padding ?? 4;

    children.forEach((el, index) => {
      if (colIndex >= totalCalendarColumns) return;

      const isFooterRemoved =
        footerSlots[colIndex] && footerSlots[colIndex].type === "removed";
      const maxH = isFooterRemoved ? FULL_HEIGHT_PX : CONTENT_HEIGHT_PX;

      const itemData = linearItems[index];
      if (!itemData) return;
      const itemH = el.offsetHeight;
      const margin = getDynamicItemMargin(itemData.type, currentPadding);
      const totalSpace = itemH + margin;

      let forceBreak = false;
      if (
        itemData.type === "date-header" ||
        itemData.type === "section-header" ||
        itemData.type === "workshop-venue-header"
      ) {
        const nextEl = children[index + 1] as HTMLElement | undefined;
        const nextItemData = linearItems[index + 1];
        if (nextEl && nextItemData) {
          const nextH = nextEl.offsetHeight;
          const nextMargin = getDynamicItemMargin(
            nextItemData.type,
            currentPadding,
          );
          if (currentH + totalSpace + nextH + nextMargin > maxH) forceBreak = true;
        }
      }

      if (forceBreak || currentH + totalSpace > maxH) {
        colIndex++;
        currentH = 0;
        if (colIndex === totalCalendarColumns - 1)
          currentH = BRANDING_OFFSET + MARGIN_STD;
        if (colIndex >= totalCalendarColumns) {
          newColumns[totalCalendarColumns - 1].push(itemData);
          return;
        }

        // Continuation headers
        if (
          itemData.type === "event" &&
          (itemData.content as ProcessedEvent).category === "LongRun"
        ) {
          newColumns[colIndex].push({
            id: `cont-header-lr-${colIndex}`,
            type: "section-header",
            content: "Long Runs (Cont.)",
          });
          currentH += 56;
        } else if (itemData.type === "workshop-event") {
          const venue = (itemData.content as ProcessedEvent).venue;
          const venueEvents = data.workshops.filter((e) => e.venue === venue);
          newColumns[colIndex].push({
            id: `cont-header-ws-${colIndex}-${venue}`,
            type: "workshop-venue-header",
            content: {
              venue,
              events: venueEvents,
              isContinuation: true,
            } satisfies WorkshopHeaderContent,
          });
          currentH += 32;
        }
      }

      newColumns[colIndex].push(itemData);
      currentH += totalSpace;
    });

    setColumns(newColumns);
  }, [
    linearItems,
    cardStyles,
    layoutRevision,
    totalCalendarColumns,
    footerSlots,
    data.workshops,
  ]);

  const lastFilledGlobalColIndex = useMemo(() => {
    for (let i = columns.length - 1; i >= 0; i--) {
      if (columns[i] && columns[i].length > 0) return i;
    }
    return -1;
  }, [columns]);

  const renderItemContent = (item: LayoutItem, shouldFill: boolean = false) => {
    switch (item.type) {
      case "main-header":
        return (
          <MainHeaderBlock title={item.content as string} color={monthTitleColor} />
        );
      case "date-header":
        return (
          <DateHeader
            text={item.content as string}
            bgColor={dateHeaderBg}
            padding={dateHeaderPadding}
            width={headerWidth}
          />
        );
      case "section-header": {
        const isLongRun = (item.content as string).toLowerCase().includes("long run");
        return (
          <SectionHeader
            text={item.content as string}
            color={isLongRun ? "#000000" : sectionHeaderBg}
            padding={dateHeaderPadding}
            width={headerWidth}
          />
        );
      }
      case "workshop-venue-header": {
        const wsHeader = item.content as WorkshopHeaderContent;
        return (
          <div
            className="group/venue shadow-sm"
            style={{ backgroundColor: workshopBg }}
          >
            <WorkshopVenueHeader
              venue={wsHeader.venue}
              events={wsHeader.events}
              onUpdate={onEventUpdate}
              headerColor={workshopHeaderBg}
              isContinuation={wsHeader.isContinuation}
              isExporting={isExporting}
            />
          </div>
        );
      }
      case "workshop-event":
        return (
          <div
            className={`group/venue px-1.5 ${
              shouldFill ? "h-full flex flex-col" : ""
            }`}
            style={{ backgroundColor: workshopBg }}
          >
            <WorkshopEvent
              event={item.content as ProcessedEvent}
              isSelected={selectedIds.has(item.id)}
              onToggle={onToggleSelection}
              onUpdate={onEventUpdate}
              onDelete={onDeleteEvent}
              isExporting={isExporting}
              fillHeight={shouldFill}
              cardStyles={cardStyles}
            />
          </div>
        );
      case "event":
        return (
          <EventCard
            event={item.content as ProcessedEvent}
            isSelected={selectedIds.has(item.id)}
            onToggle={onToggleSelection}
            onUpdate={onEventUpdate}
            onDelete={onDeleteEvent}
            cardStyles={cardStyles}
            isExporting={isExporting}
            fillHeight={shouldFill}
          />
        );
      case "sponsor":
        return (
          <SponsorBlock
            sponsor={item.content as Sponsor}
            onDelete={onDeleteSponsor}
            paddingTop={cardStyles.sponsorPaddingTop}
            paddingBottom={cardStyles.sponsorPaddingBottom}
          />
        );
      default:
        return null;
    }
  };

  const totalPages = 1 + calendarPageCount + adPages.length;

  const renderPage = (globalPageIndex: number) => {
    if (globalPageIndex === 0)
      return <CoverPage config={coverConfig} onUpdate={onCoverUpdate} />;

    const isLeftPage = globalPageIndex % 2 !== 0;
    const paddingLeft = isLeftPage ? PADDING_PX : halfFoldGap;
    const paddingRight = isLeftPage ? halfFoldGap : PADDING_PX;
    const calendarIndex = globalPageIndex - 1;

    if (calendarIndex >= 0 && calendarIndex < calendarPageCount) {
      const pageColumns = columns.slice(
        calendarIndex * 3,
        calendarIndex * 3 + 3,
      );
      const isLastCalendarPage = calendarIndex === calendarPageCount - 1;

      return (
        <div
          className="relative bg-white overflow-hidden"
          style={{
            width: `${LOGICAL_PAGE_WIDTH}px`,
            height: `${LOGICAL_PAGE_HEIGHT}px`,
          }}
        >
          <div
            className="flex absolute"
            style={{
              top: `${PADDING_PX}px`,
              left: `${paddingLeft}px`,
              width: `${effectiveContentWidth}px`,
              height: `${FULL_HEIGHT_PX}px`,
              gap: `${INTERNAL_COL_GAP}px`,
            }}
          >
            {pageColumns.map((colItems, colLocalIdx) => {
              const globalColIndex = calendarIndex * 3 + colLocalIdx;
              const isLastColumnOnPage = colLocalIdx === 2;
              const isFinalBookColumn =
                globalColIndex >= lastFilledGlobalColIndex;

              const isFooterRemoved =
                footerSlots[globalColIndex] &&
                footerSlots[globalColIndex].type === "removed";
              const columnHeight: CSSProperties["height"] = isFooterRemoved
                ? "100%"
                : `${CONTENT_HEIGHT_PX}px`;

              return (
                <div
                  key={colLocalIdx}
                  className="flex flex-col"
                  style={{ width: `${colWidth}px`, height: columnHeight }}
                >
                  {isLastCalendarPage && isLastColumnOnPage && (
                    <div
                      style={{
                        height: `${BRANDING_OFFSET}px`,
                        flexShrink: 0,
                        marginBottom: `${MARGIN_STD}px`,
                      }}
                    >
                      <BrandingBlock linkColor={websiteLinkColor} />
                    </div>
                  )}
                  {colItems?.map((item) => {
                    let shouldFill = false;
                    let flexClass = "";
                    if (!isFinalBookColumn) {
                      if (item.type === "event" || item.type === "workshop-event") {
                        shouldFill = true;
                        flexClass = "grow";
                      } else {
                        flexClass = "grow-0";
                      }
                    }
                    const margin = getDynamicItemMargin(
                      item.type,
                      cardStyles.padding ?? 4,
                    );
                    return (
                      <div
                        key={item.id}
                        data-layout-id={item.id}
                        className={flexClass}
                        style={{ marginBottom: `${margin}px` }}
                      >
                        {renderItemContent(item, shouldFill)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div
            className="absolute"
            style={{
              bottom: `${BOTTOM_MARGIN_PX}px`,
              left: `${paddingLeft}px`,
              width: `${effectiveContentWidth}px`,
              height: `${FOOTER_HEIGHT_PX}px`,
              zIndex: 10,
            }}
          >
            <PageFooter
              slots={footerSlots.slice(
                calendarIndex * 3,
                calendarIndex * 3 + 3,
              )}
              linkColor={websiteLinkColor}
              startIndex={calendarIndex * 3}
              onUpload={onFooterSlotUpload}
              onDelete={onFooterSlotDelete}
              onRestore={onFooterSlotRestore}
            />
          </div>
        </div>
      );
    }

    const adIndex = globalPageIndex - 1 - calendarPageCount;
    if (adIndex >= 0 && adIndex < adPages.length) {
      return (
        <div
          className="w-full h-full"
          style={{
            paddingLeft: `${paddingLeft}px`,
            paddingRight: `${paddingRight}px`,
            paddingTop: `${PADDING_PX}px`,
            paddingBottom: `${PADDING_PX}px`,
            width: `${LOGICAL_PAGE_WIDTH}px`,
            height: `${LOGICAL_PAGE_HEIGHT}px`,
          }}
        >
          <AdPage
            config={adPages[adIndex]}
            onUpdate={onAdPageUpdate}
            onDelete={onAdPageDelete}
          />
        </div>
      );
    }
    return (
      <div
        className="w-full h-full"
        style={{
          width: `${LOGICAL_PAGE_WIDTH}px`,
          height: `${LOGICAL_PAGE_HEIGHT}px`,
        }}
      />
    );
  };

  return (
    <div
      className="relative flex flex-col items-start print:block min-w-fit"
      style={{ gap: "96px" }}
    >
      {/* Hidden measurement column — kept off-screen but in the document so we
          can read child offsetHeights to pack the real columns. */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        className="absolute top-0 left-0 pointer-events-none opacity-0 z-[-1]"
        style={{ width: `${colWidth}px` }}
      >
        {linearItems.map((item) => (
          <div
            key={`measure-${item.id}`}
            style={{ marginBottom: 0, overflow: "hidden" }}
          >
            {renderItemContent(item)}
          </div>
        ))}
      </div>

      {/* Cover page */}
      <div
        id="page-0"
        className="bg-white relative shadow-2xl print:shadow-none print:m-0 box-border text-gray-900 overflow-hidden print:break-after-page calendar-page-export shrink-0"
        style={{
          width: `${LOGICAL_PAGE_WIDTH}px`,
          height: `${LOGICAL_PAGE_HEIGHT}px`,
          padding: 0,
          marginBottom: "96px",
        }}
      >
        {renderPage(0)}
      </div>

      {/* Spreads */}
      {totalPages > 1 && (
        <div
          className="flex flex-col items-start print:block shrink-0"
          style={{ width: `${LOGICAL_PAGE_WIDTH * 2}px`, gap: "96px" }}
        >
          {Array.from({ length: Math.ceil((totalPages - 1) / 2) }).map((_, i) => {
            const spreadIndex = i;
            const leftPageIndex = spreadIndex * 2 + 1;
            const rightPageIndex = leftPageIndex + 1;
            return (
              <div
                key={`spread-${spreadIndex}`}
                className="flex w-full items-start justify-start print:block print:w-full print:h-auto print:m-0"
              >
                <div
                  id={`page-${leftPageIndex}`}
                  className="bg-white relative box-border text-gray-900 overflow-hidden print:break-after-page print:float-left print:border-none calendar-page-export"
                  style={{
                    width: `${LOGICAL_PAGE_WIDTH}px`,
                    height: `${LOGICAL_PAGE_HEIGHT}px`,
                    padding: 0,
                    boxShadow:
                      "inset -1px 0 0 0 #e5e7eb, inset 0 1px 0 0 #e5e7eb, inset 0 -1px 0 0 #e5e7eb",
                  }}
                >
                  <div className="absolute inset-y-0 left-0 w-px bg-gray-200" />
                  {renderPage(leftPageIndex)}
                </div>
                {rightPageIndex < totalPages && (
                  <div
                    id={`page-${rightPageIndex}`}
                    className="bg-white relative box-border text-gray-900 overflow-hidden print:break-after-page print:float-left print:border-none calendar-page-export"
                    style={{
                      width: `${LOGICAL_PAGE_WIDTH}px`,
                      height: `${LOGICAL_PAGE_HEIGHT}px`,
                      padding: 0,
                      boxShadow:
                        "inset 1px 0 0 0 #e5e7eb, inset 0 1px 0 0 #e5e7eb, inset 0 -1px 0 0 #e5e7eb",
                    }}
                  >
                    <div className="absolute inset-y-0 right-0 w-px bg-gray-200" />
                    {renderPage(rightPageIndex)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
