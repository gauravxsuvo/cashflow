"use client";

import { PERIOD_OPTIONS, type PeriodId } from "@/lib/period";

interface PeriodFilterProps {
  value: PeriodId;
  onChange: (id: PeriodId) => void;
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="nb-card-flat no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto p-1">
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`shrink-0 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-[0_6px_16px_-8px_var(--ring)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
