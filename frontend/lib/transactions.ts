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

export interface AccountSummary {
  account: string;
  net: number;
  income: number;
  expenses: number;
  count: number;
}

/** Net (income − expenses) grouped by account, richest first. Untagged rows
 *  are folded into an "Unassigned" bucket only when some accounts exist. */
export function netByAccount(transactions: Transaction[]): AccountSummary[] {
  const map = new Map<string, AccountSummary>();
  for (const tx of transactions) {
    const key = tx.account?.trim() || "Unassigned";
    const amt = tx.amount ?? 0;
    const existing = map.get(key) ?? { account: key, net: 0, income: 0, expenses: 0, count: 0 };
    if (tx.type === "income") existing.income += amt;
    else existing.expenses += amt;
    existing.net = existing.income - existing.expenses;
    existing.count += 1;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.net - a.net);
}

/** True when at least one transaction has an explicit account tag. */
export function hasAccounts(transactions: Transaction[]): boolean {
  return transactions.some((tx) => (tx.account ?? "").trim() !== "");
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
