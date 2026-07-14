"use client";

import { ArrowDownRight, ArrowUpRight, PiggyBank, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";
import type { Totals } from "@/lib/transactions";

interface SummaryCardProps {
  totals: Totals;
  topCategory: { name: string; total: number } | null;
}

interface StatCardProps {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}

function StatCard({ icon, accent, label, value, sub, valueClass }: StatCardProps) {
  return (
    <div className="nb-card flex items-center gap-4 p-4 sm:p-5">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border-[2.5px] border-[var(--nb-ink)] text-black"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.7rem] font-bold uppercase tracking-wider text-[var(--nb-muted)]">
          {label}
        </p>
        <p className={`truncate text-2xl font-extrabold tabular-nums ${valueClass ?? "text-[var(--foreground)]"}`}>
          {value}
        </p>
        {sub && <p className="truncate text-xs font-semibold text-[var(--nb-muted)]">{sub}</p>}
      </div>
    </div>
  );
}

export default function SummaryCard({ totals, topCategory }: SummaryCardProps) {
  const { currency } = useSettings();
  const { income, expenses, net, savingsRate } = totals;
  const positive = net >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        accent={positive ? "#86efac" : "#fca5a5"}
        icon={<Scale className="h-6 w-6" />}
        label="Net Balance"
        value={`${net < 0 ? "−" : ""}${formatCurrency(Math.abs(net), currency)}`}
        valueClass={positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
        sub={positive ? "You're in the green" : "Spending exceeds income"}
      />
      <StatCard
        accent="#bef264"
        icon={<ArrowUpRight className="h-6 w-6" />}
        label="Income"
        value={formatCurrency(income, currency)}
      />
      <StatCard
        accent="#fca5a5"
        icon={<ArrowDownRight className="h-6 w-6" />}
        label="Expenses"
        value={formatCurrency(expenses, currency)}
        sub={topCategory ? `Top: ${topCategory.name}` : undefined}
      />
      <StatCard
        accent="#67e8f9"
        icon={<PiggyBank className="h-6 w-6" />}
        label="Savings Rate"
        value={income > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
        sub={income > 0 ? "of income kept" : "add income to track"}
      />
    </div>
  );
}
