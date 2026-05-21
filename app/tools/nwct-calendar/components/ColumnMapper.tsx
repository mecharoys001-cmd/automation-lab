"use client";

import { useMemo, useState } from "react";
import {
  CANONICAL_FIELDS,
  REQUIRED_FIELDS,
  type CanonicalField,
  type ColumnMapping,
} from "../lib/types";
import { suggestMapping } from "../lib/normalize";

interface Props {
  headers: string[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export default function ColumnMapper({ headers, onConfirm, onCancel }: Props) {
  const suggested = useMemo(() => suggestMapping(headers), [headers]);
  const [mapping, setMapping] = useState<ColumnMapping>(suggested);

  const update = (field: CanonicalField, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value || undefined }));
  };

  const requiredMet = REQUIRED_FIELDS.every((f) => !!mapping[f]);

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-md">
      <h3 className="mb-2 text-lg font-semibold text-foreground">Map CSV Columns</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        We auto-mapped what we could from your file. Required fields are marked with{" "}
        <span className="font-semibold text-red-700">*</span>. Unmapped fields are left blank in the editor.
      </p>

      <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
        {CANONICAL_FIELDS.map((field) => {
          const required = REQUIRED_FIELDS.includes(field);
          return (
            <div key={field} className="flex items-center gap-3">
              <label
                className="w-32 shrink-0 text-sm text-foreground"
                title={`Map a CSV column to: ${field}`}
              >
                {field}
                {required && <span className="ml-0.5 text-red-700">*</span>}
              </label>
              <select
                value={mapping[field] ?? ""}
                onChange={(e) => update(field, e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                title={`Select CSV column for ${field}`}
              >
                <option value="">— Not mapped —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          title="Cancel mapping and choose a different file"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(mapping)}
          disabled={!requiredMet}
          className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            requiredMet
              ? "Continue to the event editor"
              : "Map all required fields (Title, Venue, Start At) first"
          }
        >
          Continue to editor →
        </button>
      </div>
    </div>
  );
}
