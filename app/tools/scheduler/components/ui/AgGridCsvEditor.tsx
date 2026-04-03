'use client';

import {
  useState,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useRef,
} from 'react';
import type { CsvRow } from '@/lib/csvDedup';
import type { CsvColumnDef, ValidationError } from './CsvImportDialog';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { Plus, Trash2, Download } from 'lucide-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

/* ── Types ──────────────────────────────────────────────────── */

export interface AgGridCsvEditorRef {
  getRows: () => CsvRow[];
}

export interface AgGridCsvEditorProps {
  rows: CsvRow[];
  columns: CsvColumnDef[];
  validateRow: (row: CsvRow, rowIndex: number) => ValidationError[];
  onValidationChange: (summary: ValidationSummary) => void;
  /** Columns that were auto-injected (not in original CSV) — headers styled amber */
  injectedColumns?: string[];
}

export interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  /** Row indices that have errors (severity=error or no severity) */
  errorRowIndices: Set<number>;
  allErrors: ValidationError[];
}

/* ── Helpers ─────────────────────────────────────────────────── */

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/* ── Component ───────────────────────────────────────────────── */

export const AgGridCsvEditor = forwardRef<AgGridCsvEditorRef, AgGridCsvEditorProps>(
  function AgGridCsvEditor({ rows: initialRows, columns, validateRow, onValidationChange, injectedColumns = [] }, ref) {
    const gridApiRef = useRef<GridApi | null>(null);
    const [rowData, setRowData] = useState<CsvRow[]>(() =>
      initialRows.map((r, i) => ({ ...r, __rowIndex: String(i) }))
    );
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

    // Re-sync when initialRows identity changes (new file uploaded)
    useEffect(() => {
      setRowData(initialRows.map((r, i) => ({ ...r, __rowIndex: String(i) })));
    }, [initialRows]);

    // Validation map: rowIndex -> ValidationError[]
    const validationMap = useMemo(() => {
      const map = new Map<number, ValidationError[]>();
      rowData.forEach((row, idx) => {
        // Strip internal fields before validating
        const { __rowIndex, __status, ...cleanRow } = row;
        const errs = validateRow(cleanRow, idx);
        if (errs.length > 0) map.set(idx, errs);
      });
      return map;
    }, [rowData, validateRow]);

    // Compute summary and notify parent
    useEffect(() => {
      const errorRowIndices = new Set<number>();
      let warnings = 0;
      let errors = 0;
      const allErrors: ValidationError[] = [];

      validationMap.forEach((errs, rowIdx) => {
        const hasError = errs.some((e) => !e.severity || e.severity === 'error');
        const hasWarning = errs.some((e) => e.severity === 'warning');
        if (hasError) {
          errorRowIndices.add(rowIdx);
          errors++;
        } else if (hasWarning) {
          warnings++;
        }
        allErrors.push(...errs);
      });

      onValidationChange({
        total: rowData.length,
        valid: rowData.length - errors - warnings,
        warnings,
        errors,
        errorRowIndices,
        allErrors,
      });
    }, [validationMap, rowData.length, onValidationChange]);

    // Expose getRows to parent
    useImperativeHandle(ref, () => ({
      getRows: () =>
        rowData.map((r) => {
          const { __rowIndex, __status, ...cleanRow } = r;
          return cleanRow;
        }),
    }), [rowData]);

    // Cell edit handler
    const onCellValueChanged = useCallback((event: any) => {
      setRowData((prev) => {
        const updated = [...prev];
        const rowIndex = event.rowIndex as number;
        updated[rowIndex] = { ...updated[rowIndex], [event.colDef.field]: event.newValue };
        return updated;
      });
    }, []);

    // Selection tracking
    const onSelectionChanged = useCallback((event: any) => {
      const api = event.api as GridApi;
      const selected = api.getSelectedRows() as CsvRow[];
      setSelectedRowIds(new Set(selected.map((r) => r.__rowIndex as string)));
    }, []);

    // Add row
    const handleAddRow = useCallback(() => {
      setRowData((prev) => {
        const emptyRow: CsvRow = {};
        columns.forEach((col) => {
          emptyRow[col.csvHeader.toLowerCase()] = '';
        });
        emptyRow.__rowIndex = String(prev.length);
        return [...prev, emptyRow];
      });
    }, [columns]);

    // Remove selected rows
    const handleRemoveSelected = useCallback(() => {
      setRowData((prev) => {
        const filtered = prev.filter((r) => !selectedRowIds.has(r.__rowIndex as string));
        return filtered.map((r, i) => ({ ...r, __rowIndex: String(i) }));
      });
      setSelectedRowIds(new Set());
    }, [selectedRowIds]);

    // Download CSV
    const handleDownloadCsv = useCallback(() => {
      const headers = columns.map((c) => c.csvHeader);
      const headerLine = headers.join(',');
      const dataLines = rowData.map((row) => {
        return headers.map((h) => {
          const val = String(row[h.toLowerCase()] ?? '');
          // Escape values containing commas, quotes, or newlines
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',');
      });
      const csv = [headerLine, ...dataLines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edited-data.csv';
      a.click();
      URL.revokeObjectURL(url);
    }, [columns, rowData]);

    // Build AG Grid column defs
    const columnDefs = useMemo(() => {
      // Status column (pinned left)
      const statusCol = {
        headerName: '',
        field: '__status',
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        pinned: 'left' as const,
        editable: false,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: any) => {
          const rowIdx = params.rowIndex as number;
          const errs = validationMap.get(rowIdx);
          if (!errs || errs.length === 0) return '\u2705';
          const hasError = errs.some((e: ValidationError) => !e.severity || e.severity === 'error');
          if (hasError) return '\u274C';
          return '\u26A0\uFE0F';
        },
        cellStyle: () => ({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
        }),
      };

      // Data columns
      const injectedSet = new Set(injectedColumns.map((c) => c.toLowerCase()));

      const dataCols = columns.map((col) => {
        const field = col.csvHeader.toLowerCase();
        const isInjected = injectedSet.has(field);
        const colDef: any = {
          headerName: col.label,
          field,
          editable: true,
          flex: 1,
          minWidth: 100,
          sortable: true,
          filter: false,
          ...(isInjected && {
            headerStyle: { backgroundColor: 'rgba(245, 158, 11, 0.25)' },
          }),
          cellStyle: (params: any) => {
            const rowIdx = params.rowIndex as number;
            const errs = validationMap.get(rowIdx);
            if (!errs) return null;
            const cellErrs = errs.filter((e) => e.column === field);
            if (cellErrs.length === 0) return null;
            const hasError = cellErrs.some((e) => !e.severity || e.severity === 'error');
            if (hasError) {
              return { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderBottom: '2px solid #ef4444' };
            }
            return { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderBottom: '2px solid #f59e0b' };
          },
          tooltipValueGetter: (params: any) => {
            const rowIdx = params.rowIndex as number;
            const errs = validationMap.get(rowIdx);
            if (!errs) return '';
            const cellErrs = errs.filter((e) => e.column === field);
            return cellErrs.map((e) => e.message).join('\n');
          },
        };

        // Custom cell editor
        if (col.cellEditorType === 'select' && col.cellEditorOptions) {
          colDef.cellEditor = 'agSelectCellEditor';
          colDef.cellEditorParams = { values: col.cellEditorOptions };
        }

        return colDef;
      });

      return [statusCol, ...dataCols];
    }, [columns, validationMap, injectedColumns]);

    const defaultColDef = useMemo(() => ({
      resizable: true,
      suppressMovable: true,
    }), []);

    const dark = isDarkMode();
    const themeClass = dark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';

    return (
      <div className="flex flex-col gap-2">
        {/* Top controls */}
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleDownloadCsv} tooltip="Download edited data as CSV">
            <Download className="h-4 w-4 mr-1" />
            Download CSV
          </Button>
        </div>

        {/* Grid */}
        <div className={themeClass} style={{ height: Math.min(400, Math.max(200, rowData.length * 42 + 48)), width: '100%' }}>
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={onSelectionChanged}
            onGridReady={(e) => { gridApiRef.current = e.api; }}
            rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true }}
            tooltipShowDelay={300}
            enableBrowserTooltips={true}
            stopEditingWhenCellsLoseFocus={true}
            singleClickEdit={true}
            rowBuffer={20}
            animateRows={false}
            suppressColumnVirtualisation={false}
            domLayout={rowData.length <= 10 ? 'autoHeight' : 'normal'}
          />
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-slate-500 mr-auto">{rowData.length} rows</span>
          <Button variant="secondary" size="sm" onClick={handleAddRow} tooltip="Add a new empty row">
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleRemoveSelected}
            disabled={selectedRowIds.size === 0}
            tooltip={selectedRowIds.size === 0 ? 'Select rows to remove' : `Remove ${selectedRowIds.size} selected row(s)`}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove Selected
          </Button>
        </div>
      </div>
    );
  }
);
