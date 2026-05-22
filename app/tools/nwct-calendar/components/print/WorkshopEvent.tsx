"use client";

import { useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import {
  Check,
  CheckCircle2,
  GripVertical,
  Move,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { CardStyles, ProcessedEvent } from "../../lib/types";
import { formatShortDate, isValidDate } from "../../lib/dateFormat";
import {
  EVENT_DRAG_MIME,
  SPONSOR_DRAG_MIME,
  dropPositionFromEvent,
} from "./EventCard";

interface WorkshopEventProps {
  event: ProcessedEvent;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onUpdate: (e: ProcessedEvent) => void;
  onDelete: (id: string) => void;
  isExporting?: boolean;
  fillHeight?: boolean;
  cardStyles?: CardStyles;
  onReorderEvent?: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
  onAnchorSponsor?: (sponsorId: string, targetId: string) => void;
}

function toIsoDateInputValue(d: Date): string {
  if (!isValidDate(d)) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDateRange(e: ProcessedEvent): string {
  if (e.dateRange) return e.dateRange;
  const sameDay =
    e.startAt &&
    e.endAt &&
    e.startAt.getFullYear() === e.endAt.getFullYear() &&
    e.startAt.getMonth() === e.endAt.getMonth() &&
    e.startAt.getDate() === e.endAt.getDate();
  if (!isValidDate(e.startAt)) return "";
  if (sameDay) return formatShortDate(e.startAt);
  return `${formatShortDate(e.startAt)} thru ${formatShortDate(e.endAt)}`;
}

export function WorkshopEvent({
  event,
  isSelected,
  onToggle,
  onUpdate,
  onDelete,
  isExporting = false,
  fillHeight = false,
  cardStyles,
  onReorderEvent,
  onAnchorSponsor,
}: WorkshopEventProps) {
  type FormData = {
    title: string;
    formattedTime: string;
    venue: string;
    town: string;
    website: string;
    dateRange: string;
    startDate: string;
    endDate: string;
    imageUrl: string;
    imageHeight: number | undefined;
    imagePosition: number;
  };

  const snapshotEvent = (e: ProcessedEvent): FormData => ({
    title: e.title,
    formattedTime: e.formattedTime,
    venue: e.venue,
    town: e.town,
    website: e.website,
    dateRange: defaultDateRange(e),
    startDate: toIsoDateInputValue(e.startAt),
    endDate: toIsoDateInputValue(e.endAt),
    imageUrl: e.imageUrl ?? "",
    imageHeight: e.imageHeight,
    imagePosition: e.imagePosition ?? 50,
  });

  const [formData, setFormData] = useState<FormData | null>(null);
  const isEditing = formData !== null;

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; h: number; p: number }>({
    y: 0,
    h: 0,
    p: 50,
  });

  const updateDisplayDate = (startVal: string, endVal: string): string => {
    if (!startVal) return "";
    const s = new Date(startVal);
    const e = endVal ? new Date(endVal) : s;
    if (!isValidDate(s)) return "";
    if (startVal === endVal) return formatShortDate(s);
    if (!isValidDate(e)) return formatShortDate(s);
    return `${formatShortDate(s)} thru ${formatShortDate(e)}`;
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => {
      if (!prev) return prev;
      const newRange = updateDisplayDate(val, prev.endDate);
      return { ...prev, startDate: val, dateRange: newRange || prev.dateRange };
    });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => {
      if (!prev) return prev;
      const newRange = updateDisplayDate(prev.startDate, val);
      return { ...prev, endDate: val, dateRange: newRange || prev.dateRange };
    });
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formData) return;
    const newStart = formData.startDate ? new Date(formData.startDate) : event.startAt;
    const newEnd = formData.endDate ? new Date(formData.endDate) : event.endAt;
    onUpdate({
      ...event,
      title: formData.title,
      formattedTime: formData.formattedTime,
      venue: formData.venue,
      town: formData.town,
      website: formData.website,
      dateRange: formData.dateRange,
      startAt: isValidDate(newStart) ? newStart : event.startAt,
      endAt: isValidDate(newEnd) ? newEnd : event.endAt,
      imageUrl: formData.imageUrl || undefined,
      imageHeight: formData.imageHeight,
      imagePosition: formData.imagePosition,
    });
    setFormData(null);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(event.id);
  };

  const processFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: reader.result as string,
              imageHeight: undefined,
              imagePosition: 50,
            }
          : prev,
      );
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = "";
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    direction: "top" | "bottom",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imageContainerRef.current || !formData) return;
    dragStartRef.current = {
      y: e.clientY,
      h: imageContainerRef.current.offsetHeight,
      p: formData.imagePosition,
    };

    const onMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartRef.current.y;
      const newHeight =
        direction === "bottom"
          ? Math.max(30, dragStartRef.current.h + deltaY)
          : Math.max(30, dragStartRef.current.h - deltaY);
      setFormData((prev) => (prev ? { ...prev, imageHeight: newHeight } : prev));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handlePanStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!formData || !formData.imageUrl) return;
    dragStartRef.current = {
      y: e.clientY,
      h: 0,
      p: formData.imagePosition,
    };

    const onMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartRef.current.y;
      const shift = deltaY * 0.5;
      const newPos = Math.min(
        100,
        Math.max(0, dragStartRef.current.p - shift),
      );
      setFormData((prev) => (prev ? { ...prev, imagePosition: newPos } : prev));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const displayDateStr = event.dateRange || defaultDateRange(event);
  const showEditMode = isEditing && !isExporting;
  const dragEnabled = !showEditMode && !isExporting;

  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textStyle = useMemo<React.CSSProperties>(
    () => ({
      lineHeight: cardStyles?.lineHeight ?? 1.1,
      letterSpacing: `${cardStyles?.letterSpacing ?? -0.01}em`,
    }),
    [cardStyles?.lineHeight, cardStyles?.letterSpacing],
  );

  const handleRowDragStart = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dragEnabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(EVENT_DRAG_MIME, event.id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleRowDragEnd = () => {
    setIsDragging(false);
    setDropPos(null);
  };

  const handleRowDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    const types = Array.from(e.dataTransfer.types || []);
    if (
      !types.includes(EVENT_DRAG_MIME) &&
      !types.includes(SPONSOR_DRAG_MIME)
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropPos(dropPositionFromEvent(e));
  };

  const handleRowDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    )
      return;
    setDropPos(null);
  };

  const handleRowDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    const eventId = e.dataTransfer.getData(EVENT_DRAG_MIME);
    const sponsorId = e.dataTransfer.getData(SPONSOR_DRAG_MIME);
    if (!eventId && !sponsorId) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = dropPositionFromEvent(e);
    setDropPos(null);
    if (sponsorId && onAnchorSponsor) {
      onAnchorSponsor(sponsorId, event.id);
      return;
    }
    if (eventId && onReorderEvent && eventId !== event.id) {
      onReorderEvent(eventId, event.id, pos);
    }
  };

  if (showEditMode && formData) {
    const fd = formData;
    return (
      <div
        className="relative bg-white border border-blue-300 rounded p-2 z-20 shadow-lg text-xs mb-1 cursor-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <input
            value={fd.title}
            onChange={(e) => setFormData({ ...fd, title: e.target.value })}
            className="w-full font-bold border-b border-gray-200 outline-none bg-white text-gray-900 px-1 py-0.5"
            placeholder="Title"
            autoFocus
          />
          <div className="flex flex-col border-b border-gray-100 py-1">
            <label className="text-[8px] uppercase text-gray-400 font-bold">
              Display Dates
            </label>
            <input
              value={fd.dateRange}
              onChange={(e) => setFormData({ ...fd, dateRange: e.target.value })}
              className="w-full font-bold border-none outline-none bg-white text-gray-800 text-[11px]"
              placeholder="e.g. 12/3 thru 12/5"
            />
          </div>
          <div className="flex gap-2 items-center py-1 border-b border-gray-100">
            <div className="flex flex-col flex-1">
              <label className="text-[8px] uppercase text-gray-400 font-bold">
                Start Date (Sort)
              </label>
              <input
                type="date"
                value={fd.startDate}
                onChange={handleStartChange}
                className="w-full outline-none text-[10px] bg-white text-gray-700 cursor-pointer"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="text-[8px] uppercase text-gray-400 font-bold">
                End Date
              </label>
              <input
                type="date"
                value={fd.endDate}
                onChange={handleEndChange}
                className="w-full outline-none text-[10px] bg-white text-gray-700 cursor-pointer"
              />
            </div>
          </div>
          <input
            value={fd.formattedTime}
            onChange={(e) => setFormData({ ...fd, formattedTime: e.target.value })}
            className="w-full border-b border-gray-200 outline-none text-[10px] bg-white text-gray-700 px-1 py-0.5"
            placeholder="Time (e.g. 10 am - 2 pm)"
          />
          <div className="pt-1 border-t border-gray-50 space-y-1">
            <input
              value={fd.venue}
              onChange={(e) => setFormData({ ...fd, venue: e.target.value })}
              className="w-full border-b border-gray-200 outline-none text-[10px] text-gray-500 italic bg-white px-1 py-0.5"
              placeholder="Specific Venue (if different)"
            />
            <div className="flex gap-1">
              <input
                value={fd.town}
                onChange={(e) => setFormData({ ...fd, town: e.target.value })}
                className="w-1/2 border-b border-gray-200 outline-none text-[9px] text-gray-500 bg-white px-1 py-0.5"
                placeholder="Town"
              />
              <input
                value={fd.website}
                onChange={(e) => setFormData({ ...fd, website: e.target.value })}
                className="w-1/2 border-b border-gray-200 outline-none text-[9px] text-gray-500 bg-white px-1 py-0.5"
                placeholder="Website"
              />
            </div>
          </div>

          <div className="flex gap-2 items-center mt-2 pt-1 border-t border-gray-100">
            <input
              value={fd.imageUrl}
              onChange={(e) => setFormData({ ...fd, imageUrl: e.target.value })}
              className="flex-1 text-[10px] text-gray-500 border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent italic"
              placeholder="Image URL (paste or upload)"
              title="Paste an image URL or use the upload button"
            />
            <label
              className="cursor-pointer p-1.5 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors border border-gray-100 flex items-center justify-center h-[26px] w-[26px]"
              title="Upload image from computer"
            >
              <Upload size={14} className="pointer-events-none" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>
          </div>

          <div
            ref={imageContainerRef}
            className="mt-2 w-full bg-gray-50 rounded border border-dashed border-gray-300 relative group/preview flex items-center justify-center select-none"
            style={{
              height: fd.imageHeight ? `${fd.imageHeight}px` : "auto",
              minHeight: fd.imageUrl ? "60px" : "40px",
              overflow: "hidden",
            }}
          >
            {fd.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fd.imageUrl}
                  className="w-full absolute inset-0 object-cover cursor-move"
                  style={{
                    height: "100%",
                    objectPosition: `center ${fd.imagePosition}%`,
                  }}
                  alt="Preview"
                  onMouseDown={handlePanStart}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                  }}
                />
                <div className="absolute top-1 right-1 z-30">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) =>
                        prev
                          ? {
                              ...prev,
                              imageUrl: "",
                              imageHeight: undefined,
                              imagePosition: 50,
                            }
                          : prev,
                      );
                    }}
                    className="bg-white/80 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full p-1 transition-colors"
                    title="Remove image"
                  >
                    <X size={12} className="pointer-events-none" />
                  </button>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover/preview:opacity-100 transition-opacity bg-black/50 text-white rounded-full p-2">
                  <Move size={16} />
                </div>

                <div
                  className="absolute top-0 left-0 w-full h-3 bg-blue-500/0 hover:bg-blue-500/40 cursor-ns-resize flex items-center justify-center z-20 transition-colors group/resize"
                  onMouseDown={(e) => handleResizeStart(e, "top")}
                  title="Drag to crop from the top"
                >
                  <div className="w-8 h-1 bg-white/50 rounded-full group-hover/resize:bg-white shadow-sm" />
                </div>

                <div
                  className="absolute bottom-0 left-0 w-full h-3 bg-blue-500/0 hover:bg-blue-500/40 cursor-ns-resize flex items-center justify-center z-20 transition-colors group/resize"
                  onMouseDown={(e) => handleResizeStart(e, "bottom")}
                  title="Drag to crop from the bottom"
                >
                  <div className="w-8 h-1 bg-white/50 rounded-full group-hover/resize:bg-white shadow-sm" />
                </div>
              </>
            ) : (
              <div className="text-[10px] text-gray-400 p-2 text-center pointer-events-none">
                No image — paste a URL above or upload a file.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
          <button
            onClick={handleDelete}
            className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
            title="Delete Event"
          >
            <Trash2 size={12} />
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
              title="Cancel"
            >
              <X size={12} />
            </button>
            <button
              onClick={handleSave}
              className="text-green-600 hover:text-green-700 font-bold p-1 rounded transition-colors"
              title="Save Changes"
            >
              <Check size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={dragEnabled}
      onDragStart={handleRowDragStart}
      onDragEnd={handleRowDragEnd}
      onDragOver={handleRowDragOver}
      onDragLeave={handleRowDragLeave}
      onDrop={handleRowDrop}
      className={`group/event relative text-[10.5px] pl-0 pr-1 py-0 flex flex-col
        ${
          isSelected
            ? "bg-[#bfdbfe] ring-2 ring-[#60a5fa] z-10 rounded-sm"
            : "hover:text-[#1e3a8a]"
        }
        ${!showEditMode ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragging ? "opacity-50" : ""}
        ${fillHeight ? "h-full" : ""}
      `}
      style={textStyle}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(event.id);
      }}
      title={dragEnabled ? "Drag to reorder among workshops" : undefined}
    >
      {dropPos === "before" && (
        <div className="pointer-events-none absolute -top-px left-0 right-0 h-0.5 bg-blue-500 print:hidden" />
      )}
      {dropPos === "after" && (
        <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-0.5 bg-blue-500 print:hidden" />
      )}
      {dragEnabled && (
        <div
          className="pointer-events-none absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/event:opacity-60 print:hidden text-gray-400"
          title="Drag to reorder"
        >
          <GripVertical size={10} />
        </div>
      )}
      {isSelected && (
        <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 bg-white rounded-full z-20 print:hidden shadow-sm ring-1 ring-[#dbeafe]">
          <CheckCircle2 size={12} className="text-[#3b82f6] fill-white" />
        </div>
      )}

      <div className="inline">
        <span className="font-bold text-black">{event.title}</span>
        <span className="text-black">; </span>
        <span className="text-black">{displayDateStr}</span>
        {event.formattedTime && (
          <>
            <span className="text-black">; </span>
            <span className="text-black">{event.formattedTime}</span>
          </>
        )}
      </div>

      {event.imageUrl && (
        <div
          className="w-full mt-1.5 overflow-hidden rounded-sm border border-gray-200"
          style={{ height: event.imageHeight ? `${event.imageHeight}px` : "auto" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full object-cover"
            style={{
              height: event.imageHeight ? "100%" : "auto",
              objectPosition: `center ${event.imagePosition ?? 50}%`,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <button
        className="absolute right-0 top-0 opacity-0 group-hover/event:opacity-100 text-gray-500 hover:text-blue-600 print:hidden p-0.5 bg-white/80 rounded backdrop-blur-sm transition-all"
        onClick={(e) => {
          e.stopPropagation();
          setFormData(snapshotEvent(event));
        }}
        title="Edit Event"
      >
        <Pencil size={10} />
      </button>
    </div>
  );
}
