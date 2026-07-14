"use client";

import { Plus, Wallet } from "lucide-react";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="nb-card flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-[0_14px_36px_-10px_var(--ring)]">
        <Wallet className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Start tracking your money</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm font-medium text-[var(--muted)]">
          Add an income or expense, tag it with a category and account, and Cashflow tracks your net
          balance, spending and budgets — all in one place.
        </p>
      </div>
      <button onClick={onAdd} className="nb-btn nb-btn-primary px-5 py-2.5 text-sm">
        <Plus className="h-4 w-4" />
        Add your first transaction
      </button>
    </div>
  );
}
