"use client";

import { Plus, Sparkles } from "lucide-react";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="nb-card flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[14px] border-[3px] border-[var(--nb-ink)] bg-[#bef264] text-black shadow-[3px_3px_0_0_var(--nb-ink)]">
        <Sparkles className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-xl font-extrabold text-[var(--foreground)]">No transactions yet</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm font-semibold text-[var(--nb-muted)]">
          Add your first transaction and the ML engine will start grouping your spending into
          categories automatically.
        </p>
      </div>
      <button onClick={onAdd} className="nb-btn nb-btn-primary px-5 py-2.5 text-sm">
        <Plus className="h-4 w-4" />
        Add Transaction
      </button>
    </div>
  );
}
