"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { categoryColor } from "@/lib/categoryColors";

interface CategorySelectProps {
  value: string | null; // null = auto-categorise
  options: string[]; // categories valid for the current type
  onChange: (value: string | null) => void;
}

export default function CategorySelect({ value, options, onChange }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  function select(cat: string | null) {
    onChange(cat);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="nb-input flex items-center justify-between text-left"
      >
        {value ? (
          <span className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--hairline)]"
              style={{ backgroundColor: categoryColor(value) }}
            />
            {value}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-semibold text-[var(--nb-muted)]">
            <Sparkles className="h-3.5 w-3.5" />
            Auto-categorise
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="nb-card absolute left-0 top-full z-50 mt-2 w-full overflow-hidden p-0">
          <ul className="max-h-60 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => select(null)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--nb-surface-2)] ${
                  value === null ? "text-[var(--nb-primary)]" : "text-[var(--nb-muted)]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>Auto-categorise</span>
                {value === null && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            </li>

            <li className="my-1 border-t border-[var(--hairline)]" />

            {options.map((cat) => (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => select(cat)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--nb-surface-2)] ${
                    value === cat ? "text-[var(--nb-primary)]" : "text-[var(--foreground)]"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--hairline)]"
                    style={{ backgroundColor: categoryColor(cat) }}
                  />
                  <span className="flex-1 text-left">{cat}</span>
                  {value === cat && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>

          {value && (
            <div className="border-t border-[var(--hairline)] p-2">
              <button
                type="button"
                onClick={() => select(null)}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <X className="h-3 w-3" />
                Clear — let Cashflow auto-categorise
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
