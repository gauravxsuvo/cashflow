"use client";

import { Plus } from "lucide-react";
import Logo from "@/components/Logo";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="nb-card flex flex-col items-center justify-center gap-5 px-6 py-16 text-center text-[var(--foreground)]">
      <Logo size={64} />
      <div>
        <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--foreground)]">Start tracking your money</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm font-medium text-[var(--muted)]">
          Add an income or expense, tag it with a category and account, and Cashflow tracks your net
          balance, spending and budgets — all in one place.
        </p>
      </div>
      <button onClick={onAdd} className="nb-btn nb-btn-primary px-5 py-2.5 text-sm uppercase tracking-wide">
        <Plus className="h-4 w-4" />
        Add your first transaction
      </button>
    </div>
  );
}
