"use client";

import { PERIOD_OPTIONS, type PeriodId } from "@/lib/period";

interface PeriodFilterProps {
  value: PeriodId;
  onChange: (id: PeriodId) => void;
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="nb-card-flat inline-flex items-center gap-1 overflow-x-auto p-1">
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`whitespace-nowrap rounded-[7px] px-3 py-1.5 text-xs font-bold transition-colors ${
              active
                ? "bg-[var(--nb-primary)] text-white"
                : "text-[var(--nb-muted)] hover:bg-[var(--nb-surface-2)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
