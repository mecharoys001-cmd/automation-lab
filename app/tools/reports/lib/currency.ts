/**
 * Shared currency formatting utilities.
 * Detects and formats amounts using the currency found in CSV data.
 */

/** Common ISO 4217 currency codes we recognize from CSV data */
const KNOWN_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "JPY", "CHF", "SEK", "NOK",
  "DKK", "MXN", "BRL", "INR", "CNY", "KRW", "SGD", "HKD", "TWD", "ZAR",
  "ILS", "AED", "PLN", "CZK", "HUF", "THB", "PHP", "MYR", "IDR", "VND",
]);

/**
 * Detect the most common currency from an array of currency strings.
 * Falls back to "USD" if none detected or unrecognized.
 */
export function detectCurrency(currencies: string[]): string {
  const counts = new Map<string, number>();
  for (const raw of currencies) {
    const code = raw.trim().toUpperCase();
    if (code && KNOWN_CURRENCIES.has(code)) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  if (counts.size === 0) return "USD";
  let best = "USD";
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Create a currency formatter for the given ISO currency code.
 * Returns a function that formats numbers as localized currency strings.
 */
export function makeCurrencyFormatter(currency: string, minimumFractionDigits = 2): (n: number) => string {
  return (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits,
    });
}

/**
 * Get the currency symbol prefix for axis labels (e.g. "$", "€", "£").
 */
export function currencySymbol(currency: string): string {
  // Format zero to extract just the symbol
  const formatted = (0).toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  // Strip digits and whitespace to get symbol
  return formatted.replace(/[\d.,\s]/g, "").trim() || "$";
}
