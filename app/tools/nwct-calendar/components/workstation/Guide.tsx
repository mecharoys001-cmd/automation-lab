"use client";

import {
  Download,
  ImagePlus,
  LayoutTemplate,
  MousePointerClick,
  Palette,
  Save,
  Upload,
  Wand2,
  X,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function Guide({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4 sm:p-6">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900 sm:text-2xl">
              User Guide
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Everything you need to create the monthly print calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200"
            aria-label="Close guide"
            title="Close guide"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8 overflow-y-auto p-4 sm:space-y-10 sm:p-8">
          <section className="grid gap-6 sm:gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 border-b border-blue-100 pb-2 text-base font-bold uppercase tracking-wide text-blue-600 sm:text-lg">
                <Upload size={20} /> Getting Started
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">Upload:</span>
                  <span>
                    Drop your Airtable CSV (or any spreadsheet with{" "}
                    <em>Title, Start At, Venue, Town, Website</em>). Headers close to
                    these are auto-mapped.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Load Sample:
                  </span>
                  <span>
                    Loads a built-in example month so you can explore the editor
                    without your own data.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Start Blank:
                  </span>
                  <span>
                    Skip the CSV entirely and open an empty calendar ready for layout
                    and style work.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Load Project:
                  </span>
                  <span>
                    Use the{" "}
                    <span className="mx-1 inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5">
                      <Save size={10} className="mr-1" /> JSON
                    </span>{" "}
                    button to resume a previously saved session.
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 border-b border-purple-100 pb-2 text-base font-bold uppercase tracking-wide text-purple-600 sm:text-lg">
                <MousePointerClick size={20} /> Editing
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">Rows:</span>
                  <span>
                    The grid editor lets you fix titles, times, and venue details
                    before building the layout.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">Cards:</span>
                  <span>
                    Click the pencil on an event card in the preview to edit text and
                    formatting. Hover the trash to remove it.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">Images:</span>
                  <span>
                    Inside an event card editor, paste an image URL or use the upload
                    button to attach a photo. Drag the top/bottom handles to crop, or
                    drag the image itself to reposition.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Undo / Redo:
                  </span>
                  <span>
                    Use the toolbar arrows or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z to step
                    backward and forward through changes.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Select:
                  </span>
                  <span>
                    Click the checkbox on any event card to add it to the selection.
                    A bulk toolbar appears at the bottom with Duplicate, Delete, and
                    Add-to-Cover actions for one or more events at a time.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Drag &amp; drop:
                  </span>
                  <span className="italic text-slate-400">
                    Reordering events between sections lands in a later parity patch.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section className="grid gap-6 sm:gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 border-b border-pink-100 pb-2 text-base font-bold uppercase tracking-wide text-pink-600 sm:text-lg">
                <Wand2 size={20} /> Design Tools
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Style Editor:
                  </span>
                  <span>
                    Open{" "}
                    <span className="font-bold text-slate-700">
                      <Palette size={12} className="inline" /> Style
                    </span>{" "}
                    to tune colors, borders, padding, and typography. Try the{" "}
                    <strong>Smart Theme</strong> picker to auto-generate a palette
                    from a single brand color.
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 border-b border-green-100 pb-2 text-base font-bold uppercase tracking-wide text-green-600 sm:text-lg">
                <LayoutTemplate size={20} /> Booklet Layout
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">Pages:</span>
                  <span>
                    Adjust the calendar page count with the{" "}
                    <strong className="whitespace-nowrap rounded border border-slate-200 bg-slate-100 px-1">
                      + / −
                    </strong>{" "}
                    buttons in the toolbar.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Ad Pages:
                  </span>
                  <span>
                    Add full advertising sections and toggle between full, half, and
                    grid layouts.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">Cover:</span>
                  <span>
                    Drop a hero image onto page 1 and edit the title, subtitle, and
                    credit line directly on the cover. Select one event and use{" "}
                    <strong>Cover</strong> in the bulk toolbar to fill the caption
                    with its title, venue, and town — and use its image if one is
                    set.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section className="grid gap-6 sm:gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 border-b border-orange-100 pb-2 text-base font-bold uppercase tracking-wide text-orange-600 sm:text-lg">
                <ImagePlus size={20} /> Sponsors
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Footer:
                  </span>
                  <span>
                    Drag logo files into the footer slots on each calendar page. Use
                    the trash to free up space; the restore button brings the slot
                    back.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Inline:
                  </span>
                  <span className="italic text-slate-400">
                    Bulk sponsor uploads and in-flow sponsor blocks arrive in a later
                    parity patch.
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 border-b border-slate-200 pb-2 text-base font-bold uppercase tracking-wide text-slate-700 sm:text-lg">
                <Download size={20} /> Exporting
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">PDF:</span>
                  <span>
                    Exports the calendar at its print page size, ready to send to a
                    print shop.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Save Project:
                  </span>
                  <span>
                    Download a JSON project file you can re-load later via{" "}
                    <em>Load project JSON</em> on the upload screen.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="min-w-[80px] font-bold text-slate-900">
                    Save Images:
                  </span>
                  <span className="italic text-slate-400">
                    Per-page PNG export is planned for a later parity patch.
                  </span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-8 py-2.5 font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg"
          >
            Start Creating
          </button>
        </div>
      </div>
    </div>
  );
}
