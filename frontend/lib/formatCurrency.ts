// Lazily-built cache: one Intl.NumberFormat instance per currency code.
// We let Intl decide fraction digits per currency (e.g. JPY → 0 decimals,
// USD → 2) instead of forcing 2 everywhere, and fall back to USD if a code
// is somehow invalid so formatting can never throw at render time.
const cache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  if (!cache.has(currency)) {
    let formatter: Intl.NumberFormat;
    try {
      formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
    } catch {
      formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
    cache.set(currency, formatter);
  }
  return cache.get(currency)!;
}

export function formatCurrency(value: number, currency = "USD"): string {
  return getFormatter(currency).format(Number.isFinite(value) ? value : 0);
}

/** Currency string with an explicit +/- sign, e.g. "+$1,000.00" / "−$42.50". */
export function formatSigned(value: number, currency = "USD"): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? "+" : safe < 0 ? "−" : "";
  return `${sign}${getFormatter(currency).format(Math.abs(safe))}`;
}
