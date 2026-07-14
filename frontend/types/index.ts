export type TransactionType = "expense" | "income";

export interface Transaction {
  transaction_id: string;
  date: string | null;
  vendor: string | null;
  amount: number | null;
  type: TransactionType;
  /** The category the user chose (falls back to "Uncategorized"). */
  category: string;
  /** Optional account/wallet this belongs to (e.g. "Checking", "Cash"). */
  account: string | null;
  /** Optional free-text memo. */
  note: string | null;
}

export interface Category {
  name: string;
  kind: TransactionType;
  color: string;
}

export interface CategoriesResponse {
  categories: Category[];
  expense: string[];
  income: string[];
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
  category?: string | null;
  account?: string | null;
  note?: string | null;
}

export interface TransactionUpdate {
  date?: string;
  vendor?: string;
  amount?: number;
  type?: TransactionType;
  category?: string | null;
  account?: string | null;
  note?: string | null;
}

export interface User {
  id: string;
  username: string;
  currency: string;
  created_at: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}
