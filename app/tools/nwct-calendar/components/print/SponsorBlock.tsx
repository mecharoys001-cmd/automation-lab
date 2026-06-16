"use client";

import { useState, type DragEvent as ReactDragEvent } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { Sponsor } from "../../lib/types";
import {
  EVENT_DRAG_MIME,
  SPONSOR_DRAG_MIME,
  dropPositionFromEvent,
} from "./EventCard";

interface Props {
  sponsor: Sponsor;
  onDelete: (id: string) => void;
  paddingTop?: number;
  paddingBottom?: number;
  isExporting?: boolean;
  onAnchorSponsor?: (sponsorId: string, targetId: string) => void;
  onReorderEvent?: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
}

export function SponsorBlock({
  sponsor,
  onDelete,
  paddingTop = 0,
  paddingBottom = 16,
  isExporting = false,
  onAnchorSponsor,
  onReorderEvent,
}: Props) {
  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragEnabled = !isExporting;

  const handleDragStart = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dragEnabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(SPONSOR_DRAG_MIME, sponsor.id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDropPos(null);
  };

  const handleDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    const types = Array.from(e.dataTransfer.types || []);
    if (
      !types.includes(SPONSOR_DRAG_MIME) &&
      !types.includes(EVENT_DRAG_MIME)
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropPos(dropPositionFromEvent(e));
  };

  const handleDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    )
      return;
    setDropPos(null);
  };

  const handleDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    const sponsorId = e.dataTransfer.getData(SPONSOR_DRAG_MIME);
    const eventId = e.dataTransfer.getData(EVENT_DRAG_MIME);
    if (!sponsorId && !eventId) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = dropPositionFromEvent(e);
    setDropPos(null);
    // Sponsor → sponsor: chain anchor to this sponsor's id so they group.
    if (sponsorId && onAnchorSponsor && sponsorId !== sponsor.id) {
      onAnchorSponsor(sponsorId, sponsor.id);
      return;
    }
    // Event → sponsor: forward to the event reorder handler so the event
    // hops past the sponsor. The PrintLayout-side handler treats sponsor
    // targets as no-ops for the event grouping, but we still call it so any
    // future cross-boundary policy lives in one place.
    if (eventId && onReorderEvent) {
      onReorderEvent(eventId, sponsor.id, pos);
    }
  };

  return (
    <div
      draggable={dragEnabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        marginTop: `${paddingTop}px`,
        marginBottom: `${paddingBottom}px`,
      }}
      className={`relative group break-inside-avoid ${
        dragEnabled ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      title={
        dragEnabled
          ? "Drag the sponsor to anchor it after another event or sponsor"
          : undefined
      }
    >
      {dropPos === "before" && (
        <div className="pointer-events-none absolute -top-0.5 left-0 right-0 h-0.5 bg-blue-500 print:hidden" />
      )}
      {dropPos === "after" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-0.5 bg-blue-500 print:hidden" />
      )}
      {dragEnabled && (
        <div
          className="pointer-events-none absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 print:hidden text-gray-400"
          title="Drag to reposition sponsor"
        >
          <GripVertical size={12} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.imageUrl}
        alt={sponsor.name ?? "Sponsor"}
        className="w-full h-auto object-contain border border-transparent rounded-sm pointer-events-none"
      />
      {!isExporting && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(sponsor.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 shadow-sm hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
          title="Remove sponsor from the calendar"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
