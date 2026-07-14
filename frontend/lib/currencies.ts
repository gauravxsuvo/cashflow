export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

// Must stay in sync with the backend's _SUPPORTED_CURRENCIES set.
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CHF", label: "Swiss Franc", symbol: "Fr" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$" },
];

export function currencySymbol(code: string): string {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol ?? "$";
}
