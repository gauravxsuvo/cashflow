"use client";

import { ArrowRightLeft, Crown, Receipt, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { categoryColor } from "@/lib/categoryColors";
import { useSettings } from "@/context/SettingsContext";

interface SummaryCardProps {
  totalTransactions: number;
  totalSpent: number;
  avgTransaction: number;
  topCategory: { name: string; total: number } | null;
}

interface StatCardProps {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ icon, accent, label, value, sub }: StatCardProps) {
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
        <p className="truncate text-2xl font-extrabold tabular-nums text-[var(--foreground)]">
          {value}
        </p>
        {sub && <p className="truncate text-xs font-semibold text-[var(--nb-muted)]">{sub}</p>}
      </div>
    </div>
  );
}

export default function SummaryCard({
  totalTransactions,
  totalSpent,
  avgTransaction,
  topCategory,
}: SummaryCardProps) {
  const { currency } = useSettings();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        accent="#bef264"
        icon={<Wallet className="h-6 w-6" />}
        label="Total Spent"
        value={formatCurrency(totalSpent, currency)}
      />
      <StatCard
        accent="#67e8f9"
        icon={<Receipt className="h-6 w-6" />}
        label="Transactions"
        value={totalTransactions.toString()}
      />
      <StatCard
        accent="#fcd34d"
        icon={<ArrowRightLeft className="h-6 w-6" />}
        label="Avg. Transaction"
        value={totalTransactions > 0 ? formatCurrency(avgTransaction, currency) : "—"}
      />
      <StatCard
        accent={topCategory ? categoryColor(topCategory.name) : "#d4d4d8"}
        icon={<Crown className="h-6 w-6" />}
        label="Top Category"
        value={topCategory ? topCategory.name : "—"}
        sub={topCategory ? formatCurrency(topCategory.total, currency) : undefined}
      />
    </div>
  );
}
