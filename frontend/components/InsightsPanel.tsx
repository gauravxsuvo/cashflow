"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import type { CategorySummary, Transaction } from "@/types";
import type { Totals } from "@/lib/transactions";
import { effectiveCategory } from "@/lib/transactions";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";
import { useCategories } from "@/context/CategoriesContext";

interface InsightsPanelProps {
  totals: Totals;
  summaries: CategorySummary[];
  recent: Transaction[];
}

export default function InsightsPanel({ totals, summaries, recent }: InsightsPanelProps) {
  const { currency } = useSettings();
  const { colorFor } = useCategories();

  const top = summaries.slice(0, 4);
  const maxTotal = top.length ? top[0].total : 0;
  const recentFew = recent.slice(0, 5);

  return (
    <div className="nb-card flex h-full flex-col gap-5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[var(--primary)]" />
        <h2 className="text-base font-black uppercase tracking-tight text-[var(--foreground)]">Insights</h2>
      </div>

      {/* Savings rate */}
      <div className="rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Savings rate</span>
          <TrendingUp className="h-4 w-4 text-[var(--pos)]" />
        </div>
        <p className="mt-1 text-3xl font-black tabular-nums text-[var(--foreground)]">
          {totals.income > 0 ? `${totals.savingsRate.toFixed(0)}%` : "—"}
        </p>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-[2px] border border-[var(--border)] bg-[var(--card)]">
          <div
            className="h-full bg-[var(--primary)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, totals.savingsRate))}%` }}
          />
        </div>
      </div>

      {/* Top categories */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Top spending</p>
        {top.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No spending in this period.</p>
        ) : (
          <ul className="space-y-2.5">
            {top.map((c) => {
              const color = colorFor(c.category);
              const pct = maxTotal > 0 ? (c.total / maxTotal) * 100 : 0;
              return (
                <li key={c.category}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--foreground)]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="truncate">{c.category}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--muted)]">
                      {formatCurrency(c.total, currency)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-[var(--surface-2)]">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Recent activity */}
      <div className="mt-auto">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Recent</p>
        {recentFew.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentFew.map((tx) => {
              const isIncome = tx.type === "income";
              return (
                <li key={tx.transaction_id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--foreground)]">{tx.vendor ?? "Unknown"}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{effectiveCategory(tx)}</p>
                  </div>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      isIncome ? "text-[var(--pos)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(tx.amount ?? 0, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
