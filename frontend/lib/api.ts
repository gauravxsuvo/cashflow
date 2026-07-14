import type { Budgets, Transaction, TransactionCreate, TransactionUpdate } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export { BASE_URL };

/** Pull a human-readable message out of a FastAPI error response. */
async function errorMessage(res: Response): Promise<string> {
  const detail = await res.json().catch(() => null);
  if (typeof detail?.detail === "string") return detail.detail;
  if (Array.isArray(detail?.detail)) return detail.detail[0]?.msg ?? `Request failed (${res.status})`;
  return `Request failed (${res.status})`;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  getTransactions: () => request<Transaction[]>("/api/transactions"),
  getBudgets: () => request<Budgets>("/api/budgets"),
  createTransaction: (body: TransactionCreate) =>
    request<Transaction>("/api/transactions", { method: "POST", body: JSON.stringify(body) }),
  updateTransaction: (id: string, body: TransactionUpdate) =>
    request<Transaction>(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTransaction: (id: string) =>
    request<void>(`/api/transactions/${id}`, { method: "DELETE" }),
  setBudget: (category: string, monthly_limit: number | null) =>
    request<Budgets>(`/api/budgets/${encodeURIComponent(category)}`, {
      method: "PUT",
      body: JSON.stringify({ monthly_limit }),
    }),
};
