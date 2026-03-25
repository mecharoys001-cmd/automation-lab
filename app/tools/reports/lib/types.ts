export interface RawCSVRow {
  Name: string;
  Email: string;
  "Financial Status": string;
  "Paid at": string;
  "Fulfillment Status": string;
  Currency: string;
  Subtotal: string;
  Shipping: string;
  Taxes: string;
  Total: string;
  "Discount Amount": string;
  "Payment Method": string;
  "Created at": string;
  "Lineitem quantity": string;
  "Lineitem name": string;
  "Lineitem price": string;
  "Lineitem requires shipping": string;
  "Lineitem taxable": string;
  "Billing Name": string;
  Notes: string;
  Vendor: string;
  "Outstanding Balance": string;
  Location: string;
  Id: string;
  Tags: string;
  Source: string;
  [key: string]: string;
}

export type TransactionCategory =
  | "Summer Camps"
  | "Classes"
  | "Open Studio"
  | "Ceramics Retail"
  | "Supplies"
  | "Events"
  | "Donations"
  | "Local Artists"
  | "Professional Services"
  | "Other";

export interface LineItem {
  name: string;
  quantity: number;
  price: number;
  category: TransactionCategory;
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

export interface CategoryBreakdown {
  category: TransactionCategory;
  revenue: number;
  percentage: number;
}

export interface DailyRevenue {
  date: string;
  total: number;
  categories: Partial<Record<TransactionCategory, number>>;
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
  category: TransactionCategory;
}

export interface CampEnrollmentRow {
  program: string;
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
  totalRevenue: number;
  totalOrders: number;
  taxCollected: number;
  outstandingBalance: number;
  refundTotal: number;
  categoryBreakdown: CategoryBreakdown[];
  dailyRevenue: DailyRevenue[];
  paymentMethods: PaymentMethodBreakdown[];
  topProducts: TopProduct[];
  campEnrollment: CampEnrollmentRow[];
  financialStatus: FinancialStatusBreakdown[];
}
