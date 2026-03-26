import type { PlatformProfile } from "../types";

export const squareProfile: PlatformProfile = {
  id: "square",
  name: "Square",
  detect: (headers) => {
    const required = ["Transaction ID", "Net Sales"];
    return required.every((h) => headers.includes(h));
  },
  columnMap: {
    orderId: "Transaction ID",
    orderTotal: ["Gross Sales", "Total Collected"],
    subtotal: "Net Sales",
    tax: "Tax",
    shipping: "Shipping",
    discount: ["Discounts", "Discount Amount"],
    paymentMethod: ["Payment Method", "Tender"],
    status: "Transaction Status",
    date: ["Date", "Timestamp"],
    itemName: ["Item", "Item Name"],
    itemPrice: ["Net Sales", "Gross Sales"],
    itemQuantity: ["Qty", "Quantity"],
    customerName: ["Customer Name", "Customer"],
    customerEmail: "Customer Email",
    vendor: "Category",
    location: "Location",
    notes: ["Notes", "Description"],
    currency: "Currency",
  },
};
