import type { CategorySummary, Transaction } from "@/types";

/** The category the user actually sees: their override, else the auto suggestion. */
export function effectiveCategory(tx: Transaction): string {
  return tx.manual_category ?? tx.category ?? "Other";
}

/** Signed amount: negative for expenses, positive for income. */
export function signedAmount(tx: Transaction): number {
  const amt = tx.amount ?? 0;
  return tx.type === "income" ? amt : -amt;
}

export interface Totals {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number; // 0–100, share of income kept
  count: number;
}

export function computeTotals(transactions: Transaction[]): Totals {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    const amt = tx.amount ?? 0;
    if (tx.type === "income") income += amt;
    else expenses += amt;
  }
  const net = income - expenses;
  const savingsRate = income > 0 ? Math.max(0, (net / income) * 100) : 0;
  return { income, expenses, net, savingsRate, count: transactions.length };
}

/** Expense totals grouped by effective category, largest first. */
export function expensesByCategory(transactions: Transaction[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const key = effectiveCategory(tx);
    const amount = tx.amount ?? 0;
    const existing = map.get(key);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      map.set(key, { category: key, total: amount, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
