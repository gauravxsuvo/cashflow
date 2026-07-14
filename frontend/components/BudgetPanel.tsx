"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Target, X } from "lucide-react";
import type { Budgets } from "@/types";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { categoryColor } from "@/lib/categoryColors";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";

interface BudgetPanelProps {
  monthLabel: string;
  spentByCategory: Record<string, number>;
  budgets: Budgets;
  onSetBudget: (category: string, limit: number | null) => void;
}

function barColor(ratio: number): string {
  if (ratio > 1) return "#ef4444"; // over budget
  if (ratio >= 0.8) return "#f59e0b"; // getting close
  return "#22c55e"; // healthy
}

export default function BudgetPanel({ monthLabel, spentByCategory, budgets, onSetBudget }: BudgetPanelProps) {
  const { currency } = useSettings();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState("");
  const [addLimit, setAddLimit] = useState("");

  // Rows: any expense category that has a budget or some spend this month.
  const rows = useMemo(() => {
    const names = new Set<string>([...Object.keys(budgets)]);
    for (const [cat, amt] of Object.entries(spentByCategory)) {
      if (amt > 0) names.add(cat);
    }
    return Array.from(names)
      .filter((c) => EXPENSE_CATEGORIES.includes(c as (typeof EXPENSE_CATEGORIES)[number]))
      .map((category) => {
        const spent = spentByCategory[category] ?? 0;
        const limit = budgets[category] ?? null;
        const ratio = limit ? spent / limit : 0;
        return { category, spent, limit, ratio };
      })
      .sort((a, b) => {
        // Over-budget first, then by spend.
        const aOver = a.limit && a.ratio > 1 ? 1 : 0;
        const bOver = b.limit && b.ratio > 1 ? 1 : 0;
        if (aOver !== bOver) return bOver - aOver;
        return b.spent - a.spent;
      });
  }, [budgets, spentByCategory]);

  const unbudgeted = EXPENSE_CATEGORIES.filter((c) => !(c in budgets));

  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  const totalSpentBudgeted = Object.keys(budgets).reduce((s, c) => s + (spentByCategory[c] ?? 0), 0);

  function startEdit(category: string, limit: number | null) {
    setEditing(category);
    setDraft(limit != null ? String(limit) : "");
  }

  function saveEdit(category: string) {
    const val = parseFloat(draft);
    onSetBudget(category, Number.isFinite(val) && val > 0 ? val : null);
    setEditing(null);
    setDraft("");
  }

  function submitAdd() {
    const val = parseFloat(addLimit);
    if (addCategory && Number.isFinite(val) && val > 0) {
      onSetBudget(addCategory, val);
    }
    setAdding(false);
    setAddCategory("");
    setAddLimit("");
  }

  return (
    <div className="nb-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h2 className="text-base font-extrabold text-[var(--foreground)]">Monthly Budgets</h2>
          <span className="text-xs font-bold text-[var(--nb-muted)]">{monthLabel}</span>
        </div>
        {totalBudget > 0 && (
          <span className="text-xs font-bold text-[var(--nb-muted)]">
            {formatCurrency(totalSpentBudgeted, currency)} of {formatCurrency(totalBudget, currency)} used
          </span>
        )}
      </div>

      {rows.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="max-w-xs text-sm font-semibold text-[var(--nb-muted)]">
            Set a monthly limit for a category and track how much you have left as you spend.
          </p>
          {unbudgeted.length > 0 && (
            <button onClick={() => setAdding(true)} className="nb-btn nb-btn-primary px-4 py-2 text-sm">
              <Plus className="h-4 w-4" />
              Set your first budget
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ category, spent, limit, ratio }) => {
            const isEditing = editing === category;
            const pct = Math.min(100, ratio * 100);
            const remaining = limit != null ? limit - spent : 0;
            return (
              <div key={category}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--hairline)]"
                      style={{ backgroundColor: categoryColor(category) }}
                    />
                    <span className="truncate text-sm font-bold text-[var(--foreground)]">{category}</span>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        autoFocus
                        value={draft}
                        min={0}
                        step={10}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(category);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        placeholder="Limit"
                        className="nb-input h-8 w-24 py-1 text-sm tabular-nums"
                      />
                      <button onClick={() => saveEdit(category)} className="nb-icon-btn h-8 w-8" aria-label="Save budget">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditing(null)} className="nb-icon-btn h-8 w-8" aria-label="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(category, limit)}
                      className="group flex items-center gap-1.5 text-sm font-bold tabular-nums text-[var(--foreground)]"
                      title="Edit budget"
                    >
                      <span>
                        {formatCurrency(spent, currency)}
                        {limit != null && (
                          <span className="font-semibold text-[var(--nb-muted)]"> / {formatCurrency(limit, currency)}</span>
                        )}
                      </span>
                      <Pencil className="h-3.5 w-3.5 text-[var(--nb-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  )}
                </div>

                {limit != null ? (
                  <>
                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-[var(--hairline)] bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: barColor(ratio) }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--nb-muted)]">
                      {remaining >= 0
                        ? `${formatCurrency(remaining, currency)} left`
                        : `${formatCurrency(-remaining, currency)} over budget`}
                    </p>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(category, null)}
                    className="text-xs font-bold text-[var(--nb-primary)] hover:underline"
                  >
                    + Set a budget
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add-budget control */}
      {unbudgeted.length > 0 &&
        (adding ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] pt-4">
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="nb-input h-9 flex-1 py-1 text-sm"
            >
              <option value="">Choose category…</option>
              {unbudgeted.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={addLimit}
              min={0}
              step={10}
              onChange={(e) => setAddLimit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              placeholder="Monthly limit"
              className="nb-input h-9 w-32 py-1 text-sm tabular-nums"
            />
            <button onClick={submitAdd} className="nb-btn nb-btn-primary h-9 px-3 text-sm">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="nb-btn h-9 px-3 text-sm">
              Cancel
            </button>
          </div>
        ) : (
          rows.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="mt-4 flex items-center gap-1.5 text-sm font-bold text-[var(--nb-primary)] hover:underline"
            >
              <Plus className="h-4 w-4" />
              Add another budget
            </button>
          )
        ))}
    </div>
  );
}
