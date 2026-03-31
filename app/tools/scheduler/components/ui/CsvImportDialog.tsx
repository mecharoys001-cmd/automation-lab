'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Upload, X, AlertTriangle, Check, FileText, Loader2, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { parseCSV, type CsvRow } from '@/lib/csvDedup';

export interface CsvColumnDef {
  /** CSV header name (case-insensitive match) */
  csvHeader: string;
  /** Display label */
  label: string;
  required?: boolean;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: CsvColumnDef[];
  /** Validate a single parsed row. Return errors for this row. */
  validateRow: (row: CsvRow, rowIndex: number) => ValidationError[];
  /** Called when user confirms import. Return { imported, skipped } or throw. */
  onImport: (rows: CsvRow[]) => Promise<{ imported: number; skipped: number }>;
  /** Example CSV content for the download template button */
  exampleCsv?: string;
  /** Filename for the downloaded template (e.g., 'venues.csv', 'staff.csv') */
  templateFilename?: string;
  /** Optional collapsible help content shown between upload area and preview */
  helpContent?: React.ReactNode;
  /** Optional date range filter: program start date (YYYY-MM-DD) */
  dateRangeStart?: string;
  /** Optional date range filter: program end date (YYYY-MM-DD) */
  dateRangeEnd?: string;
  /** Optional: column name containing the date to filter (default: 'date') */
  dateColumnName?: string;
}

export function CsvImportDialog({
  open,
  onClose,
  title,
  columns,
  validateRow,
  onImport,
  exampleCsv,
  templateFilename = 'template.csv',
  helpContent,
  dateRangeStart,
  dateRangeEnd,
  dateColumnName = 'date',
}: CsvImportDialogProps) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState<string>(dateRangeStart || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(dateRangeEnd || '');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setRows([]);
    setHeaders([]);
    setErrors([]);
    setImporting(false);
    setResult(null);
    setParseError(null);
    setDragOver(false);
    setFilterStartDate(dateRangeStart || '');
    setFilterEndDate(dateRangeEnd || '');
  }, [dateRangeStart, dateRangeEnd]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setParseError('Please upload a .csv file');
      return;
    }
    setParseError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text?.trim()) {
        setParseError('File is empty');
        return;
      }
      // Strip comment rows (lines starting with #) before parsing
      const strippedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .join('\n');
      const parsed = parseCSV(strippedText);
      if (parsed.rows.length === 0) {
        setParseError('No data rows found in file');
        return;
      }

      // Check required columns exist
      const lowerHeaders = parsed.headers.map((h) => h.toLowerCase().trim());
      const missing = columns
        .filter((c) => c.required)
        .filter((c) => !lowerHeaders.includes(c.csvHeader.toLowerCase()));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.map((c) => c.csvHeader).join(', ')}`);
        return;
      }

      // Normalize headers to lowercase for consistent access
      const normalizedRows = parsed.rows.map((row) => {
        const normalized: CsvRow = {};
        for (const [key, val] of Object.entries(row)) {
          normalized[key.toLowerCase().trim()] = val;
        }
        return normalized;
      });

      setHeaders(parsed.headers.map((h) => h.toLowerCase().trim()));
      setRows(normalizedRows);
    };
    reader.readAsText(file);
  }, [columns, validateRow]);

  // Filter rows by date range (if date range is set)
  const filteredRows = useMemo(() => {
    if (!filterStartDate || !filterEndDate || rows.length === 0) {
      return rows;
    }

    const startMs = new Date(filterStartDate).getTime();
    const endMs = new Date(filterEndDate).getTime();

    return rows.filter((row) => {
      const dateValue = row[dateColumnName]?.trim();
      if (!dateValue) return false; // Exclude rows without date

      const dateMs = new Date(dateValue).getTime();
      // Include if date is between start and end (inclusive)
      return dateMs >= startMs && dateMs <= endMs;
    });
  }, [rows, filterStartDate, filterEndDate, dateColumnName]);

  // Validate filtered rows whenever filtering changes
  useEffect(() => {
    if (filteredRows.length === 0) {
      setErrors([]);
      return;
    }

    const allErrors: ValidationError[] = [];
    filteredRows.forEach((row, idx) => {
      const rowErrors = validateRow(row, idx);
      allErrors.push(...rowErrors);
    });
    setErrors(allErrors);
  }, [filteredRows, validateRow]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  }, [processFile]);

  const handleImport = useCallback(async () => {
    const validRows = filteredRows.filter((_, i) => !errors.some((e) => e.row === i));
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await onImport(validRows);
      setResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [filteredRows, errors, onImport]);

  const downloadTemplate = useCallback(() => {
    if (!exampleCsv) return;
    const blob = new Blob([exampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }, [exampleCsv, templateFilename]);

  if (!open) return null;

  const rowsWithErrors = new Set(errors.map((e) => e.row));
  const validCount = filteredRows.filter((_, i) => !rowsWithErrors.has(i)).length;
  const errorCount = rowsWithErrors.size;

  // Columns to display: use defined columns, mapped to lowercase headers
  const displayCols = columns.map((c) => c.csvHeader.toLowerCase());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-slate-100" aria-label="Close dialog">
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Result state */}
          {result && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Check className="w-5 h-5 text-emerald-800 flex-shrink-0" />
              <div>
                <p className="font-medium text-emerald-800">Import complete</p>
                <p className="text-sm text-emerald-800">
                  {result.imported} imported, {result.skipped} skipped
                </p>
              </div>
            </div>
          )}

          {/* Upload zone */}
          {rows.length === 0 && !result && (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  Drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-slate-700 mt-1">
                  Expected columns: {columns.map((c) => c.csvHeader).join(', ')}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {exampleCsv && (
                <button
                  onClick={downloadTemplate}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Download CSV template
                </button>
              )}
            </>
          )}

          {/* Collapsible help panel */}
          {helpContent && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-slate-600" />
                Column Reference
                {helpOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-600 ml-auto" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600 ml-auto" />
                )}
              </button>
              {helpOpen && (
                <div className="px-4 pb-4 text-[13px] text-slate-600 border-t border-slate-200">
                  {helpContent}
                </div>
              )}
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {/* Date Range Filter (shown after file upload, before preview) */}
          {rows.length > 0 && (dateRangeStart || dateRangeEnd) && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3 mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Filter by Date Range
                </label>
                <Tooltip text="Only show calendar entries between these dates (inclusive). Pre-filled with program start/end dates.">
                  <HelpCircle className="w-4 h-4 text-slate-600 cursor-help" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label htmlFor="filter-start-date" className="block text-xs font-medium text-slate-600 mb-1">
                    First Day (Start)
                  </label>
                  <input
                    id="filter-start-date"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="filter-end-date" className="block text-xs font-medium text-slate-600 mb-1">
                    Last Day (End)
                  </label>
                  <input
                    id="filter-end-date"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {filterStartDate && filterEndDate
                  ? `Showing entries from ${filterStartDate} to ${filterEndDate} (${filteredRows.length} rows)`
                  : 'Set date range to filter entries'}
              </p>
            </div>
          )}

          {/* Preview table */}
          {filteredRows.length > 0 && !result && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''} parsed
                  </span>
                  {errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {errorCount} row{errorCount !== 1 ? 's' : ''} with errors
                    </span>
                  )}
                  <span className="text-xs text-slate-700">
                    {validCount} will be imported
                  </span>
                </div>
                <button
                  onClick={reset}
                  className="text-xs text-slate-600 hover:text-slate-700"
                >
                  Choose different file
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 w-8">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 w-8"></th>
                        {displayCols.map((col) => (
                          <th key={col} className="px-3 py-2 text-left text-xs font-medium text-slate-600">
                            {columns.find((c) => c.csvHeader.toLowerCase() === col)?.label ?? col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((row, i) => {
                        const rowErrors = errors.filter((e) => e.row === i);
                        const hasError = rowErrors.length > 0;
                        return (
                          <tr key={i} className={hasError ? 'bg-red-50/50' : ''}>
                            <td className="px-3 py-2 text-xs text-slate-700">{i + 1}</td>
                            <td className="px-3 py-2">
                              {hasError ? (
                                <Tooltip text={rowErrors.map((e) => `${e.column}: ${e.message}`).join('\n')}>
                                  <span className="inline-flex cursor-help">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                                  </span>
                                </Tooltip>
                              ) : (
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                              )}
                            </td>
                            {displayCols.map((col) => {
                              const cellErrors = rowErrors.filter((e) => e.column === col);
                              return (
                                <td key={col} className="px-3 py-2">
                                  <span className={cellErrors.length > 0 ? 'text-red-700 font-medium' : 'text-slate-700'}>
                                    {row[col] || <span className="text-slate-600">-</span>}
                                  </span>
                                  {cellErrors.map((e, ei) => (
                                    <span key={ei} className="block text-[11px] text-red-700">{e.message}</span>
                                  ))}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button variant="secondary" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {rows.length > 0 && !result && (
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={importing || validCount === 0}
              icon={importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {importing ? 'Importing...' : `Import ${validCount} row${validCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
