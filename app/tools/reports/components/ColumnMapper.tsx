"use client";

import { useState, useMemo } from "react";
import type { ColumnMapping, StandardField } from "../lib/types";
import { suggestMappings } from "../lib/platforms";

const STANDARD_FIELDS: { field: StandardField; label: string; required?: boolean }[] = [
  { field: "orderId", label: "Order ID", required: true },
  { field: "orderTotal", label: "Order Total", required: true },
  { field: "date", label: "Date", required: true },
  { field: "itemName", label: "Item/Product Name" },
  { field: "itemPrice", label: "Item Price" },
  { field: "itemQuantity", label: "Item Quantity" },
  { field: "subtotal", label: "Subtotal" },
  { field: "tax", label: "Tax" },
  { field: "shipping", label: "Shipping" },
  { field: "discount", label: "Discount" },
  { field: "paymentMethod", label: "Payment Method" },
  { field: "status", label: "Financial Status" },
  { field: "customerName", label: "Customer Name" },
  { field: "customerEmail", label: "Customer Email" },
  { field: "vendor", label: "Vendor/Brand" },
  { field: "tags", label: "Tags" },
  { field: "outstandingBalance", label: "Outstanding Balance" },
  { field: "currency", label: "Currency" },
  { field: "location", label: "Location" },
  { field: "notes", label: "Notes" },
];

interface Props {
  headers: string[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export default function ColumnMapper({ headers, onConfirm, onCancel }: Props) {
  const suggested = useMemo(() => suggestMappings(headers), [headers]);
  const [mapping, setMapping] = useState<ColumnMapping>(suggested);

  const update = (field: StandardField, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const requiredMet = STANDARD_FIELDS
    .filter((f) => f.required)
    .every((f) => mapping[f.field]);

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-md">
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        Map Your CSV Columns
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        We couldn&apos;t auto-detect your CSV format. Map your columns to our standard fields below.
        Fields marked with * are required.
      </p>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {STANDARD_FIELDS.map(({ field, label, required }) => (
          <div key={field} className="flex items-center gap-3">
            <label
              className="w-44 shrink-0 text-sm text-foreground"
              title={`Map a CSV column to: ${label}`}
            >
              {label}{required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <select
              value={mapping[field] || ""}
              onChange={(e) => update(field, e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              title={`Select CSV column for ${label}`}
            >
              <option value="">— Not mapped —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          title="Cancel and go back"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(mapping)}
          disabled={!requiredMet}
          className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          title={requiredMet ? "Apply column mapping and generate dashboard" : "Map all required fields first"}
        >
          Apply Mapping
        </button>
      </div>
    </div>
  );
}
