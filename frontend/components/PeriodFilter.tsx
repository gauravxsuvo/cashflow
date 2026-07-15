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
            className={`shrink-0 whitespace-nowrap rounded-[2px] px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              active
                ? "bg-[var(--primary)] text-white"
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
