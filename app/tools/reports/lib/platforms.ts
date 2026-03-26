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

  const patterns: { field: StandardField; keywords: string[] }[] = [
    { field: "orderId", keywords: ["order id", "order number", "order #", "order no", "name", "id", "transaction id"] },
    { field: "orderTotal", keywords: ["total", "order total", "amount", "gross", "net total"] },
    { field: "subtotal", keywords: ["subtotal", "sub total", "sub-total"] },
    { field: "tax", keywords: ["tax", "taxes", "tax amount", "sales tax"] },
    { field: "shipping", keywords: ["shipping", "shipping amount", "delivery"] },
    { field: "discount", keywords: ["discount", "discount amount", "coupon"] },
    { field: "paymentMethod", keywords: ["payment method", "payment type", "tender", "payment"] },
    { field: "status", keywords: ["status", "financial status", "order status", "payment status"] },
    { field: "date", keywords: ["date", "created at", "order date", "paid at", "transaction date", "created"] },
    { field: "itemName", keywords: ["item", "product", "lineitem name", "product name", "item name", "description"] },
    { field: "itemPrice", keywords: ["price", "lineitem price", "item price", "unit price", "amount"] },
    { field: "itemQuantity", keywords: ["quantity", "qty", "lineitem quantity", "item quantity"] },
    { field: "customerName", keywords: ["customer", "billing name", "customer name", "name", "buyer"] },
    { field: "customerEmail", keywords: ["email", "customer email", "buyer email"] },
    { field: "vendor", keywords: ["vendor", "supplier", "brand"] },
    { field: "tags", keywords: ["tags", "labels", "categories"] },
    { field: "outstandingBalance", keywords: ["outstanding", "balance", "outstanding balance", "amount due"] },
    { field: "currency", keywords: ["currency", "currency code"] },
    { field: "location", keywords: ["location", "store", "store location"] },
    { field: "notes", keywords: ["notes", "memo", "comments"] },
  ];

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

  return mapping;
}

export { PROFILES };
