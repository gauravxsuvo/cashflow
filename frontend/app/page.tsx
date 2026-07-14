"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, Plus, Search, SlidersHorizontal, Wallet, X } from "lucide-react";
import type { Budgets, Transaction } from "@/types";
import type { SortKey, SortDir } from "@/components/TransactionTable";
import { api, BASE_URL } from "@/lib/api";
import { exportTransactionsCsv } from "@/lib/exportCsv";
import {
  computeTotals,
  effectiveCategory,
  expensesByCategory,
} from "@/lib/transactions";
import { currentMonthLabel, currentMonthTransactions, filterByPeriod, type PeriodId } from "@/lib/period";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/components/Toast";
import SummaryCard from "@/components/SummaryCard";
import CategoryChart from "@/components/CategoryChart";
import CashflowChart from "@/components/CashflowChart";
import BudgetPanel from "@/components/BudgetPanel";
import PeriodFilter from "@/components/PeriodFilter";
import TransactionTable from "@/components/TransactionTable";
import TransactionModal from "@/components/TransactionModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelect from "@/components/CurrencySelect";

const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "JPY", label: "Yen", symbol: "¥" },
];

type TypeFilter = "all" | "expense" | "income";

export default function DashboardPage() {
  const { currency, setCurrency } = useSettings();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined = closed | null = add mode | Transaction = edit mode
  const [modalTarget, setModalTarget] = useState<Transaction | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // Dashboard-wide time scope + table view controls
  const [period, setPeriod] = useState<PeriodId>("month");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [manualOnly, setManualOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const searchRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [txns, buds] = await Promise.all([api.getTransactions(), api.getBudgets()]);
      setTransactions(txns);
      setBudgets(buds);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. The backend may be waking up — please retry in a moment.");
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Mutations (optimistic) ────────────────────────────────────────────────
  async function performDelete(tx: Transaction) {
    setDeleteTarget(null);
    const prev = transactions;
    setTransactions((t) => t.filter((x) => x.transaction_id !== tx.transaction_id));
    try {
      await api.deleteTransaction(tx.transaction_id);
      toast("Transaction deleted", "success");
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
      const updated = await api.updateTransaction(tx.transaction_id, { manual_category: null });
      setTransactions((t) => t.map((x) => (x.transaction_id === updated.transaction_id ? updated : x)));
      toast("Reverted to auto category", "success");
    } catch {
      setTransactions(prev);
      toast("Could not revert category", "error");
    }
  }

  async function handleSetBudget(category: string, limit: number | null) {
    const prev = budgets;
    setBudgets((b) => {
      const next = { ...b };
      if (limit && limit > 0) next[category] = limit;
      else delete next[category];
      return next;
    });
    try {
      const updated = await api.setBudget(category, limit);
      setBudgets(updated);
      toast(limit && limit > 0 ? "Budget saved" : "Budget removed", "success");
    } catch {
      setBudgets(prev);
      toast("Could not update budget", "error");
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

  // ── Period-scoped dataset → stats + charts ────────────────────────────────
  const periodTransactions = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
  const totals = useMemo(() => computeTotals(periodTransactions), [periodTransactions]);
  const categorySummaries = useMemo(() => expensesByCategory(periodTransactions), [periodTransactions]);
  const topCategory = categorySummaries.length > 0
    ? { name: categorySummaries[0].category, total: categorySummaries[0].total }
    : null;

  // ── Budgets always track the current calendar month ───────────────────────
  const monthTransactions = useMemo(() => currentMonthTransactions(transactions), [transactions]);
  const spentByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (tx.type !== "expense") continue;
      const c = effectiveCategory(tx);
      m[c] = (m[c] ?? 0) + (tx.amount ?? 0);
    }
    return m;
  }, [monthTransactions]);

  // ── Filtered + sorted view (table only) ───────────────────────────────────
  const visibleTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = periodTransactions.filter((tx) => {
      if (q && !(tx.vendor ?? "").toLowerCase().includes(q)) return false;
      if (categoryFilter && effectiveCategory(tx) !== categoryFilter) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
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
  }, [periodTransactions, search, categoryFilter, typeFilter, manualOnly, sortKey, sortDir]);

  const hasActiveFilters =
    search.trim() !== "" || categoryFilter !== null || typeFilter !== "all" || manualOnly;

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
              fetchData();
            }}
            className="nb-btn nb-btn-primary mt-4 px-4 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const typeFilters: { id: TypeFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "expense", label: "Expenses" },
    { id: "income", label: "Income" },
  ];

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    // overflow-x-clip: no single value can ever make the whole page scroll
    // sideways; wide content (the table) scrolls inside its own container.
    <div className="min-h-screen overflow-x-clip">
      {/* Header */}
      <header className="border-b-[3px] border-[var(--nb-ink)] bg-[var(--nb-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-[2.5px] border-[var(--nb-ink)] bg-[var(--nb-primary)] shadow-[3px_3px_0_0_var(--nb-ink)]">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--foreground)]">Cashflow</h1>
              <p className="hidden text-xs font-semibold text-[var(--nb-muted)] sm:block">
                Track spending, income &amp; budgets
              </p>
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
            {/* Period scope */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PeriodFilter value={period} onChange={setPeriod} />
              <span className="text-xs font-bold text-[var(--nb-muted)]">
                {periodTransactions.length} transaction{periodTransactions.length === 1 ? "" : "s"}
              </span>
            </div>

            <SummaryCard totals={totals} topCategory={topCategory} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CategoryChart data={categorySummaries} activeCategory={categoryFilter} onSelect={setCategoryFilter} />
              <CashflowChart transactions={periodTransactions} />
            </div>

            <BudgetPanel
              monthLabel={currentMonthLabel()}
              spentByCategory={spentByCategory}
              budgets={budgets}
              onSetBudget={handleSetBudget}
            />

            {/* Transactions card */}
            <div className="nb-card overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b-[3px] border-[var(--nb-ink)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-base font-extrabold text-[var(--foreground)]">Transactions</h2>
                  <span className="text-xs font-bold text-[var(--nb-muted)]">
                    {hasActiveFilters
                      ? `${visibleTransactions.length} of ${periodTransactions.length}`
                      : `${periodTransactions.length} shown`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Type filter */}
                  <div className="nb-card-flat inline-flex items-center gap-0.5 p-0.5">
                    {typeFilters.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTypeFilter(t.id)}
                        className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-colors ${
                          typeFilter === t.id
                            ? "bg-[var(--nb-primary)] text-white"
                            : "text-[var(--nb-muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nb-muted)]" />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…  ( / )"
                      className="nb-input h-9 w-40 py-1.5 pl-8 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setManualOnly((m) => !m)}
                    className={`nb-btn h-9 px-3 text-xs ${manualOnly ? "nb-btn-primary" : ""}`}
                    title="Show only rows where you set the category"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Manual only
                  </button>
                </div>
              </div>

              {/* Active filter chips */}
              {(categoryFilter || manualOnly || typeFilter !== "all") && (
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-dashed border-[var(--nb-ink)]/20 px-4 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--nb-muted)]">Filters:</span>
                  {categoryFilter && (
                    <button onClick={() => setCategoryFilter(null)} className="nb-badge bg-[var(--nb-primary)] !text-white">
                      {categoryFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {typeFilter !== "all" && (
                    <button onClick={() => setTypeFilter("all")} className="nb-badge bg-[#67e8f9]">
                      {typeFilter === "income" ? "Income" : "Expenses"}
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
            onClose={() => setModalTarget(undefined)}
            onSuccess={(msg) => {
              toast(msg, "success");
              fetchData();
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
