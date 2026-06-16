"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, LayoutDashboard, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { Transaction, ClusterSummary } from "@/types";
import type { SortKey, SortDir } from "@/components/TransactionTable";
import { exportTransactionsCsv } from "@/lib/exportCsv";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/components/Toast";
import SummaryCard from "@/components/SummaryCard";
import ClusterChart from "@/components/ClusterChart";
import SpendingTrendChart from "@/components/SpendingTrendChart";
import TransactionTable from "@/components/TransactionTable";
import TransactionModal from "@/components/TransactionModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelect from "@/components/CurrencySelect";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "JPY", label: "Yen", symbol: "¥" },
];

function effectiveCategory(tx: Transaction): string {
  return tx.manual_category ?? tx.cluster_name ?? "Uncategorized";
}

function buildClusterSummaries(transactions: Transaction[]): ClusterSummary[] {
  const map = new Map<string, ClusterSummary>();
  for (const tx of transactions) {
    const key = effectiveCategory(tx);
    const amount = tx.amount ?? 0;
    const existing = map.get(key);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      map.set(key, { cluster_name: key, total: amount, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function DashboardPage() {
  const { currency, setCurrency } = useSettings();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined = closed | null = add mode | Transaction = edit mode
  const [modalTarget, setModalTarget] = useState<Transaction | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Table view controls
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [manualOnly, setManualOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const searchRef = useRef<HTMLInputElement>(null);

  const fetchClusters = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${BASE_URL}/api/clusters`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);
      const data: Transaction[] = await res.json();
      setTransactions(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. The backend may be waking up — please retry in a moment.");
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // ── Mutations (optimistic) ────────────────────────────────────────────────
  async function performDelete(tx: Transaction) {
    setDeleteTarget(null);
    const prev = transactions;
    setTransactions((t) => t.filter((x) => x.transaction_id !== tx.transaction_id));
    try {
      const res = await fetch(`${BASE_URL}/api/transactions/${tx.transaction_id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
      toast("Transaction deleted", "success");
      fetchClusters(); // refresh clusters (deleting can shift ML groupings)
    } catch {
      setTransactions(prev); // rollback
      toast("Could not delete transaction", "error");
    }
  }

  async function handleRevert(tx: Transaction) {
    const prev = transactions;
    setTransactions((t) =>
      t.map((x) => (x.transaction_id === tx.transaction_id ? { ...x, manual_category: null } : x))
    );
    try {
      const res = await fetch(`${BASE_URL}/api/transactions/${tx.transaction_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_category: null }),
      });
      if (!res.ok) throw new Error("revert failed");
      toast("Reverted to ML category", "success");
      fetchClusters();
    } catch {
      setTransactions(prev);
      toast("Could not revert category", "error");
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  }

  // ── Keyboard shortcuts: N = add, / = search ───────────────────────────────
  const isModalOpen = modalTarget !== undefined;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || isModalOpen || deleteTarget) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setModalTarget(null);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isModalOpen, deleteTarget]);

  // ── Derived data (full dataset → summary + charts) ────────────────────────
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const tx of transactions) {
      if (tx.cluster_name) cats.add(tx.cluster_name);
      if (tx.manual_category) cats.add(tx.manual_category);
    }
    return Array.from(cats).sort();
  }, [transactions]);

  const clusterSummaries = useMemo(() => buildClusterSummaries(transactions), [transactions]);
  const totalSpent = useMemo(() => transactions.reduce((s, tx) => s + (tx.amount ?? 0), 0), [transactions]);
  const avgTransaction = transactions.length > 0 ? totalSpent / transactions.length : 0;
  const topCategory = clusterSummaries.length > 0
    ? { name: clusterSummaries[0].cluster_name, total: clusterSummaries[0].total }
    : null;

  // ── Filtered + sorted view (table only) ───────────────────────────────────
  const visibleTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = transactions.filter((tx) => {
      if (q && !(tx.vendor ?? "").toLowerCase().includes(q)) return false;
      if (categoryFilter && effectiveCategory(tx) !== categoryFilter) return false;
      if (manualOnly && tx.manual_category == null) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "amount":
          return ((a.amount ?? 0) - (b.amount ?? 0)) * dir;
        case "vendor":
          return (a.vendor ?? "").localeCompare(b.vendor ?? "") * dir;
        case "category":
          return effectiveCategory(a).localeCompare(effectiveCategory(b)) * dir;
        case "date":
        default:
          return (a.date ?? "").localeCompare(b.date ?? "") * dir;
      }
    });
  }, [transactions, search, categoryFilter, manualOnly, sortKey, sortDir]);

  const hasActiveFilters = search.trim() !== "" || categoryFilter !== null || manualOnly;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="nb-card h-24 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="nb-card h-[360px] animate-pulse" />
            <div className="nb-card h-[360px] animate-pulse" />
          </div>
          <div className="nb-card h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Fatal load error ──────────────────────────────────────────────────────
  if (error && transactions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="nb-card max-w-md p-6 text-center">
          <p className="text-lg font-extrabold text-red-600 dark:text-red-400">Failed to load data</p>
          <p className="mt-1 text-sm font-semibold text-[var(--nb-muted)]">{error}</p>
          <p className="mt-3 text-xs font-medium text-[var(--nb-muted)]">
            Make sure the backend is running at{" "}
            <code className="rounded border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-1 py-0.5">
              {BASE_URL}
            </code>
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchClusters();
            }}
            className="nb-btn nb-btn-primary mt-4 px-4 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b-[3px] border-[var(--nb-ink)] bg-[var(--nb-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[2.5px] border-[var(--nb-ink)] bg-[var(--nb-primary)] shadow-[3px_3px_0_0_var(--nb-ink)]">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-extrabold text-[var(--foreground)]">Finance Dashboard</h1>
              <p className="text-xs font-semibold text-[var(--nb-muted)]">ML-powered spending clusters</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CurrencySelect value={currency} options={CURRENCY_OPTIONS} onChange={setCurrency} />
            <ThemeToggle />
            <button
              onClick={() => exportTransactionsCsv(visibleTransactions)}
              className="nb-btn h-10 px-3 text-sm"
              title="Export current view to CSV"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => setModalTarget(null)} className="nb-btn nb-btn-primary h-10 px-3 text-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {transactions.length === 0 ? (
          <EmptyState onAdd={() => setModalTarget(null)} />
        ) : (
          <>
            <SummaryCard
              totalTransactions={transactions.length}
              totalSpent={totalSpent}
              avgTransaction={avgTransaction}
              topCategory={topCategory}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ClusterChart data={clusterSummaries} activeCategory={categoryFilter} onSelect={setCategoryFilter} />
              <SpendingTrendChart transactions={transactions} />
            </div>

            {/* Transactions card */}
            <div className="nb-card overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b-[3px] border-[var(--nb-ink)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-base font-extrabold text-[var(--foreground)]">Transactions</h2>
                  <span className="text-xs font-bold text-[var(--nb-muted)]">
                    {hasActiveFilters
                      ? `${visibleTransactions.length} of ${transactions.length}`
                      : `${transactions.length} total`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nb-muted)]" />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search vendor…  ( / )"
                      className="nb-input h-9 w-44 py-1.5 pl-8 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setManualOnly((m) => !m)}
                    className={`nb-btn h-9 px-3 text-xs ${manualOnly ? "nb-btn-primary" : ""}`}
                    title="Show only manually overridden rows"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Manual only
                  </button>
                </div>
              </div>

              {/* Active filter chips */}
              {(categoryFilter || manualOnly) && (
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-dashed border-[var(--nb-ink)]/20 px-4 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--nb-muted)]">Filters:</span>
                  {categoryFilter && (
                    <button onClick={() => setCategoryFilter(null)} className="nb-badge bg-[var(--nb-primary)] !text-white">
                      {categoryFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {manualOnly && (
                    <button onClick={() => setManualOnly(false)} className="nb-badge bg-[#fcd34d]">
                      Manual only
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              <TransactionTable
                transactions={visibleTransactions}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
                onEdit={(tx) => setModalTarget(tx)}
                onDelete={(tx) => setDeleteTarget(tx)}
                onRevert={handleRevert}
              />
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <TransactionModal
            transaction={modalTarget ?? undefined}
            availableCategories={availableCategories}
            onClose={() => setModalTarget(undefined)}
            onSuccess={(msg) => {
              toast(msg, "success");
              fetchClusters();
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            title="Delete transaction?"
            message={`This will permanently remove "${deleteTarget.vendor ?? "Unknown"}" (${
              deleteTarget.date ?? "no date"
            }). This cannot be undone.`}
            onConfirm={() => performDelete(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
