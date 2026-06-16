"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

interface CurrencySelectProps {
  value: string;
  options: CurrencyOption[];
  onChange: (code: string) => void;
}

export default function CurrencySelect({
  value,
  options,
  onChange,
}: CurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.code === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Select currency"
        aria-expanded={open}
        className="nb-icon-btn h-10 gap-1.5 px-3 text-sm font-bold"
      >
        <span className="text-base leading-none">{selected.symbol}</span>
        <span className="hidden sm:inline">{selected.code}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="nb-card absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden p-0">
          {options.map((opt) => {
            const isActive = opt.code === value;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => choose(opt.code)}
                className={[
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-[var(--nb-primary)] text-white"
                    : "text-[var(--foreground)] hover:bg-[var(--nb-surface-2)]",
                ].join(" ")}
              >
                <span className="w-4 text-center text-base leading-none">{opt.symbol}</span>
                <span className="flex-1 text-left">{opt.label}</span>
                {isActive && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
