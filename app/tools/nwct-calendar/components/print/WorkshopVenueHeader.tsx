"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { ProcessedEvent } from "../../lib/types";

interface Props {
  venue: string;
  events: ProcessedEvent[];
  onUpdate: (e: ProcessedEvent) => void;
  headerColor: string;
  isContinuation?: boolean;
  isExporting?: boolean;
}

export function WorkshopVenueHeader({
  venue,
  events,
  onUpdate,
  headerColor,
  isContinuation,
  isExporting = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const firstEvent = events[0];
  const [formData, setFormData] = useState({
    venue,
    town: firstEvent?.town || "",
    website: firstEvent?.website || "",
  });

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    events.forEach((evt) => {
      onUpdate({
        ...evt,
        venue: formData.venue,
        town: formData.town,
        website: formData.website,
      });
    });
    setIsEditing(false);
  };

  const showEditMode = isEditing && !isExporting;

  return (
    <div
      className="px-2 py-1 relative rounded-t-sm"
      style={{ backgroundColor: headerColor }}
    >
      {!showEditMode ? (
        <>
          <h4 className="font-bold text-black leading-none text-[12px] uppercase tracking-wide pr-5">
            {venue}
            {isContinuation ? " (Cont.)" : ""}
          </h4>
          {!isContinuation && (
            <p className="text-[10px] text-gray-800 leading-tight mt-0.5 truncate font-normal pr-5">
              {formData.town}
              {formData.town && formData.website ? ", " : ""}
              {formData.website}
            </p>
          )}
          {!isContinuation && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-1 right-1 p-0.5 opacity-0 group-hover/venue:opacity-100 text-gray-500 hover:text-blue-600 transition-all print:hidden"
              title="Edit venue"
            >
              <Pencil size={12} />
            </button>
          )}
        </>
      ) : (
        <div className="space-y-1 py-1" onClick={(e) => e.stopPropagation()}>
          <input
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            className="w-full text-[11px] font-bold uppercase bg-white border-b border-gray-300 outline-none px-1 text-gray-900"
            autoFocus
          />
          <div className="flex gap-1">
            <input
              value={formData.town}
              onChange={(e) => setFormData({ ...formData, town: e.target.value })}
              className="w-1/2 text-[10px] bg-white border-b border-gray-300 outline-none px-1 text-gray-700"
              placeholder="Town"
            />
            <input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-1/2 text-[10px] bg-white border-b border-gray-300 outline-none px-1 text-gray-700"
              placeholder="Website"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setIsEditing(false)}
              className="text-gray-500 hover:text-red-500"
            >
              <X size={12} />
            </button>
            <button
              onClick={handleSave}
              className="text-green-700 font-bold"
            >
              <Check size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
