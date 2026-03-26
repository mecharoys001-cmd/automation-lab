import Papa from "papaparse";
import type {
  RawCSVRow,
  Order,
  LineItem,
  DashboardData,
  CategoryBreakdown,
  DailyRevenue,
  PaymentMethodBreakdown,
  TopProduct,
  CategoryDrilldownRow,
  FinancialStatusBreakdown,
  PlatformId,
  ColumnMapping,
  CategoryProfile,
} from "./types";
import { detectPlatform, buildResolver } from "./platforms";
import { selectBestProfile, applyCategories } from "./categorize";
import { detectCurrency } from "./currency";

// ─── Row → Order Normalization ──────────────────────────────

function groupRowsIntoOrders(
  rows: RawCSVRow[],
  headers: string[],
  platformId: PlatformId,
  customMapping?: ColumnMapping
): { orders: Order[]; detectedPlatform: PlatformId } {
  const { profile } = detectPlatform(headers);
  const r = buildResolver(profile, headers, customMapping);

  const orderMap = new Map<string, { firstRow: RawCSVRow; lineItems: LineItem[] }>();
  const noNameOrders: { firstRow: RawCSVRow; lineItems: LineItem[] }[] = [];

  for (const row of rows) {
    const orderName = r.str(row, "orderId");
    const lineItemName = r.str(row, "itemName");
    const lineItem: LineItem | null = lineItemName
      ? {
          name: lineItemName,
          quantity: Math.max(1, r.num(row, "itemQuantity")),
          price: r.num(row, "itemPrice"),
          category: "Other", // Will be set by categorization
        }
      : null;

    if (!orderName) {
      if (lineItem) {
        noNameOrders.push({ firstRow: row, lineItems: [lineItem] });
      }
      continue;
    }

    const existing = orderMap.get(orderName);
    if (existing) {
      if (lineItem) existing.lineItems.push(lineItem);
    } else {
      orderMap.set(orderName, {
        firstRow: row,
        lineItems: lineItem ? [lineItem] : [],
      });
    }
  }

  const allEntries = [...orderMap.values(), ...noNameOrders];

  const orders = allEntries.map(({ firstRow, lineItems }) => ({
    name: r.str(firstRow, "orderId"),
    email: r.str(firstRow, "customerEmail"),
    financialStatus: r.str(firstRow, "status").toLowerCase(),
    paidAt: r.str(firstRow, "date"),
    currency: r.str(firstRow, "currency") || "USD",
    subtotal: r.num(firstRow, "subtotal"),
    shipping: r.num(firstRow, "shipping"),
    taxes: r.num(firstRow, "tax"),
    total: r.num(firstRow, "orderTotal"),
    discountAmount: r.num(firstRow, "discount"),
    paymentMethod: r.str(firstRow, "paymentMethod") || "Unknown",
    createdAt: r.str(firstRow, "date"),
    billingName: r.str(firstRow, "customerName"),
    notes: r.str(firstRow, "notes"),
    vendor: r.str(firstRow, "vendor"),
    outstandingBalance: r.num(firstRow, "outstandingBalance"),
    location: r.str(firstRow, "location"),
    id: r.str(firstRow, "orderId"),
    tags: r.str(firstRow, "tags"),
    source: "",
    lineItems,
  }));

  return { orders, detectedPlatform: platformId };
}

// ─── Aggregation Functions ──────────────────────────────────

function computeCategoryBreakdown(orders: Order[]): CategoryBreakdown[] {
  const catMap = new Map<string, number>();
  let grandTotal = 0;

  for (const order of orders) {
    if (order.financialStatus === "refunded") continue;
    for (const li of order.lineItems) {
      const rev = li.price * li.quantity;
      catMap.set(li.category, (catMap.get(li.category) || 0) + rev);
      grandTotal += rev;
    }
  }

  return Array.from(catMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: grandTotal > 0 ? (revenue / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function computeDailyRevenue(orders: Order[]): DailyRevenue[] {
  const dayMap = new Map<string, DailyRevenue>();

  for (const order of orders) {
    if (order.financialStatus === "refunded") continue;
    const dateStr = order.createdAt;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;
    const dayKey = date.toISOString().split("T")[0];

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { date: dayKey, total: 0, categories: {} });
    }
    const day = dayMap.get(dayKey)!;

    for (const li of order.lineItems) {
      const rev = li.price * li.quantity;
      day.total += rev;
      day.categories[li.category] = (day.categories[li.category] || 0) + rev;
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function computePaymentMethods(orders: Order[]): PaymentMethodBreakdown[] {
  const methodMap = new Map<string, { amount: number; count: number }>();

  for (const order of orders) {
    const method = order.paymentMethod || "Unknown";
    const existing = methodMap.get(method) || { amount: 0, count: 0 };
    existing.amount += order.total;
    existing.count += 1;
    methodMap.set(method, existing);
  }

  return Array.from(methodMap.entries())
    .map(([method, data]) => ({ method, ...data }))
    .sort((a, b) => b.amount - a.amount);
}

function computeTopProducts(orders: Order[]): TopProduct[] {
  const productMap = new Map<string, TopProduct>();

  for (const order of orders) {
    if (order.financialStatus === "refunded") continue;
    for (const li of order.lineItems) {
      const key = li.name;
      const existing = productMap.get(key);
      if (existing) {
        existing.quantity += li.quantity;
        existing.revenue += li.price * li.quantity;
      } else {
        productMap.set(key, {
          name: li.name,
          quantity: li.quantity,
          revenue: li.price * li.quantity,
          category: li.category,
        });
      }
    }
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function computeCategoryDrilldown(orders: Order[]): CategoryDrilldownRow[] {
  const drillMap = new Map<
    string,
    { category: string; enrollments: number; totalRevenue: number; paidRevenue: number; outstanding: number }
  >();

  for (const order of orders) {
    for (const li of order.lineItems) {
      const key = `${li.category}::${li.name}`;
      const existing = drillMap.get(key) || {
        category: li.category,
        enrollments: 0,
        totalRevenue: 0,
        paidRevenue: 0,
        outstanding: 0,
      };
      existing.enrollments += li.quantity;
      const rev = li.price * li.quantity;
      existing.totalRevenue += rev;
      if (order.financialStatus === "paid") {
        existing.paidRevenue += rev;
      }
      if (order.outstandingBalance > 0) {
        const orderLineTotal = order.lineItems.reduce(
          (s, l) => s + l.price * l.quantity,
          0
        );
        if (orderLineTotal > 0) {
          existing.outstanding +=
            (rev / orderLineTotal) * order.outstandingBalance;
        }
      }
      drillMap.set(key, existing);
    }
  }

  return Array.from(drillMap.entries())
    .map(([key, data]) => ({
      program: key.split("::")[1],
      ...data,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function computeFinancialStatus(orders: Order[]): FinancialStatusBreakdown[] {
  const statusMap = new Map<string, { count: number; amount: number }>();

  for (const order of orders) {
    const status = order.financialStatus || "unknown";
    const existing = statusMap.get(status) || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += order.total;
    statusMap.set(status, existing);
  }

  return Array.from(statusMap.entries())
    .map(([status, data]) => ({ status, ...data }))
    .sort((a, b) => b.amount - a.amount);
}

// ─── Main Entry Point ───────────────────────────────────────

export interface ParseOptions {
  customMapping?: ColumnMapping;
  categoryProfile?: CategoryProfile;
}

export function parseCSVData(csvText: string, options?: ParseOptions): DashboardData {
  const result = Papa.parse<RawCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields || [];
  const { profile, platformId } = detectPlatform(headers);

  const { orders: rawOrders, detectedPlatform } = groupRowsIntoOrders(
    result.data,
    headers,
    platformId,
    options?.customMapping
  );

  // Select and apply category profile
  const categoryProfile = options?.categoryProfile || selectBestProfile(rawOrders);
  const orders = applyCategories(rawOrders, categoryProfile);

  // Detect currency from order data
  const detectedCurrency = detectCurrency(orders.map((o) => o.currency));

  const nonRefunded = orders.filter((o) => o.financialStatus !== "refunded");
  const refunded = orders.filter((o) => o.financialStatus === "refunded");

  const totalRevenue = nonRefunded.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const taxCollected = nonRefunded.reduce((s, o) => s + o.taxes, 0);
  const outstandingBalance = orders
    .filter((o) => o.outstandingBalance > 0)
    .reduce((s, o) => s + o.outstandingBalance, 0);
  const refundTotal = refunded.reduce((s, o) => s + Math.abs(o.total), 0);

  const allDates = orders
    .map((o) => o.createdAt)
    .filter((d) => d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));
  const dateRange = {
    start: allDates.length
      ? new Date(Math.min(...allDates)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "Unknown",
    end: allDates.length
      ? new Date(Math.max(...allDates)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "Unknown",
  };

  return {
    orders,
    detectedPlatform,
    detectedCurrency,
    categoryProfile,
    dateRange,
    totalRevenue,
    totalOrders,
    taxCollected,
    outstandingBalance,
    refundTotal,
    categoryBreakdown: computeCategoryBreakdown(orders),
    dailyRevenue: computeDailyRevenue(orders),
    paymentMethods: computePaymentMethods(orders),
    topProducts: computeTopProducts(orders),
    categoryDrilldown: computeCategoryDrilldown(orders),
    financialStatus: computeFinancialStatus(orders),
  };
}
