"use client";

import {
  CalendarPlus,
  Download,
  FileType,
  ImagePlus,
  Info,
  LayoutTemplate,
  Minus,
  Paintbrush,
  Plus,
  Redo,
  RotateCcw,
  Save,
  Undo,
} from "lucide-react";

interface Props {
  calendarPageCount: number;
  canUndo: boolean;
  canRedo: boolean;
  exporting?: boolean;

  onAddEvent: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPageCountDecrement: () => void;
  onPageCountIncrement: () => void;
  onAddAdPage: () => void;
  onAddSponsors: () => void;
  onToggleGuide: () => void;
  onToggleStyle: () => void;
  onExportPdf: () => void;
  onSaveImages: () => void;
  onSaveProject: () => void;
  onReset: () => void;
}

export default function WorkstationToolbar({
  calendarPageCount,
  canUndo,
  canRedo,
  exporting,
  onAddEvent,
  onUndo,
  onRedo,
  onPageCountDecrement,
  onPageCountIncrement,
  onAddAdPage,
  onAddSponsors,
  onToggleGuide,
  onToggleStyle,
  onExportPdf,
  onSaveImages,
  onSaveProject,
  onReset,
}: Props) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddEvent}
          className="flex items-center gap-2 whitespace-nowrap rounded-full bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-orange-700"
          title="Add a manually entered event or layout spacer to the calendar"
        >
          <CalendarPlus size={14} />
          <span className="hidden sm:inline">Add Event</span>
        </button>

        <div className="mx-1 flex items-center gap-1 rounded-full bg-muted px-2 py-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-full p-1.5 text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo size={14} />
          </button>
          <div className="mx-1 h-3 w-px bg-border" />
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-full p-1.5 text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)"
          >
            <Redo size={14} />
          </button>
        </div>

        <div className="flex items-center rounded-full bg-muted px-2 py-1">
          <button
            type="button"
            onClick={onPageCountDecrement}
            disabled={calendarPageCount <= 1}
            className="rounded-full p-1 text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-30"
            title="Remove one calendar page"
          >
            <Minus size={14} />
          </button>
          <span className="mx-2 whitespace-nowrap text-xs font-bold text-foreground sm:mx-3 sm:text-sm">
            {calendarPageCount} <span className="hidden sm:inline">Cal. Pages</span>
          </span>
          <button
            type="button"
            onClick={onPageCountIncrement}
            className="rounded-full p-1 text-foreground hover:bg-background"
            title="Add one calendar page"
          >
            <Plus size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={onAddAdPage}
          className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-background"
          title="Add a blank ad page after the calendar pages"
        >
          <LayoutTemplate size={14} />
          <span className="hidden sm:inline">Add Ad Page</span>
        </button>

        <button
          type="button"
          onClick={onAddSponsors}
          className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-background"
          title="Upload one or more sponsor images. If a single event is selected, sponsors anchor after that event; otherwise they append to the end of the flow."
        >
          <ImagePlus size={14} />
          <span className="hidden sm:inline">Add Sponsors</span>
        </button>

        <button
          type="button"
          onClick={onToggleGuide}
          className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-background"
          title="Show the calendar automator guide (coming soon)"
        >
          <Info size={14} />
          <span className="hidden sm:inline">Guide</span>
        </button>

        <button
          type="button"
          onClick={onToggleStyle}
          className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-background"
          title="Open the style editor (coming soon)"
        >
          <Paintbrush size={14} />
          <span className="hidden sm:inline">Style</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          title="Export the calendar as a multi-page PDF"
        >
          <FileType size={16} />
          <span className="hidden sm:inline">{exporting ? "Exporting…" : "PDF"}</span>
        </button>

        <button
          type="button"
          onClick={onSaveImages}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          title="Export each page as a PNG image, zipped if multiple (coming soon)"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Save Images</span>
        </button>

        <button
          type="button"
          onClick={onSaveProject}
          className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-background sm:text-sm"
          title="Download the current project as JSON"
        >
          <Save size={16} />
          <span className="hidden sm:inline">Save Project</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="ml-1 flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-slate-700 sm:text-sm"
          title="Discard the current session and return to the upload step"
        >
          <RotateCcw size={16} />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
    </div>
  );
}
