// Optional "account/wallet" a transaction can belong to. Free-form on the
// backend, but the UI offers these familiar presets so a ledger feels real
// without forcing users into a rigid account model.

export const ACCOUNT_PRESETS = [
  "Cash",
  "Checking",
  "Savings",
  "Credit Card",
  "Investments",
] as const;

export type AccountPreset = (typeof ACCOUNT_PRESETS)[number];
