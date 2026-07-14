"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Download, Plus, Search, SlidersHorizontal, Wallet, X } from "lucide-react";
import type { Budgets, Transaction } from "@/types";
import type { SortKey, SortDir } from "@/components/TransactionTable";
import { api, ApiError, BASE_URL } from "@/lib/api";
import { exportTransactionsCsv } from "@/lib/exportCsv";
import {
  computeTotals,
  effectiveCategory,
  expensesByCategory,
  hasAccounts,
  netByAccount,
} from "@/lib/transactions";
import {
  currentMonthLabel,
  currentMonthTransactions,
  filterByPeriod,
  periodRange,
  type PeriodId,
} from "@/lib/period";
import { useToast } from "@/components/Toast";
import SummaryCard from "@/components/SummaryCard";
import CategoryChart from "@/components/CategoryChart";
import CashflowChart from "@/components/CashflowChart";
import AccountsPanel from "@/components/AccountsPanel";
import BudgetPanel from "@/components/BudgetPanel";
import PeriodFilter from "@/components/PeriodFilter";
import TransactionTable from "@/components/TransactionTable";
import TransactionModal from "@/components/TransactionModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import SettingsModal from "@/components/SettingsModal";

type TypeFilter = "all" | "expense" | "income";

export default function Dashboard() {
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined = closed | null = add mode | Transaction = edit mode
  const [modalTarget, setModalTarget] = useState<Transaction | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dashboard-wide time scope + table view controls
  const [period, setPeriod] = useState<PeriodId>("month");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
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
      if (err instanceof ApiError && err.status === 401) {
        return; // AuthContext handles session expiry / logout
      }
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
  const anyOverlayOpen = isModalOpen || !!deleteTarget || settingsOpen;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || anyOverlayOpen) return;
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
  }, [anyOverlayOpen]);

  // ── Period-scoped dataset → stats + charts ────────────────────────────────
  const periodTransactions = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
  const totals = useMemo(() => computeTotals(periodTransactions), [periodTransactions]);
  const categorySummaries = useMemo(() => expensesByCategory(periodTransactions), [periodTransactions]);
  const topCategory =
    categorySummaries.length > 0
      ? { name: categorySummaries[0].category, total: categorySummaries[0].total }
      : null;

  const accountSummaries = useMemo(() => netByAccount(periodTransactions), [periodTransactions]);
  const showAccounts = useMemo(() => hasAccounts(transactions), [transactions]);
  const usedAccounts = useMemo(() => {
    const set = new Set<string>();
    for (const tx of periodTransactions) set.add(tx.account?.trim() || "Unassigned");
    return Array.from(set).sort();
  }, [periodTransactions]);

  // ── Month-over-month expense trend (calendar months, for the summary) ─────
  const expenseTrend = useMemo(() => {
    const thisMonth = computeTotals(currentMonthTransactions(transactions)).expenses;
    const range = periodRange("last-month");
    const lastMonth = transactions
      .filter((tx) => tx.date && range && tx.date >= range.start && tx.date <= range.end && tx.type === "expense")
      .reduce((s, tx) => s + (tx.amount ?? 0), 0);
    if (lastMonth <= 0) return null;
    return ((thisMonth - lastMonth) / lastMonth) * 100;
  }, [transactions]);

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
      if (
        q &&
        !(tx.vendor ?? "").toLowerCase().includes(q) &&
        !(tx.note ?? "").toLowerCase().includes(q)
      )
        return false;
      if (categoryFilter && effectiveCategory(tx) !== categoryFilter) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (accountFilter && (tx.account?.trim() || "Unassigned") !== accountFilter) return false;
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
  }, [periodTransactions, search, categoryFilter, typeFilter, accountFilter, manualOnly, sortKey, sortDir]);

  const hasActiveFilters =
    search.trim() !== "" ||
    categoryFilter !== null ||
    typeFilter !== "all" ||
    accountFilter !== null ||
    manualOnly;

  const typeFilters: { id: TypeFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "expense", label: "Expenses" },
    { id: "income", label: "Income" },
  ];

  // ── Header (shared across states) ─────────────────────────────────────────
  const header = (
    <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[var(--glass-fill-soft)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] shadow-[0_8px_22px_-8px_var(--ring)]">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--foreground)]">Cashflow</h1>
            <p className="hidden text-xs font-medium text-[var(--muted)] sm:block">
              Track spending, income &amp; budgets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportTransactionsCsv(visibleTransactions)}
            className="nb-icon-btn hidden h-10 w-10 sm:inline-flex"
            title="Export current view to CSV"
            aria-label="Export CSV"
            disabled={visibleTransactions.length === 0}
          >
            <Download className="h-4 w-4" />
          </button>
          <ThemeToggle />
          <button onClick={() => setModalTarget(null)} className="nb-btn nb-btn-primary h-10 px-3 text-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <UserMenu onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </div>
    </header>
  );

  const overlays = (
    <>
      <AnimatePresence>
        {isModalOpen && (
          <TransactionModal
            transaction={modalTarget ?? undefined}
            knownAccounts={usedAccounts.filter((a) => a !== "Unassigned")}
            onClose={() => setModalTarget(undefined)}
            onSuccess={(msg) => {
              toast(msg, "success");
              fetchData();
            }}
          />
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            onDataCleared={() => {
              setTransactions([]);
              setBudgets({});
              fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen overflow-x-clip">
        {header}
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
        {overlays}
      </div>
    );
  }

  // ── Fatal load error ──────────────────────────────────────────────────────
  if (error && transactions.length === 0) {
    return (
      <div className="min-h-screen overflow-x-clip">
        {header}
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="nb-card max-w-md p-6 text-center">
            <p className="text-lg font-bold text-[var(--neg)]">Failed to load data</p>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">{error}</p>
            <p className="mt-3 text-xs font-medium text-[var(--muted)]">
              Make sure the backend is running at{" "}
              <code className="rounded-md border border-[var(--hairline)] bg-[var(--surface-2)] px-1 py-0.5">
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
        {overlays}
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    // overflow-x-clip: no single value can ever make the whole page scroll
    // sideways; wide content (the table) scrolls inside its own container.
    <div className="min-h-screen overflow-x-clip">
      {header}

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {transactions.length === 0 ? (
          <EmptyState onAdd={() => setModalTarget(null)} />
        ) : (
          <>
            {/* Period scope */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PeriodFilter value={period} onChange={setPeriod} />
              <span className="text-xs font-semibold text-[var(--muted)]">
                {periodTransactions.length} transaction{periodTransactions.length === 1 ? "" : "s"}
              </span>
            </div>

            <SummaryCard totals={totals} topCategory={topCategory} expenseTrend={expenseTrend} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CategoryChart data={categorySummaries} activeCategory={categoryFilter} onSelect={setCategoryFilter} />
              <CashflowChart transactions={periodTransactions} />
            </div>

            {showAccounts && <AccountsPanel accounts={accountSummaries} />}

            <BudgetPanel
              monthLabel={currentMonthLabel()}
              spentByCategory={spentByCategory}
              budgets={budgets}
              onSetBudget={handleSetBudget}
            />

            {/* Transactions card */}
            <div className="nb-card overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-[var(--hairline)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-base font-bold tracking-tight text-[var(--foreground)]">Transactions</h2>
                  <span className="text-xs font-semibold text-[var(--muted)]">
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
                        className={`rounded-[8px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                          typeFilter === t.id
                            ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {showAccounts && usedAccounts.length > 1 && (
                    <select
                      value={accountFilter ?? ""}
                      onChange={(e) => setAccountFilter(e.target.value || null)}
                      className="nb-input h-9 w-auto py-1 text-xs"
                      aria-label="Filter by account"
                    >
                      <option value="">All accounts</option>
                      {usedAccounts.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
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
                    <span className="hidden sm:inline">Manual only</span>
                  </button>
                </div>
              </div>

              {/* Active filter chips */}
              {(categoryFilter || manualOnly || typeFilter !== "all" || accountFilter) && (
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline)] px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Filters:</span>
                  {categoryFilter && (
                    <button onClick={() => setCategoryFilter(null)} className="nb-badge !text-[var(--primary)]">
                      {categoryFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {typeFilter !== "all" && (
                    <button onClick={() => setTypeFilter("all")} className="nb-badge">
                      {typeFilter === "income" ? "Income" : "Expenses"}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {accountFilter && (
                    <button onClick={() => setAccountFilter(null)} className="nb-badge">
                      {accountFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {manualOnly && (
                    <button onClick={() => setManualOnly(false)} className="nb-badge">
                      Manual only
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              <TransactionTable
                transactions={visibleTransactions}
                showAccounts={showAccounts}
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

      {overlays}
    </div>
  );
}
