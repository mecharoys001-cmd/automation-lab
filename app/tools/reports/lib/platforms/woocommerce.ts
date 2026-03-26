import type { PlatformProfile } from "../types";

export const woocommerceProfile: PlatformProfile = {
  id: "woocommerce",
  name: "WooCommerce",
  detect: (headers) => {
    const required = ["Order Number", "Order Total"];
    return required.every((h) => headers.includes(h));
  },
  columnMap: {
    orderId: "Order Number",
    orderTotal: "Order Total",
    subtotal: "Order Subtotal",
    tax: ["Order Tax", "Tax Amount"],
    shipping: ["Shipping Total", "Shipping"],
    discount: ["Coupon Amount", "Discount Amount"],
    paymentMethod: ["Payment Method Title", "Payment Method"],
    status: ["Order Status", "Status"],
    date: ["Order Date", "Date"],
    itemName: ["Product Name", "Item Name"],
    itemPrice: ["Item Cost", "Product Price"],
    itemQuantity: ["Quantity", "Qty"],
    customerName: ["Billing Name", "Customer Name"],
    customerEmail: ["Billing Email", "Customer Email"],
    vendor: "Product Category",
    tags: ["Tags", "Product Tags"],
    currency: "Currency",
    location: "Billing Country",
    notes: ["Customer Note", "Order Notes"],
  },
};
