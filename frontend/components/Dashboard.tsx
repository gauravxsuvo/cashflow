"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Plus, Search, Wallet, X } from "lucide-react";
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
import InsightsPanel from "@/components/InsightsPanel";
import AccountsPanel from "@/components/AccountsPanel";
import BudgetPanel from "@/components/BudgetPanel";
import PeriodFilter from "@/components/PeriodFilter";
import TransactionTable from "@/components/TransactionTable";
import TransactionModal from "@/components/TransactionModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import ThemeToggle from "@/components/ThemeToggle";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import CategoryManagerModal from "@/components/CategoryManagerModal";

type TypeFilter = "all" | "expense" | "income";

export default function Dashboard() {
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTarget, setModalTarget] = useState<Transaction | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [period, setPeriod] = useState<PeriodId>("month");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
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
      if (err instanceof ApiError && err.status === 401) return;
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
      setTransactions(prev);
      toast("Could not delete transaction", "error");
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
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  }

  function scrollToSection(id: string) {
    setDrawerOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const isModalOpen = modalTarget !== undefined;
  const anyOverlayOpen = isModalOpen || !!deleteTarget || settingsOpen || categoriesOpen || drawerOpen;
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

  // ── Derived data ──────────────────────────────────────────────────────────
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
  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const tx of periodTransactions) set.add(effectiveCategory(tx));
    return Array.from(set).sort();
  }, [periodTransactions]);

  const recentTransactions = useMemo(
    () => [...periodTransactions].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    [periodTransactions]
  );

  const expenseTrend = useMemo(() => {
    const thisMonth = computeTotals(currentMonthTransactions(transactions)).expenses;
    const range = periodRange("last-month");
    const lastMonth = transactions
      .filter((tx) => tx.date && range && tx.date >= range.start && tx.date <= range.end && tx.type === "expense")
      .reduce((s, tx) => s + (tx.amount ?? 0), 0);
    if (lastMonth <= 0) return null;
    return ((thisMonth - lastMonth) / lastMonth) * 100;
  }, [transactions]);

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
  }, [periodTransactions, search, categoryFilter, typeFilter, accountFilter, sortKey, sortDir]);

  const hasActiveFilters =
    search.trim() !== "" || categoryFilter !== null || typeFilter !== "all" || accountFilter !== null;

  const typeFilters: { id: TypeFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "expense", label: "Expenses" },
    { id: "income", label: "Income" },
  ];

  const openAdd = () => {
    setDrawerOpen(false);
    setModalTarget(null);
  };
  const doExport = () => {
    setDrawerOpen(false);
    exportTransactionsCsv(visibleTransactions);
  };

  const sidebar = (
    <Sidebar
      onAdd={openAdd}
      onExport={doExport}
      onOpenCategories={() => {
        setDrawerOpen(false);
        setCategoriesOpen(true);
      }}
      onOpenSettings={() => {
        setDrawerOpen(false);
        setSettingsOpen(true);
      }}
      onNavigate={scrollToSection}
      showAccounts={showAccounts}
    />
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
      <AnimatePresence>
        {categoriesOpen && (
          <CategoryManagerModal onClose={() => setCategoriesOpen(false)} onMutated={fetchData} />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="fixed inset-0 z-[60] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <motion.aside
              className="nb-card absolute inset-y-0 left-0 w-[276px] max-w-[85vw] rounded-l-none p-0"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
            >
              {sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  // Mobile top bar (lg:hidden)
  const mobileHeader = (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--card)] px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2">
        <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="nb-icon-btn h-10 w-10">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)]">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-[var(--foreground)]">Cashflow</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button onClick={openAdd} className="nb-btn nb-btn-primary h-10 px-3 text-sm">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </header>
  );

  // ── Content by state (wrapped by a single stable shell below) ─────────────
  let content: React.ReactNode;

  if (loading) {
    content = (
      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="nb-card h-24 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <div className="nb-card h-[340px] animate-pulse" />
          <div className="nb-card h-[340px] animate-pulse" />
          <div className="nb-card hidden h-[340px] animate-pulse xl:block" />
        </div>
        <div className="nb-card h-72 animate-pulse" />
      </main>
    );
  } else if (error && transactions.length === 0) {
    content = (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="nb-card max-w-md p-6 text-center">
          <p className="text-lg font-bold text-[var(--neg)]">Failed to load data</p>
          <p className="mt-1 text-sm font-medium text-[var(--muted)]">{error}</p>
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">
            Make sure the backend is running at{" "}
            <code className="rounded-md bg-[var(--surface-2)] px-1 py-0.5">{BASE_URL}</code>
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
  } else {
    content = (
      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {transactions.length === 0 ? (
          <EmptyState onAdd={() => setModalTarget(null)} />
        ) : (
          <>
            {/* Overview header */}
            <div id="overview" className="flex flex-wrap items-center justify-between gap-3 scroll-mt-20">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Overview</h1>
                <p className="text-sm text-[var(--muted)]">
                  {periodTransactions.length} transaction{periodTransactions.length === 1 ? "" : "s"} in view
                </p>
              </div>
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <PeriodFilter value={period} onChange={setPeriod} />
                <button onClick={() => setModalTarget(null)} className="nb-btn nb-btn-primary hidden h-10 shrink-0 px-4 text-sm sm:inline-flex">
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            <SummaryCard totals={totals} topCategory={topCategory} expenseTrend={expenseTrend} />

            {/* Charts + insights */}
            <div id="spending" className="grid grid-cols-1 gap-6 scroll-mt-20 lg:grid-cols-2 xl:grid-cols-3">
              <CategoryChart data={categorySummaries} activeCategory={categoryFilter} onSelect={setCategoryFilter} />
              <CashflowChart transactions={periodTransactions} />
              <div className="lg:col-span-2 xl:col-span-1">
                <InsightsPanel totals={totals} summaries={categorySummaries} recent={recentTransactions} />
              </div>
            </div>

            {/* Accounts + budgets */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {showAccounts && (
                <div id="accounts" className="scroll-mt-20">
                  <AccountsPanel accounts={accountSummaries} />
                </div>
              )}
              <div id="budgets" className={`scroll-mt-20 ${showAccounts ? "" : "lg:col-span-2"}`}>
                <BudgetPanel
                  monthLabel={currentMonthLabel()}
                  spentByCategory={spentByCategory}
                  budgets={budgets}
                  onSetBudget={handleSetBudget}
                />
              </div>
            </div>

            {/* Transactions */}
            <div id="transactions" className="nb-card overflow-hidden p-0 scroll-mt-20">
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
                  <div className="nb-card-flat inline-flex items-center gap-0.5 p-0.5">
                    {typeFilters.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTypeFilter(t.id)}
                        className={`rounded-[9px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                          typeFilter === t.id
                            ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {usedCategories.length > 1 && (
                    <select
                      value={categoryFilter ?? ""}
                      onChange={(e) => setCategoryFilter(e.target.value || null)}
                      className="nb-input h-9 w-auto py-1 text-xs"
                      aria-label="Filter by category"
                    >
                      <option value="">All categories</option>
                      {usedCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}

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

                  <div className="relative min-w-[9rem] flex-1 sm:flex-none">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…  ( / )"
                      className="nb-input h-9 w-full py-1.5 pl-8 text-sm sm:w-44"
                    />
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
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
                  {search.trim() && (
                    <button onClick={() => setSearch("")} className="nb-badge">
                      “{search.trim()}”
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
              />
            </div>
          </>
        )}
      </main>
    );
  }

  // ── Single stable shell (structure never remounts across states) ──────────
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto lg:block">
        {sidebar}
      </aside>
      <div className="min-w-0 flex-1 overflow-x-clip">
        {mobileHeader}
        {content}
      </div>
      {overlays}
    </div>
  );
}
