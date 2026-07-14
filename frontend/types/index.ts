export type TransactionType = "expense" | "income";

export interface Transaction {
  transaction_id: string;
  date: string | null;
  vendor: string | null;
  amount: number | null;
  type: TransactionType;
  /** Optional account/wallet this belongs to (e.g. "Checking", "Cash"). */
  account: string | null;
  /** Optional free-text memo. */
  note: string | null;
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
  account?: string | null;
  note?: string | null;
}

export interface TransactionUpdate {
  date?: string;
  vendor?: string;
  amount?: number;
  type?: TransactionType;
  manual_category?: string | null;
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
