import type { Transaction } from "@/types";

export type PeriodId = "month" | "last-month" | "3m" | "year" | "all";

export interface PeriodOption {
  id: PeriodId;
  label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "3m", label: "Last 3 months" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];

function iso(d: Date): string {
  // Local-date ISO (YYYY-MM-DD) — matches how dates are stored/entered.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive [start, end] ISO date bounds for a period, or null for "all". */
export function periodRange(period: PeriodId, now = new Date()): { start: string; end: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "month":
      return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    case "last-month":
      return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    case "3m":
      return { start: iso(new Date(y, m - 2, 1)), end: iso(new Date(y, m + 1, 0)) };
    case "year":
      return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
    case "all":
    default:
      return null;
  }
}

export function filterByPeriod(transactions: Transaction[], period: PeriodId, now = new Date()): Transaction[] {
  const range = periodRange(period, now);
  if (!range) return transactions;
  return transactions.filter((tx) => {
    if (!tx.date) return false;
    return tx.date >= range.start && tx.date <= range.end;
  });
}

/** Human label for the current calendar month, e.g. "July 2026". */
export function currentMonthLabel(now = new Date()): string {
  return now.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Transactions in the current calendar month (used for budgets). */
export function currentMonthTransactions(transactions: Transaction[], now = new Date()): Transaction[] {
  return filterByPeriod(transactions, "month", now);
}
