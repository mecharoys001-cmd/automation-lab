import type { PlatformProfile, PlatformId, RawCSVRow, ColumnMapping, StandardField } from "./types";
import { shopifyProfile } from "./platforms/shopify";
import { squareProfile } from "./platforms/square";
import { woocommerceProfile } from "./platforms/woocommerce";
import { stripeProfile } from "./platforms/stripe";
import { genericProfile } from "./platforms/generic";

// Ordered by specificity — most specific first
const PROFILES: PlatformProfile[] = [
  shopifyProfile,
  squareProfile,
  woocommerceProfile,
  stripeProfile,
  genericProfile, // always matches as fallback
];

/**
 * Detect platform from CSV headers.
 * Returns the first matching profile (ordered by specificity).
 */
export function detectPlatform(headers: string[]): { profile: PlatformProfile; platformId: PlatformId } {
  for (const profile of PROFILES) {
    if (profile.detect(headers)) {
      return { profile, platformId: profile.id as PlatformId };
    }
  }
  // Should never reach here — generic always matches
  return { profile: genericProfile, platformId: "generic" };
}

/**
 * Resolve a standard field to an actual CSV column name.
 * Tries each candidate in order; returns the first that exists in the row.
 */
function resolveField(
  field: StandardField,
  columnMap: PlatformProfile["columnMap"],
  customMapping: ColumnMapping | undefined,
  headers: string[]
): string | undefined {
  // Custom mapping takes priority
  if (customMapping?.[field]) {
    return customMapping[field];
  }
  const candidates = columnMap[field];
  if (!candidates) return undefined;
  const arr = Array.isArray(candidates) ? candidates : [candidates];
  return arr.find((c) => headers.includes(c));
}

/**
 * Get a string value from a row using the resolved column name.
 */
function getStr(row: RawCSVRow, col: string | undefined): string {
  if (!col) return "";
  return (row[col] || "").trim();
}

function getNum(row: RawCSVRow, col: string | undefined): number {
  if (!col) return 0;
  const val = row[col];
  if (!val) return 0;
  const n = parseFloat(val.replace(/[,$]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Build a field resolver for a given platform profile + headers + optional custom mapping.
 */
export function buildResolver(
  profile: PlatformProfile,
  headers: string[],
  customMapping?: ColumnMapping
) {
  const resolved: Partial<Record<StandardField, string>> = {};
  const fields: StandardField[] = [
    "orderId", "orderTotal", "subtotal", "tax", "shipping", "discount",
    "paymentMethod", "status", "date", "itemName", "itemPrice", "itemQuantity",
    "customerName", "customerEmail", "vendor", "tags", "outstandingBalance",
    "currency", "location", "notes",
  ];
  for (const f of fields) {
    resolved[f] = resolveField(f, profile.columnMap, customMapping, headers);
  }

  return {
    str: (row: RawCSVRow, field: StandardField) => getStr(row, resolved[field]),
    num: (row: RawCSVRow, field: StandardField) => getNum(row, resolved[field]),
    has: (field: StandardField) => !!resolved[field],
    resolved,
  };
}

/**
 * Fuzzy-match CSV headers to standard fields for the column mapper UI.
 * Returns suggested mappings based on common patterns.
 */
export function suggestMappings(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = headers.map((h) => h.toLowerCase());

  // Exact match patterns (highest priority)
  const patterns: { field: StandardField; keywords: string[] }[] = [
    { field: "orderId", keywords: ["order id", "order number", "order #", "order no", "transaction id", "invoice number", "invoice #", "receipt number"] },
    { field: "orderTotal", keywords: ["total", "order total", "grand total", "net total", "gross amount", "gross sales"] },
    { field: "subtotal", keywords: ["subtotal", "sub total", "sub-total", "net amount", "net sales"] },
    { field: "tax", keywords: ["tax", "taxes", "tax amount", "sales tax", "vat", "gst"] },
    { field: "shipping", keywords: ["shipping", "shipping amount", "delivery", "freight"] },
    { field: "discount", keywords: ["discount", "discount amount", "coupon", "promo"] },
    { field: "paymentMethod", keywords: ["payment method", "payment type", "tender", "tender type", "payment"] },
    { field: "status", keywords: ["status", "financial status", "order status", "payment status", "state"] },
    { field: "date", keywords: ["date", "created at", "order date", "paid at", "transaction date", "created", "timestamp", "time", "sale date"] },
    { field: "itemName", keywords: ["item", "product", "lineitem name", "product name", "item name", "description", "product/service", "line item", "sku name"] },
    { field: "itemPrice", keywords: ["price", "lineitem price", "item price", "unit price", "rate", "unit amount"] },
    { field: "itemQuantity", keywords: ["quantity", "qty", "lineitem quantity", "item quantity", "units", "count"] },
    { field: "customerName", keywords: ["customer", "billing name", "customer name", "buyer", "client", "sold to", "bill to"] },
    { field: "customerEmail", keywords: ["email", "customer email", "buyer email", "e-mail"] },
    { field: "vendor", keywords: ["vendor", "supplier", "brand", "merchant"] },
    { field: "tags", keywords: ["tags", "labels", "categories", "category", "type", "product type"] },
    { field: "outstandingBalance", keywords: ["outstanding", "balance", "outstanding balance", "amount due", "due"] },
    { field: "currency", keywords: ["currency", "currency code", "cur"] },
    { field: "location", keywords: ["location", "store", "store location", "branch", "outlet"] },
    { field: "notes", keywords: ["notes", "memo", "comments", "remarks"] },
  ];

  // Pass 1: exact match on full header name
  for (const { field, keywords } of patterns) {
    if (mapping[field]) continue;
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }

  // Pass 2: partial/contains match for unmapped fields
  // Also use data-type heuristics: "amount" → orderTotal or itemPrice
  const used = new Set(Object.values(mapping));
  const partials: { field: StandardField; contains: string[] }[] = [
    { field: "orderId", contains: ["order", "invoice", "receipt", "transaction"] },
    { field: "orderTotal", contains: ["total", "amount", "gross", "revenue"] },
    { field: "date", contains: ["date", "time", "created", "when"] },
    { field: "itemName", contains: ["item", "product", "description", "service", "line"] },
    { field: "itemPrice", contains: ["price", "rate", "cost", "unit"] },
    { field: "itemQuantity", contains: ["qty", "quantity", "units", "count"] },
    { field: "customerName", contains: ["customer", "buyer", "client", "name"] },
    { field: "customerEmail", contains: ["email", "e-mail"] },
    { field: "tax", contains: ["tax", "vat", "gst"] },
    { field: "paymentMethod", contains: ["payment", "tender", "method"] },
    { field: "status", contains: ["status", "state"] },
  ];

  for (const { field, contains } of partials) {
    if (mapping[field]) continue;
    for (let i = 0; i < lower.length; i++) {
      if (used.has(headers[i])) continue;
      if (contains.some((c) => lower[i].includes(c))) {
        mapping[field] = headers[i];
        used.add(headers[i]);
        break;
      }
    }
  }

  return mapping;
}

export { PROFILES };
