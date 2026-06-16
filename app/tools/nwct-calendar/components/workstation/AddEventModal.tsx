"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  Calendar,
  Clock,
  Globe,
  Image as ImageIcon,
  MapPin,
  Tag,
  X,
} from "lucide-react";
import type { EventCategory } from "../../lib/types";
import type { NewEventInput } from "../../lib/processEvents";

interface AddEventModalProps {
  onClose: () => void;
  onAdd: (data: NewEventInput) => void;
  defaultDate?: Date;
}

// NOTE: A shared Modal lives at app/tools/scheduler/components/ui/Modal.tsx
// but is tightly coupled to the scheduler's design system (slate buttons,
// Tooltip primitive, focus-trap tuned to that tool). Importing across tools
// would create a cross-tool dependency for one workstation control, so this
// modal is self-contained and follows the same sticky-header/sticky-footer
// rule (shrink-0 header + footer, flex-1 scrollable body) the shared
// component enforces.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function addHoursLocal(d: Date, hours: number): Date {
  const out = new Date(d);
  out.setHours(out.getHours() + hours);
  return out;
}

export default function AddEventModal({
  onClose,
  onAdd,
  defaultDate,
}: AddEventModalProps) {
  // Parent renders the modal only while open, so state lives only for the
  // duration of one open session. Seed once via a lazy initializer — no
  // reset effect is needed because each open is a fresh mount.
  const [isSpacer, setIsSpacer] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(32);
  const [endModified, setEndModified] = useState(false);
  const [form, setForm] = useState(() => {
    const base = defaultDate ?? new Date();
    const start = new Date(base);
    start.setHours(10, 0, 0, 0);
    const end = addHoursLocal(start, 1);
    return {
      title: "",
      category: "ShortRun" as EventCategory,
      venue: "",
      town: "",
      website: "",
      imageUrl: "",
      startAt: toLocalInputValue(start),
      endAt: toLocalInputValue(end),
    };
  });

  // Escape to close, matches the shared Modal behavior.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleStartChange = (val: string) => {
    setForm((prev) => {
      const next = { ...prev, startAt: val };
      if (!endModified) {
        const startDate = new Date(val);
        if (!Number.isNaN(startDate.getTime())) {
          next.endAt = toLocalInputValue(addHoursLocal(startDate, 1));
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSpacer) {
      onAdd({
        ...form,
        title: "Spacer",
        isSpacer: true,
        spacerHeight,
      });
      return;
    }
    if (!form.title.trim() || !form.startAt) return;
    onAdd({ ...form });
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center py-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-modal-title"
        className="relative z-[1010] flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* Sticky header */}
        <div className="shrink-0 flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-5 py-4">
          <h2
            id="add-event-modal-title"
            className="header-font flex items-center gap-2 text-lg font-bold uppercase tracking-tight text-gray-900"
          >
            <Calendar className="text-orange-600" size={22} />
            {isSpacer ? "Insert Layout Spacer" : "Create New Event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-200"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div
              role="tablist"
              aria-label="Add type"
              className="mb-4 flex gap-2 rounded-lg bg-gray-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isSpacer}
                onClick={() => setIsSpacer(false)}
                className={`flex-1 rounded py-1.5 text-xs font-bold transition-colors ${
                  !isSpacer
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                title="Add a real calendar event"
              >
                Event
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSpacer}
                onClick={() => setIsSpacer(true)}
                className={`flex-1 rounded py-1.5 text-xs font-bold transition-colors ${
                  isSpacer
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                title="Insert an invisible spacer to push content down"
              >
                Spacer / Gap
              </button>
            </div>

            {!isSpacer ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                    Title
                  </label>
                  <input
                    required
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: Spring Jazz Festival"
                    title="Event title shown on the card"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <Tag size={12} /> Category
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      title="Where the card should appear in the layout"
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value as EventCategory,
                        })
                      }
                    >
                      <option value="ShortRun">Short Run (Daily)</option>
                      <option value="LongRun">Long Run (Exhibition)</option>
                      <option value="Workshop">Workshop / Class</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <MapPin size={12} /> Town
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      placeholder="Torrington"
                      title="Town the venue is located in"
                      value={form.town}
                      onChange={(e) => setForm({ ...form, town: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                    <MapPin size={12} /> Venue
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder="Warner Theatre"
                    title="Venue name shown on the card"
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <Clock size={12} /> Start Date / Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      title="When the event starts"
                      value={form.startAt}
                      onChange={(e) => handleStartChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <Clock size={12} /> End Date / Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      title="When the event ends"
                      value={form.endAt}
                      onChange={(e) => {
                        setForm({ ...form, endAt: e.target.value });
                        setEndModified(true);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                    <Globe size={12} /> Website
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder="warnertheatre.org"
                    title="Website — only the domain is shown on the card"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                    <ImageIcon size={12} /> Image URL (Optional)
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                    placeholder="https://example.com/image.jpg"
                    title="Optional event image URL; the card image editor can be used later as well"
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm({ ...form, imageUrl: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  A spacer is an invisible block that pushes content down or
                  separates sections. It does not appear in print or PDF output
                  but occupies space in the layout.
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <ArrowDownUp size={12} /> Height
                    </label>
                    <span className="font-mono text-xs">{spacerHeight}px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={300}
                    step={5}
                    value={spacerHeight}
                    onChange={(e) => setSpacerHeight(parseInt(e.target.value, 10))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-orange-600"
                    title={`Spacer height: ${spacerHeight}px`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <Tag size={12} /> Section
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      title="Which section the spacer should appear in"
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value as EventCategory,
                        })
                      }
                    >
                      <option value="ShortRun">Short Run (Daily)</option>
                      <option value="LongRun">Long Run (Exhibition)</option>
                      <option value="Workshop">Workshops</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                      <Clock size={12} /> Insert At Date
                    </label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      title="Date the spacer should be associated with"
                      value={form.startAt}
                      onChange={(e) => handleStartChange(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">
                  Spacers in Short Run sit in the bucket for the chosen date.
                  Long Run and Workshop spacers sort by date within their list.
                </p>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 font-bold text-gray-700 transition-colors hover:bg-gray-50"
              title="Cancel and close (Esc)"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-orange-600 px-4 py-2.5 font-bold text-white shadow-md transition-all hover:bg-orange-700 active:scale-95"
              title={isSpacer ? "Insert spacer into the layout" : "Create event"}
            >
              {isSpacer ? "Insert Spacer" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
