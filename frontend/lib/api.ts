import type {
  AuthResponse,
  Budgets,
  CategoriesResponse,
  Category,
  Transaction,
  TransactionCreate,
  TransactionType,
  TransactionUpdate,
  User,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "cf_token";

export { BASE_URL };

// ── Token storage ───────────────────────────────────────────────────────────
// A tiny in-memory mirror of the persisted token so requests don't touch
// localStorage on every call (and so it works during SSR where storage is absent).
let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;
  memoryToken = window.localStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export function setToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/** Called when the server rejects our token (401). Lets AuthContext react. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
  const token = getToken();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (res.status === 401) {
      const msg = await errorMessage(res);
      onUnauthorized?.();
      throw new ApiError(msg, 401);
    }
    if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Auth
  register: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>("/api/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    request<{ status: string }>("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),
  changeCurrency: (currency: string) =>
    request<{ currency: string }>("/api/auth/currency", {
      method: "PUT",
      body: JSON.stringify({ currency }),
    }),
  wipeData: () => request<{ removed: number }>("/api/auth/data", { method: "DELETE" }),
  deleteAccount: () => request<void>("/api/auth/account", { method: "DELETE" }),

  // Categories
  getCategories: () => request<CategoriesResponse>("/api/categories"),
  createCategory: (name: string, kind: TransactionType, color: string) =>
    request<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, kind, color }),
    }),
  updateCategory: (name: string, patch: { new_name?: string; color?: string }) =>
    request<Category>(`/api/categories/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteCategory: (name: string) =>
    request<void>(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  // Data
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
