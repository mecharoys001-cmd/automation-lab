"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type {
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import {
  CANONICAL_FIELDS,
  type EditorRow,
  type RowValidationIssue,
} from "../lib/types";
import { duplicateRow, emptyEditorRow, rowsToCsv, downloadBlob } from "../lib/csv";
import { hasBlockingErrors, issuesByRow, validateRows } from "../lib/validation";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Props {
  initialRows: EditorRow[];
  onBuild: (rows: EditorRow[]) => void;
  onBack: () => void;
  onRowsChange?: (rows: EditorRow[]) => void;
  onSaveProject: (rows: EditorRow[]) => void;
  onLoadProject: () => void;
}

const RUN_TYPE_OPTIONS = ["", "Short Run", "Long Run", "Workshop"];

export default function EventGridEditor({
  initialRows,
  onBuild,
  onBack,
  onRowsChange,
  onSaveProject,
  onLoadProject,
}: Props) {
  const gridApiRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<EditorRow[]>(initialRows);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRowData(initialRows);
  }, [initialRows]);

  useEffect(() => {
    onRowsChange?.(rowData);
  }, [rowData, onRowsChange]);

  const issues = useMemo<RowValidationIssue[]>(() => validateRows(rowData), [rowData]);
  const issuesByRowId = useMemo(() => issuesByRow(issues), [issues]);
  const blocked = hasBlockingErrors(issues);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const onCellValueChanged = useCallback((evt: CellValueChangedEvent) => {
    const id = (evt.data as EditorRow)._id;
    const field = evt.colDef.field as keyof EditorRow;
    setRowData((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: evt.newValue ?? "" } : r)),
    );
  }, []);

  const onSelectionChanged = useCallback((evt: SelectionChangedEvent) => {
    const selected = evt.api.getSelectedRows() as EditorRow[];
    setSelectedIds(new Set(selected.map((r) => r._id)));
  }, []);

  const handleAddRow = useCallback(() => {
    setRowData((prev) => [...prev, emptyEditorRow()]);
  }, []);

  const handleDuplicate = useCallback(() => {
    setRowData((prev) => {
      const toDup = prev.filter((r) => selectedIds.has(r._id));
      if (toDup.length === 0) return prev;
      return [...prev, ...toDup.map(duplicateRow)];
    });
  }, [selectedIds]);

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setRowData((prev) => prev.filter((r) => !selectedIds.has(r._id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleDownloadCsv = useCallback(() => {
    downloadBlob(rowsToCsv(rowData), `nwct-calendar-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
  }, [rowData]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const statusCol: ColDef = {
      headerName: "",
      field: "_id",
      width: 56,
      minWidth: 56,
      maxWidth: 56,
      pinned: "left",
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      checkboxSelection: false,
      headerCheckboxSelection: false,
      cellRenderer: (params: { data?: EditorRow }) => {
        const id = params.data?._id;
        if (!id) return "";
        const list = issuesByRowId[id] ?? [];
        if (list.length === 0) return "✅";
        const hasError = list.some((i) => i.severity === "error");
        return hasError ? "❌" : "⚠️";
      },
      tooltipValueGetter: (params) => {
        const id = params.data?._id;
        if (!id) return "";
        const list = issuesByRowId[id] ?? [];
        return list.map((i) => `${i.severity.toUpperCase()}: ${i.message}`).join("\n");
      },
    };

    const cellStyleForField = (field: string): ColDef["cellStyle"] =>
      ((params: { data?: EditorRow }) => {
        const id = params.data?._id;
        if (!id) return null;
        const list = issuesByRowId[id] ?? [];
        const cellIssues = list.filter((i) => i.field === field);
        if (cellIssues.length === 0) return null;
        const hasError = cellIssues.some((i) => i.severity === "error");
        return hasError
          ? { backgroundColor: "rgba(239,68,68,0.15)", borderBottom: "2px solid #ef4444" }
          : { backgroundColor: "rgba(245,158,11,0.15)", borderBottom: "2px solid #f59e0b" };
      }) as ColDef["cellStyle"];

    const fieldCols: ColDef[] = CANONICAL_FIELDS.map((field) => {
      const def: ColDef = {
        headerName: field,
        field,
        editable: true,
        flex: 1,
        minWidth: 110,
        sortable: true,
        filter: true,
        cellStyle: cellStyleForField(field),
        tooltipValueGetter: (params: { data?: EditorRow }) => {
          const id = params.data?._id;
          if (!id) return "";
          const list = issuesByRowId[id] ?? [];
          return list
            .filter((i) => i.field === field)
            .map((i) => i.message)
            .join("\n");
        },
      };
      if (field === "Run Type") {
        def.cellEditor = "agSelectCellEditor";
        def.cellEditorParams = { values: RUN_TYPE_OPTIONS };
      }
      return def;
    });

    return [statusCol, ...fieldCols];
  }, [issuesByRowId]);

  const defaultColDef = useMemo<ColDef>(
    () => ({ resizable: true, suppressMovable: false, minWidth: 110 }),
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-foreground">
          <span className="font-semibold">{rowData.length}</span> rows ·{" "}
          <span className={errorCount ? "text-red-700 font-semibold" : "text-emerald-700"}>
            {errorCount} error{errorCount === 1 ? "" : "s"}
          </span>{" "}
          ·{" "}
          <span className={warningCount ? "text-amber-700 font-semibold" : "text-muted-foreground"}>
            {warningCount} warning{warningCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Go back and re-upload or re-map the source CSV"
          >
            ← Back
          </button>
          <button
            onClick={onLoadProject}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Replace these rows with a saved Calendar Automator project JSON"
          >
            Load JSON
          </button>
          <button
            onClick={() => onSaveProject(rowData)}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Download the current rows as a project JSON file you can re-open later"
          >
            Save JSON
          </button>
          <button
            onClick={handleDownloadCsv}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
            title="Download the edited rows as a CSV with the canonical column order"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="ag-theme-quartz" style={{ height: 520, width: "100%" }}>
        <AgGridReact<EditorRow>
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => p.data._id}
          onCellValueChanged={onCellValueChanged}
          onSelectionChanged={onSelectionChanged}
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            e.api.sizeColumnsToFit();
          }}
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true }}
          tooltipShowDelay={300}
          enableBrowserTooltips={true}
          stopEditingWhenCellsLoseFocus={true}
          singleClickEdit={true}
          animateRows={false}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddRow}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            title="Add a new blank event row"
          >
            + Add Row
          </button>
          <button
            onClick={handleDuplicate}
            disabled={selectedIds.size === 0}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            title={selectedIds.size === 0 ? "Select one or more rows to duplicate" : `Duplicate ${selectedIds.size} selected row(s)`}
          >
            Duplicate
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={selectedIds.size === 0 ? "Select rows to delete" : `Delete ${selectedIds.size} selected row(s)`}
          >
            Delete
          </button>
        </div>

        <button
          onClick={() => onBuild(rowData)}
          disabled={blocked || rowData.length === 0}
          className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            blocked
              ? "Fix the highlighted errors before building the calendar"
              : rowData.length === 0
                ? "Add at least one row before building"
                : "Process the rows into a grouped print-ready calendar preview"
          }
        >
          Build Calendar →
        </button>
      </div>
    </div>
  );
}
