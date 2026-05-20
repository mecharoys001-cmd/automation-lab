import { REQUIRED_FIELDS, type EditorRow, type RowValidationIssue } from "./types";
import { isValidDate } from "./dateFormat";

export function validateRows(rows: EditorRow[]): RowValidationIssue[] {
  const issues: RowValidationIssue[] = [];

  for (const row of rows) {
    for (const f of REQUIRED_FIELDS) {
      if (!row[f] || !row[f].toString().trim()) {
        issues.push({
          rowId: row._id,
          field: f,
          severity: "error",
          message: `${f} is required.`,
        });
      }
    }

    const startStr = row["Start At"];
    if (startStr) {
      const start = new Date(startStr);
      if (!isValidDate(start)) {
        issues.push({
          rowId: row._id,
          field: "Start At",
          severity: "error",
          message: `Invalid Start At: "${startStr}".`,
        });
      }
    }

    const endStr = row["End At"];
    if (endStr) {
      const end = new Date(endStr);
      if (!isValidDate(end)) {
        issues.push({
          rowId: row._id,
          field: "End At",
          severity: "warning",
          message: `Invalid End At: "${endStr}".`,
        });
      }
    }

    const runType = (row["Run Type"] ?? "").toString().trim().toLowerCase();
    if (runType && !["", "short run", "long run", "workshop"].includes(runType)) {
      issues.push({
        rowId: row._id,
        field: "Run Type",
        severity: "warning",
        message: `Unknown Run Type "${row["Run Type"]}". Expected one of: Short Run, Long Run, Workshop.`,
      });
    }
  }

  return issues;
}

export function hasBlockingErrors(issues: RowValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

export function issuesByRow(issues: RowValidationIssue[]): Record<string, RowValidationIssue[]> {
  const map: Record<string, RowValidationIssue[]> = {};
  for (const i of issues) {
    (map[i.rowId] ??= []).push(i);
  }
  return map;
}
