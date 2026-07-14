export type TransactionType = "expense" | "income";

export interface Transaction {
  transaction_id: string;
  date: string | null;
  vendor: string | null;
  amount: number | null;
  type: TransactionType;
  /** Auto-suggested category from the backend keyword rules. */
  category: string;
  /** User override; when set it wins over `category`. */
  manual_category: string | null;
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
}

/** Map of category name → monthly limit. */
export type Budgets = Record<string, number>;

export interface TransactionCreate {
  date: string;
  vendor: string;
  amount: number;
  type: TransactionType;
  manual_category?: string | null;
}

export interface TransactionUpdate {
  date?: string;
  vendor?: string;
  amount?: number;
  type?: TransactionType;
  manual_category?: string | null;
}
