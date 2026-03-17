import type { CalendarEvent } from './calendar/types';

interface ExportPrintOptions {
  events: CalendarEvent[];
  programName: string;
  dateRange: { start: string; end: string };
  activeFilterSummary: string[];
  title: string; // e.g. "Week of Mar 10–16, 2026" or "Full Program Year"
}

/**
 * Opens a new browser window with a print-optimized schedule, then triggers
 * window.print().  Events are grouped by date with a clean black/white layout.
 */
export function openPrintView(opts: ExportPrintOptions) {
  const { events, programName, dateRange, activeFilterSummary, title } = opts;

  // Sort events by date, then start time
  const sorted = events
    .slice()
    .sort(
      (a, b) =>
        (a.date ?? '').localeCompare(b.date ?? '') ||
        (a.time ?? '').localeCompare(b.time ?? ''),
    );

  // Group events by date
  const grouped = new Map<string, CalendarEvent[]>();
  for (const ev of sorted) {
    const key = ev.date ?? 'Unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ev);
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Build table rows grouped by date
  let tableRows = '';
  for (const [date, evts] of grouped) {
    tableRows += `
      <tr class="date-header">
        <td colspan="7">${escapeHtml(formatDate(date))}</td>
      </tr>`;
    for (const ev of evts) {
      tableRows += `
      <tr>
        <td>${escapeHtml(ev.time ?? '')}</td>
        <td>${escapeHtml(ev.endTime ?? '')}</td>
        <td>${escapeHtml(ev.title)}</td>
        <td>${escapeHtml(ev.instructor ?? '')}</td>
        <td>${escapeHtml(ev.venue ?? '')}</td>
        <td>${escapeHtml(ev.subtitle ?? '')}</td>
        <td>${escapeHtml(ev.status ?? '')}</td>
      </tr>`;
    }
  }

  const filterNotice =
    activeFilterSummary.length > 0
      ? `<p class="filter-notice">Filtered by: ${escapeHtml(activeFilterSummary.join(', '))} — only matching events are shown</p>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(programName)} — ${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin-bottom: 2px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 4px; }
    .generated { font-size: 11px; color: #94a3b8; margin-bottom: 12px; }
    .filter-notice { background: #fef9c3; border: 1px solid #facc15; border-radius: 4px; padding: 6px 10px; font-size: 11px; color: #854d0e; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 600; color: #64748b; border-bottom: 2px solid #e2e8f0; padding: 6px 8px; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    tr.date-header td { font-weight: 600; font-size: 13px; background: #f8fafc; padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .total { margin-top: 12px; font-size: 12px; color: #64748b; }
    @media print {
      body { padding: 0; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(programName)}</h1>
  <p class="subtitle">${escapeHtml(title)} — ${escapeHtml(dateRange.start)} to ${escapeHtml(dateRange.end)}</p>
  <p class="generated">Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  ${filterNotice}
  <table>
    <thead>
      <tr>
        <th>Start</th>
        <th>End</th>
        <th>Event</th>
        <th>Instructor</th>
        <th>Venue</th>
        <th>Grade</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">No events in this range</td></tr>'}
    </tbody>
  </table>
  <p class="total">Total: ${sorted.length} event${sorted.length !== 1 ? 's' : ''}</p>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
