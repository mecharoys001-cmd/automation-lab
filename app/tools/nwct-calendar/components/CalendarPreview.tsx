"use client";

import { useMemo } from "react";
import type { GroupedEvents, ProcessedEvent } from "../lib/types";

interface Props {
  data: GroupedEvents;
  onBack: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  exporting?: boolean;
}

function EventRow({ event }: { event: ProcessedEvent }) {
  return (
    <div className="border-b border-slate-200 py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight text-slate-900">
            {event.title}
          </div>
          {event.seeReference && (
            <div className="text-[11px] italic text-slate-500">{event.seeReference}</div>
          )}
          <div className="text-[11px] leading-tight text-slate-600">
            {event.venue}
            {event.town ? `, ${event.town}` : ""}
          </div>
          {event.website && (
            <div className="text-[11px] font-medium text-sky-700">{event.website}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[12px] font-semibold text-slate-800">{event.formattedTime}</div>
          {event.dateRange && (
            <div className="text-[11px] italic text-slate-500">{event.dateRange}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkshopGroup({
  venue,
  events,
}: {
  venue: string;
  events: ProcessedEvent[];
}) {
  const town = events[0]?.town ?? "";
  const website = events[0]?.website ?? "";
  return (
    <div className="mb-3 overflow-hidden rounded-md border border-slate-300 bg-slate-50">
      <div className="border-b border-slate-300 bg-slate-200 px-2 py-1">
        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-900">{venue}</div>
        {(town || website) && (
          <div className="text-[10px] text-slate-700">
            {town}
            {town && website ? ", " : ""}
            {website}
          </div>
        )}
      </div>
      <div className="divide-y divide-slate-200 px-2">
        {events.map((evt) => (
          <div key={evt.id} className="py-1.5">
            <div className="text-[12px] font-semibold leading-tight text-slate-900">{evt.title}</div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
              <span>{evt.formattedTime}</span>
              {evt.dateRange && <span className="italic">{evt.dateRange}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPreview({
  data,
  onBack,
  onPrint,
  onExportPdf,
  exporting,
}: Props) {
  const workshopsByVenue = useMemo(() => {
    const map: Record<string, ProcessedEvent[]> = {};
    for (const e of data.workshops) {
      const v = e.venue || "Other Locations";
      (map[v] ??= []).push(e);
    }
    return map;
  }, [data.workshops]);

  const totalEvents =
    data.longRuns.length +
    data.workshops.length +
    data.sortedDateKeys.reduce((sum, k) => sum + (data.shortRuns[k]?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-sm text-foreground">
          <span className="font-semibold">{totalEvents}</span> events grouped ·{" "}
          {data.sortedDateKeys.length} daily section{data.sortedDateKeys.length === 1 ? "" : "s"} ·{" "}
          {data.longRuns.length} long runs · {data.workshops.length} workshops
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Return to the row editor"
          >
            ← Back to editor
          </button>
          <button
            onClick={onPrint}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Open the browser print dialog — works for paper or system PDF export"
          >
            Print…
          </button>
          <button
            onClick={onExportPdf}
            disabled={exporting}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Render the preview to a single PDF using jsPDF and html2canvas"
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div
        id="nwct-calendar-print-root"
        className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none"
      >
        <header className="mb-6 border-b-4 border-slate-800 pb-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            NWCT Arts Council
          </h2>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-900">
            {data.monthTitle}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
            Online &amp; In-Person Events
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 print:grid-cols-2">
          <section>
            <h3 className="mb-2 rounded-sm bg-slate-700 px-2 py-1 text-sm font-bold uppercase tracking-wide text-white">
              Daily Events
            </h3>
            {data.sortedDateKeys.length === 0 ? (
              <div className="text-sm text-slate-500">No daily events.</div>
            ) : (
              data.sortedDateKeys.map((key) => (
                <div key={key} className="mb-4">
                  <div className="mb-1 bg-slate-500 px-2 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
                    {key}
                  </div>
                  <div className="px-1">
                    {data.shortRuns[key].map((evt) => (
                      <EventRow key={evt.id} event={evt} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="flex flex-col gap-6">
            {data.longRuns.length > 0 && (
              <div>
                <h3 className="mb-2 rounded-sm bg-slate-900 px-2 py-1 text-sm font-bold uppercase tracking-wide text-white">
                  Long Runs
                </h3>
                <div className="px-1">
                  {data.longRuns.map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            )}

            {data.workshops.length > 0 && (
              <div>
                <h3 className="mb-2 rounded-sm bg-slate-700 px-2 py-1 text-sm font-bold uppercase tracking-wide text-white">
                  Workshops
                </h3>
                <div>
                  {Object.keys(workshopsByVenue)
                    .sort()
                    .map((venue) => (
                      <WorkshopGroup
                        key={venue}
                        venue={venue}
                        events={workshopsByVenue[venue]}
                      />
                    ))}
                </div>
              </div>
            )}

            {data.longRuns.length === 0 && data.workshops.length === 0 && (
              <div className="text-sm text-slate-500">No long runs or workshops.</div>
            )}
          </section>
        </div>

        <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-[10px] uppercase tracking-widest text-slate-500">
          NWCT Arts Council · 40 Main Street, Suite 1 · Torrington, CT 06790 · artsnwct.org
        </footer>
      </div>
    </div>
  );
}
