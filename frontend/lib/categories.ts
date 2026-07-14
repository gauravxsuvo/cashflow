// The fixed category vocabulary, mirrored from the backend (`categorize.py`).
// Keeping it here avoids an extra round-trip and lets the picker, colours, and
// budgets all share one source of truth for what a "category" can be.

import type { TransactionType } from "@/types";

export const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Groceries",
  "Dining",
  "Transport",
  "Travel",
  "Subscriptions",
  "Entertainment",
  "Health & Fitness",
  "Shopping",
  "Education",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investments",
  "Refunds",
  "Other Income",
] as const;

export const ALL_CATEGORIES: string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const INCOME_SET = new Set<string>(INCOME_CATEGORIES);

/** Categories valid for a given transaction type. */
export function categoriesForType(type: TransactionType): string[] {
  return type === "income" ? [...INCOME_CATEGORIES] : [...EXPENSE_CATEGORIES];
}

export function isIncomeCategory(category: string): boolean {
  return INCOME_SET.has(category);
}
