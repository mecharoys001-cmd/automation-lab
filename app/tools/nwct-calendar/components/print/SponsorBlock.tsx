"use client";

import { Trash2 } from "lucide-react";
import type { Sponsor } from "../../lib/types";

interface Props {
  sponsor: Sponsor;
  onDelete: (id: string) => void;
  paddingTop?: number;
  paddingBottom?: number;
  isExporting?: boolean;
}

export function SponsorBlock({
  sponsor,
  onDelete,
  paddingTop = 0,
  paddingBottom = 16,
  isExporting = false,
}: Props) {
  return (
    <div
      style={{
        marginTop: `${paddingTop}px`,
        marginBottom: `${paddingBottom}px`,
      }}
      className="relative group break-inside-avoid"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.imageUrl}
        alt={sponsor.name ?? "Sponsor"}
        className="w-full h-auto object-contain border border-transparent rounded-sm"
      />
      {!isExporting && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(sponsor.id);
          }}
          className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 shadow-sm hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
          title="Remove sponsor from the calendar"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
