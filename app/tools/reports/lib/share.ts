import pako from "pako";
import type { DashboardData } from "./types";

/** Strip the heavy `orders` array — we only need aggregated data for display */
function toShareable(data: DashboardData, fileName: string) {
  return {
    v: 1, // version for future compat
    fn: fileName,
    dr: data.dateRange,
    tr: data.totalRevenue,
    to: data.totalOrders,
    tc: data.taxCollected,
    ob: data.outstandingBalance,
    rt: data.refundTotal,
    cb: data.categoryBreakdown,
    dv: data.dailyRevenue,
    pm: data.paymentMethods,
    tp: data.topProducts,
    ce: data.campEnrollment,
    fs: data.financialStatus,
  };
}

export function encodeShareData(data: DashboardData, fileName: string): string {
  const json = JSON.stringify(toShareable(data, fileName));
  const compressed = pako.deflate(new TextEncoder().encode(json));
  // Convert to base64url (URL-safe)
  let base64 = btoa(String.fromCharCode(...compressed));
  base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return base64;
}

export function decodeShareData(hash: string): { data: DashboardData; fileName: string } | null {
  try {
    // Restore base64 from base64url
    let base64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const decompressed = pako.inflate(bytes);
    const json = new TextDecoder().decode(decompressed);
    const obj = JSON.parse(json);

    if (obj.v !== 1) return null;

    return {
      fileName: obj.fn,
      data: {
        orders: [], // not included in share data
        dateRange: obj.dr,
        totalRevenue: obj.tr,
        totalOrders: obj.to,
        taxCollected: obj.tc,
        outstandingBalance: obj.ob,
        refundTotal: obj.rt,
        categoryBreakdown: obj.cb,
        dailyRevenue: obj.dv,
        paymentMethods: obj.pm,
        topProducts: obj.tp,
        campEnrollment: obj.ce,
        financialStatus: obj.fs,
      },
    };
  } catch (e) {
    console.error("Failed to decode share data:", e);
    return null;
  }
}
