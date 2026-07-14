"use client";

import { ArrowDownRight, ArrowUpRight, PiggyBank, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";
import type { Totals } from "@/lib/transactions";

interface SummaryCardProps {
  totals: Totals;
  topCategory: { name: string; total: number } | null;
  /** Month-over-month expense change (%). Positive = spending more. */
  expenseTrend?: number | null;
}

interface StatCardProps {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  valueClass?: string;
}

function StatCard({ icon, accent, label, value, sub, valueClass }: StatCardProps) {
  return (
    <div className="nb-card flex items-center gap-4 p-4 sm:p-5">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>
        <p className={`truncate text-2xl font-bold tabular-nums ${valueClass ?? "text-[var(--foreground)]"}`}>
          {value}
        </p>
        {sub && <div className="truncate text-xs font-medium text-[var(--muted)]">{sub}</div>}
      </div>
    </div>
  );
}

export default function SummaryCard({ totals, topCategory, expenseTrend }: SummaryCardProps) {
  const { currency } = useSettings();
  const { income, expenses, net, savingsRate } = totals;
  const positive = net >= 0;

  const trendEl =
    expenseTrend != null && Number.isFinite(expenseTrend) ? (
      <span
        className={`inline-flex items-center gap-0.5 font-semibold ${
          expenseTrend > 0 ? "text-[var(--neg)]" : "text-[var(--pos)]"
        }`}
      >
        {expenseTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(expenseTrend).toFixed(0)}% vs last mo
      </span>
    ) : topCategory ? (
      `Top: ${topCategory.name}`
    ) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        accent={positive ? "#10b981" : "#f43f5e"}
        icon={<Scale className="h-6 w-6" />}
        label="Net Balance"
        value={`${net < 0 ? "−" : ""}${formatCurrency(Math.abs(net), currency)}`}
        valueClass={positive ? "text-[var(--pos)]" : "text-[var(--neg)]"}
        sub={positive ? "You're in the green" : "Spending exceeds income"}
      />
      <StatCard
        accent="#10b981"
        icon={<ArrowUpRight className="h-6 w-6" />}
        label="Income"
        value={formatCurrency(income, currency)}
      />
      <StatCard
        accent="#6a5cff"
        icon={<ArrowDownRight className="h-6 w-6" />}
        label="Expenses"
        value={formatCurrency(expenses, currency)}
        sub={trendEl}
      />
      <StatCard
        accent="#22d3ee"
        icon={<PiggyBank className="h-6 w-6" />}
        label="Savings Rate"
        value={income > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
        sub={income > 0 ? "of income kept" : "add income to track"}
      />
    </div>
  );
}
