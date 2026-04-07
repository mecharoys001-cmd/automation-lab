import type { AvailabilityJson, DayOfWeek, TimeBlock } from '@/types/database';
import type { CsvColumnDef } from '../components/ui/CsvImportDialog';

const DAY_KEYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value);
}

export function stringifyAvailability(availability: AvailabilityJson | null | undefined): Record<DayOfWeek, string> {
  const result = Object.fromEntries(DAY_KEYS.map((day) => [day, ''])) as Record<DayOfWeek, string>;

  for (const day of DAY_KEYS) {
    const blocks = availability?.[day] ?? [];
    result[day] = blocks
      .map((block: TimeBlock) => `${block.start}-${block.end}`)
      .join(';');
  }

  return result;
}

export function exportCsvFile(
  filename: string,
  columns: CsvColumnDef[],
  rows: Array<Record<string, unknown>>,
): number {
  const headers = columns.map((column) => column.csvHeader);
  const lines = rows.map((row) => headers.map((header) => escapeCsvValue(toCsvValue(row[header]))).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return rows.length;
}
