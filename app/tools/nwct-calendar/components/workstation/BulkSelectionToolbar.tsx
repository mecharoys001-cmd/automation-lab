"use client";

import { Copy, Star, Trash2, X } from "lucide-react";

interface Props {
  count: number;
  // Enabled only when exactly one event is selected. The caller is
  // responsible for resolving the selected event and short-circuiting if
  // the lookup fails — the toolbar only reflects the live count.
  canAddToCover: boolean;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onAddToCover: () => void;
}

export default function BulkSelectionToolbar({
  count,
  canAddToCover,
  onClearSelection,
  onDeleteSelected,
  onDuplicateSelected,
  onAddToCover,
}: Props) {
  if (count <= 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex w-[92%] -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-white shadow-2xl sm:w-auto sm:gap-4 sm:px-6 sm:py-3 print:hidden">
      <span
        className="whitespace-nowrap text-xs font-semibold sm:text-sm"
        aria-live="polite"
      >
        {count} selected
      </span>
      <button
        type="button"
        onClick={onAddToCover}
        disabled={!canAddToCover}
        className="flex items-center gap-1.5 rounded-md bg-yellow-500 px-2.5 py-1.5 text-xs font-bold text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:px-3"
        title={
          canAddToCover
            ? "Use this event's title/venue/town as the cover credit; uses its image if one is set"
            : "Select a single event to add it to the cover"
        }
      >
        <Star size={14} className="fill-current" />
        <span className="hidden sm:inline">Cover</span>
      </button>
      <button
        type="button"
        onClick={onDuplicateSelected}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-500 sm:px-3"
        title="Duplicate the selected events in place"
      >
        <Copy size={14} />
        <span className="hidden sm:inline">Duplicate</span>
      </button>
      <div className="mx-1 h-4 w-px bg-slate-600" />
      <button
        type="button"
        onClick={onDeleteSelected}
        className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-500 sm:px-3"
        title="Delete the selected events"
      >
        <Trash2 size={14} />
        <span className="hidden sm:inline">Delete</span>
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        title="Clear selection"
        aria-label="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  );
}
