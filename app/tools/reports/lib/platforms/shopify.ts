import type { PlatformProfile } from "../types";

export const shopifyProfile: PlatformProfile = {
  id: "shopify",
  name: "Shopify",
  detect: (headers) => {
    const required = ["Name", "Lineitem name", "Financial Status"];
    return required.every((h) => headers.includes(h));
  },
  columnMap: {
    orderId: "Name",
    orderTotal: "Total",
    subtotal: "Subtotal",
    tax: "Taxes",
    shipping: "Shipping",
    discount: "Discount Amount",
    paymentMethod: "Payment Method",
    status: "Financial Status",
    date: ["Paid at", "Created at"],
    itemName: "Lineitem name",
    itemPrice: "Lineitem price",
    itemQuantity: "Lineitem quantity",
    customerName: "Billing Name",
    customerEmail: "Email",
    vendor: "Vendor",
    tags: "Tags",
    outstandingBalance: "Outstanding Balance",
    currency: "Currency",
    location: "Location",
    notes: "Notes",
  },
};
