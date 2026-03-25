import Papa from "papaparse";
import type {
  RawCSVRow,
  Order,
  LineItem,
  TransactionCategory,
  DashboardData,
  CategoryBreakdown,
  DailyRevenue,
  PaymentMethodBreakdown,
  TopProduct,
  CampEnrollmentRow,
  FinancialStatusBreakdown,
} from "./types";

function num(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[,$]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function detectCategory(name: string): TransactionCategory {
  if (!name) return "Other";
  const n = name.trim();
  const lower = n.toLowerCase();

  // Summer Camps
  if (/\b(FD|HD|SP)\s*#/i.test(n)) return "Summer Camps";

  // Classes
  const classKeywords = [
    "pottery wheel",
    "cartooning",
    "mud puppies",
    "sculpture",
    "saturday clay",
    "ewow",
    "friday pottery",
  ];
  if (classKeywords.some((k) => lower.includes(k))) return "Classes";

  // Open Studio
  if (lower.includes("open studio")) return "Open Studio";

  // Ceramics Retail
  if (/^cer\s/i.test(n)) return "Ceramics Retail";

  // Supplies
  const supplyKeywords = [
    "misc supplies",
    "canvas",
    "25 lb mid fire clay",
    "high fire clay",
  ];
  if (supplyKeywords.some((k) => lower.includes(k))) return "Supplies";

  // Events
  const eventKeywords = [
    "birthday party",
    "birthday dep",
    "ddn",
    "clay play",
    "date night",
  ];
  if (eventKeywords.some((k) => lower.includes(k))) return "Events";

  // Donations
  const donationKeywords = ["tag sale donation", "donation", "firing"];
  if (donationKeywords.some((k) => lower.includes(k))) return "Donations";

  // Local Artists
  if (
    lower.includes("local artists") ||
    lower.includes("roberta baker") ||
    /^patricia\s/i.test(n)
  )
    return "Local Artists";

  // Professional Services
  const profKeywords = [
    "prof fee",
    "special rate private lesson",
    "pottery wheel lessons",
    "special pottery",
    "nceca shipping",
  ];
  if (profKeywords.some((k) => lower.includes(k))) return "Professional Services";

  return "Other";
}

function groupRowsIntoOrders(rows: RawCSVRow[]): Order[] {
  const orderMap = new Map<string, { firstRow: RawCSVRow; lineItems: LineItem[] }>();
  const noNameOrders: { firstRow: RawCSVRow; lineItems: LineItem[] }[] = [];

  for (const row of rows) {
    const orderName = (row.Name || "").trim();
    const lineItemName = (row["Lineitem name"] || "").trim();
    const lineItem: LineItem | null = lineItemName
      ? {
          name: lineItemName,
          quantity: Math.max(1, num(row["Lineitem quantity"])),
          price: num(row["Lineitem price"]),
          category: detectCategory(lineItemName),
        }
      : null;

    if (!orderName) {
      // Row with no order name — treat as standalone
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

  return allEntries.map(({ firstRow, lineItems }) => ({
    name: (firstRow.Name || "").trim(),
    email: (firstRow.Email || "").trim(),
    financialStatus: (firstRow["Financial Status"] || "").trim().toLowerCase(),
    paidAt: (firstRow["Paid at"] || "").trim(),
    currency: (firstRow.Currency || "USD").trim(),
    subtotal: num(firstRow.Subtotal),
    shipping: num(firstRow.Shipping),
    taxes: num(firstRow.Taxes),
    total: num(firstRow.Total),
    discountAmount: num(firstRow["Discount Amount"]),
    paymentMethod: (firstRow["Payment Method"] || "Unknown").trim(),
    createdAt: (firstRow["Created at"] || "").trim(),
    billingName: (firstRow["Billing Name"] || "").trim(),
    notes: (firstRow.Notes || "").trim(),
    vendor: (firstRow.Vendor || "").trim(),
    outstandingBalance: num(firstRow["Outstanding Balance"]),
    location: (firstRow.Location || "").trim(),
    id: (firstRow.Id || "").trim(),
    tags: (firstRow.Tags || "").trim(),
    source: (firstRow.Source || "").trim(),
    lineItems,
  }));
}

function computeCategoryBreakdown(orders: Order[]): CategoryBreakdown[] {
  const catMap = new Map<TransactionCategory, number>();
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

function computeCampEnrollment(orders: Order[]): CampEnrollmentRow[] {
  const campMap = new Map<
    string,
    { enrollments: number; totalRevenue: number; paidRevenue: number; outstanding: number }
  >();

  for (const order of orders) {
    for (const li of order.lineItems) {
      if (li.category !== "Summer Camps") continue;
      const existing = campMap.get(li.name) || {
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
        // Attribute proportional outstanding to this line item
        const orderLineTotal = order.lineItems.reduce(
          (s, l) => s + l.price * l.quantity,
          0
        );
        if (orderLineTotal > 0) {
          existing.outstanding +=
            (rev / orderLineTotal) * order.outstandingBalance;
        }
      }
      campMap.set(li.name, existing);
    }
  }

  return Array.from(campMap.entries())
    .map(([program, data]) => ({ program, ...data }))
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

export function parseCSVData(csvText: string): DashboardData {
  const result = Papa.parse<RawCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const orders = groupRowsIntoOrders(result.data);

  const nonRefunded = orders.filter((o) => o.financialStatus !== "refunded");
  const refunded = orders.filter((o) => o.financialStatus === "refunded");

  const totalRevenue = nonRefunded.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const taxCollected = nonRefunded.reduce((s, o) => s + o.taxes, 0);
  const outstandingBalance = orders
    .filter((o) => o.outstandingBalance > 0)
    .reduce((s, o) => s + o.outstandingBalance, 0);
  const refundTotal = refunded.reduce((s, o) => s + Math.abs(o.total), 0);

  return {
    orders,
    totalRevenue,
    totalOrders,
    taxCollected,
    outstandingBalance,
    refundTotal,
    categoryBreakdown: computeCategoryBreakdown(orders),
    dailyRevenue: computeDailyRevenue(orders),
    paymentMethods: computePaymentMethods(orders),
    topProducts: computeTopProducts(orders),
    campEnrollment: computeCampEnrollment(orders),
    financialStatus: computeFinancialStatus(orders),
  };
}
