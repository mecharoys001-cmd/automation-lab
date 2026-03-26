import type { PlatformProfile } from "../types";

export const stripeProfile: PlatformProfile = {
  id: "stripe",
  name: "Stripe",
  detect: (headers) => {
    // Stripe exports typically have 'id' and 'Amount' or 'amount'
    const hasId = headers.includes("id") || headers.includes("ID");
    const hasAmount = headers.includes("Amount") || headers.includes("amount");
    const hasStripeField = headers.includes("Status") || headers.includes("Description");
    return hasId && hasAmount && hasStripeField;
  },
  columnMap: {
    orderId: ["id", "ID", "Payment Intent"],
    orderTotal: ["Amount", "amount"],
    subtotal: ["Subtotal", "Amount"],
    tax: ["Tax", "tax"],
    shipping: "Shipping",
    discount: "Discount",
    paymentMethod: ["Card Brand", "Payment Method Type", "Payment Method"],
    status: ["Status", "status"],
    date: ["Created (UTC)", "Created", "created"],
    itemName: ["Description", "description", "Product"],
    itemPrice: ["Amount", "amount"],
    itemQuantity: ["Quantity", "quantity"],
    customerName: ["Customer Name", "Customer Description", "customer_name"],
    customerEmail: ["Customer Email", "customer_email"],
    currency: ["Currency", "currency"],
    notes: ["Description", "Memo"],
  },
};
