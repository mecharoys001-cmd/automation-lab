// ─── Raw CSV ────────────────────────────────────────────────
export interface RawCSVRow {
  [key: string]: string;
}

// ─── Standard Fields (platform-agnostic) ────────────────────
export type StandardField =
  | "orderId"
  | "orderTotal"
  | "subtotal"
  | "tax"
  | "shipping"
  | "discount"
  | "paymentMethod"
  | "status"
  | "date"
  | "itemName"
  | "itemPrice"
  | "itemQuantity"
  | "customerName"
  | "customerEmail"
  | "vendor"
  | "tags"
  | "outstandingBalance"
  | "currency"
  | "location"
  | "notes";

// ─── Platform Detection ─────────────────────────────────────
export interface PlatformProfile {
  id: string;
  name: string;
  detect: (headers: string[]) => boolean;
  columnMap: Partial<Record<StandardField, string | string[]>>;
}

export type PlatformId = "shopify" | "square" | "woocommerce" | "stripe" | "generic";

// ─── Column Mapping ─────────────────────────────────────────
export type ColumnMapping = Partial<Record<StandardField, string>>;

// ─── Category System ────────────────────────────────────────
export interface CategoryRule {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  vendors?: string[];
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
}

export interface CategoryProfile {
  id: string;
  name: string;
  rules: CategoryRule[];
  uncategorizedLabel: string;
}

// ─── Core Data Types ────────────────────────────────────────
export interface LineItem {
  name: string;
  quantity: number;
  price: number;
  category: string;
}

export interface Order {
  name: string;
  email: string;
  financialStatus: string;
  paidAt: string;
  currency: string;
  subtotal: number;
  shipping: number;
  taxes: number;
  total: number;
  discountAmount: number;
  paymentMethod: string;
  createdAt: string;
  billingName: string;
  notes: string;
  vendor: string;
  outstandingBalance: number;
  location: string;
  id: string;
  tags: string;
  source: string;
  lineItems: LineItem[];
}

// ─── Dashboard Aggregates ───────────────────────────────────
export interface CategoryBreakdown {
  category: string;
  revenue: number;
  percentage: number;
}

export interface DailyRevenue {
  date: string;
  total: number;
  categories: Record<string, number>;
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  category: string;
}

export interface CategoryDrilldownRow {
  program: string;
  category: string;
  enrollments: number;
  totalRevenue: number;
  paidRevenue: number;
  outstanding: number;
}

export interface FinancialStatusBreakdown {
  status: string;
  count: number;
  amount: number;
}

export interface DashboardData {
  orders: Order[];
  detectedPlatform?: PlatformId;
  detectedCurrency: string;
  categoryProfile?: CategoryProfile;
  dateRange: { start: string; end: string };
  totalRevenue: number;
  totalOrders: number;
  taxCollected: number;
  outstandingBalance: number;
  refundTotal: number;
  categoryBreakdown: CategoryBreakdown[];
  dailyRevenue: DailyRevenue[];
  paymentMethods: PaymentMethodBreakdown[];
  topProducts: TopProduct[];
  categoryDrilldown: CategoryDrilldownRow[];
  financialStatus: FinancialStatusBreakdown[];
}

// ─── Saved Profile ──────────────────────────────────────────
export interface SavedProfile {
  platform: PlatformId;
  columnMapping?: ColumnMapping;
  categoryProfile: CategoryProfile;
  lastUsed: string;
}
