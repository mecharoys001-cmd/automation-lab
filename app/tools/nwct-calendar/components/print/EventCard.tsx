"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  CheckCircle2,
  Check,
  Move,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { CardStyles, ProcessedEvent } from "../../lib/types";

interface EventCardProps {
  event: ProcessedEvent;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onUpdate: (updatedEvent: ProcessedEvent) => void;
  onDelete: (id: string) => void;
  cardStyles?: CardStyles;
  isExporting?: boolean;
  fillHeight?: boolean;
}

// Spacer is rendered by a dedicated sub-component so it does not share hook
// state with the rich event editor below it. That keeps the hook order
// stable per mounted card instance and avoids any rules-of-hooks issues
// when a spacer is swapped in/out by add/delete/undo.
function SpacerCard({
  event,
  onUpdate,
  onDelete,
  isExporting,
  fillHeight,
}: {
  event: ProcessedEvent;
  onUpdate: (e: ProcessedEvent) => void;
  onDelete: (id: string) => void;
  isExporting: boolean;
  fillHeight: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const height = event.spacerHeight ?? 32;

  return (
    <div
      className={`relative w-full group transition-all ${
        !isExporting ? "hover:bg-gray-50" : ""
      } ${fillHeight ? "h-full min-h-[32px]" : ""}`}
      style={{ height: fillHeight ? "auto" : `${height}px` }}
      onClick={() => {
        if (!isExporting) setIsEditing(true);
      }}
      title={
        isExporting
          ? undefined
          : `Layout spacer (${height}px) — click to edit height or delete`
      }
    >
      {isEditing && !isExporting ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center border border-blue-300 bg-white px-2 shadow-sm">
          <ArrowDownUp size={16} className="mr-2 text-gray-400" />
          <input
            type="range"
            min={10}
            max={300}
            step={2}
            value={height}
            onChange={(e) =>
              onUpdate({ ...event, spacerHeight: parseInt(e.target.value, 10) })
            }
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
            title={`Spacer height: ${height}px`}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="ml-2 w-10 font-mono text-[10px] text-gray-500">
            {height}px
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(event.id);
            }}
            className="ml-2 p-1 text-red-500 hover:text-red-700"
            title="Delete spacer"
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(false);
            }}
            className="ml-1 p-1 text-blue-500 hover:text-blue-700"
            title="Done"
          >
            <Check size={14} />
          </button>
        </div>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${
            !isExporting
              ? "border-2 border-dashed border-transparent group-hover:border-gray-200 print:border-transparent"
              : ""
          }`}
        >
          {!isExporting && (
            <span className="select-none text-[9px] font-bold uppercase text-gray-300 opacity-0 group-hover:opacity-100">
              Spacer {fillHeight ? "(Auto Fill)" : `(${height}px)`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function EventCard(props: EventCardProps) {
  if (props.event.isSpacer) {
    return (
      <SpacerCard
        event={props.event}
        onUpdate={props.onUpdate}
        onDelete={props.onDelete}
        isExporting={props.isExporting ?? false}
        fillHeight={props.fillHeight ?? false}
      />
    );
  }
  return <EventCardInner {...props} />;
}

function EventCardInner({
  event,
  isSelected,
  onToggle,
  onUpdate,
  onDelete,
  cardStyles,
  isExporting = false,
  fillHeight = false,
}: EventCardProps) {
  type FormData = {
    title: string;
    formattedTime: string;
    venue: string;
    town: string;
    website: string;
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
    imageUrl: e.imageUrl ?? "",
    imageHeight: e.imageHeight,
    imagePosition: e.imagePosition ?? 50,
  });

  // formData is null when the card is not being edited. When the user
  // enters edit mode we snapshot the current event into it — that lets us
  // reset cleanly on cancel without needing to sync via useEffect.
  const [formData, setFormData] = useState<FormData | null>(null);
  const isEditing = formData !== null;

  // Refs for image crop/pan interactions. Kept at top-level so hook order
  // stays stable regardless of edit state.
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; h: number; p: number }>({
    y: 0,
    h: 0,
    p: 50,
  });

  const computedStyle = useMemo<React.CSSProperties>(() => {
    if (!cardStyles) return {};
    const cssPadding = Math.max(0, cardStyles.padding);
    const base: React.CSSProperties = {
      padding: `${cssPadding}px`,
      borderRadius: `${cardStyles.borderRadius}px`,
    };
    if (!isSelected) {
      base.borderColor = cardStyles.borderColor;
      base.borderStyle = cardStyles.borderStyle;
      if (cardStyles.showBottomBorder) {
        base.borderBottomWidth = `${cardStyles.borderWidth}px`;
        base.borderTopWidth = 0;
        base.borderLeftWidth = 0;
        base.borderRightWidth = 0;
      } else {
        base.borderWidth = `${cardStyles.borderWidth}px`;
      }
    }
    return base;
  }, [cardStyles, isSelected]);

  const textStyle = useMemo<React.CSSProperties>(
    () => ({
      lineHeight: cardStyles?.lineHeight ?? 1.1,
      letterSpacing: `${cardStyles?.letterSpacing ?? -0.01}em`,
    }),
    [cardStyles?.lineHeight, cardStyles?.letterSpacing],
  );

  const showEditMode = isEditing && !isExporting;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formData) return;
    onUpdate({
      ...event,
      title: formData.title,
      formattedTime: formData.formattedTime,
      venue: formData.venue,
      town: formData.town,
      website: formData.website,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => (prev ? { ...prev, [name]: value } : prev));
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
    // Reset value so re-uploading the same file works.
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

  return (
    <div
      onClick={() => {
        if (!showEditMode) onToggle(event.id);
      }}
      style={computedStyle}
      className={`
        group relative -ml-1 transition-all border-0
        ${
          isSelected
            ? "bg-blue-50 ring-1 ring-blue-400 print:bg-transparent print:ring-0"
            : "hover:bg-gray-50"
        }
        ${showEditMode ? "cursor-auto bg-white border-blue-300 ring-2 ring-blue-200 z-10 shadow-lg" : "cursor-pointer"}
        ${fillHeight ? "h-full flex flex-col" : ""}
      `}
    >
      {isSelected && !showEditMode && (
        <div className="absolute top-1 left-[-4px] text-blue-500 print:hidden z-10">
          <CheckCircle2 size={14} fill="white" />
        </div>
      )}

      {!showEditMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFormData(snapshotEvent(event));
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-white shadow-sm p-1 rounded-full text-gray-500 hover:text-blue-600 transition-all print:hidden z-20 hover:scale-110"
          title="Edit Details"
        >
          <Pencil size={12} className="pointer-events-none" />
        </button>
      )}

      {showEditMode && formData ? (
        <div className="space-y-1 relative cursor-default">
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full font-bold text-[11px] tracking-tight text-gray-900 leading-tight border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent"
            placeholder="Event Title"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2">
            <input
              name="formattedTime"
              value={formData.formattedTime}
              onChange={handleChange}
              className="w-1/3 text-[10px] text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent"
              placeholder="Time"
              onClick={(e) => e.stopPropagation()}
            />
            <input
              name="venue"
              value={formData.venue}
              onChange={handleChange}
              className="w-2/3 text-[10px] text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent"
              placeholder="Venue"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex gap-2">
            <input
              name="town"
              value={formData.town}
              onChange={handleChange}
              className="w-1/3 text-[10px] text-gray-600 border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent"
              placeholder="Town"
              onClick={(e) => e.stopPropagation()}
            />
            <input
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="w-2/3 text-[10px] text-gray-600 border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent"
              placeholder="Website"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex gap-2 items-center">
            <input
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              className="flex-1 text-[10px] text-gray-500 border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent italic"
              placeholder="Image URL (paste or upload)"
              onClick={(e) => e.stopPropagation()}
              title="Paste an image URL or use the upload button"
            />
            <label
              className="cursor-pointer p-1.5 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors border border-gray-100 flex items-center justify-center h-[26px] w-[26px]"
              title="Upload image from computer"
              onClick={(e) => e.stopPropagation()}
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
              height: formData.imageHeight ? `${formData.imageHeight}px` : "auto",
              minHeight: "80px",
              overflow: "hidden",
            }}
          >
            {formData.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.imageUrl}
                  className="w-full absolute inset-0 object-cover cursor-move"
                  style={{
                    height: "100%",
                    objectPosition: `center ${formData.imagePosition}%`,
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

          <div className="flex justify-between items-center mt-2 border-t pt-2 border-gray-100">
            <button
              type="button"
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors relative z-50 flex items-center justify-center"
              title="Delete Event"
            >
              <Trash2 size={14} className="pointer-events-none" />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Cancel"
              >
                <X size={14} className="pointer-events-none" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded font-bold transition-colors"
                title="Save"
              >
                <Check size={14} className="pointer-events-none" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col ${fillHeight ? "h-full justify-between" : ""}`}>
          <div
            className={`w-full relative z-0 pr-4 ${
              fillHeight && !event.imageUrl ? "h-full flex flex-col justify-start" : ""
            }`}
          >
            <h4
              className="font-bold text-[11px] text-gray-900 mb-0.5 pointer-events-none text-balance"
              style={textStyle}
            >
              {event.title}
            </h4>
            <p
              className="text-[10px] text-gray-700 pointer-events-none break-words"
              style={textStyle}
            >
              <span>{event.formattedTime}</span>
              {event.seeReference ? (
                <span className="text-gray-500 italic">; {event.seeReference}</span>
              ) : (
                <>; {event.venue}</>
              )}
            </p>
            {!event.seeReference && (event.town || event.website) && (
              <p
                className="text-[10px] text-gray-600 pointer-events-none break-words"
                style={textStyle}
              >
                {event.town}
                {event.town && event.website ? "; " : ""}
                <span className="break-all">{event.website}</span>
              </p>
            )}
          </div>

          {event.imageUrl && (
            <div
              className="w-full mt-2 overflow-hidden rounded-sm border border-gray-200"
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
        </div>
      )}
    </div>
  );
}
