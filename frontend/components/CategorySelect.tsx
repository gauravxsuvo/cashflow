"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Sparkles, X } from "lucide-react";

interface CategorySelectProps {
  value: string | null; // null = let ML decide
  options: string[]; // existing category names
  onChange: (value: string | null) => void;
}

export default function CategorySelect({ value, options, onChange }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const hasExactMatch = options.some((o) => o.toLowerCase() === search.toLowerCase());
  const canCreate = search.trim().length > 0 && !hasExactMatch;

  function select(cat: string | null) {
    onChange(cat);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="nb-input flex items-center justify-between text-left"
      >
        {value ? (
          <span className="font-semibold text-[var(--foreground)]">{value}</span>
        ) : (
          <span className="flex items-center gap-1.5 font-semibold text-[var(--nb-muted)]">
            <Sparkles className="h-3.5 w-3.5" />
            ML suggested (auto)
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="nb-card absolute left-0 top-full z-50 mt-2 w-full overflow-hidden p-0">
          <div className="border-b-[3px] border-[var(--nb-ink)] p-2">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or create…"
              className="w-full rounded-md bg-[var(--nb-surface-2)] px-2.5 py-1.5 text-sm font-medium text-[var(--foreground)] outline-none placeholder:text-[var(--nb-muted)]"
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => select(null)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--nb-surface-2)] ${
                  value === null ? "text-[var(--nb-primary)]" : "text-[var(--nb-muted)]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>ML suggested (auto)</span>
                {value === null && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            </li>

            {(filtered.length > 0 || canCreate) && (
              <li className="my-1 border-t-2 border-dashed border-[var(--nb-ink)]/20" />
            )}

            {filtered.map((cat) => (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => select(cat)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--nb-surface-2)] ${
                    value === cat ? "text-[var(--nb-primary)]" : "text-[var(--foreground)]"
                  }`}
                >
                  <span className="flex-1 text-left">{cat}</span>
                  {value === cat && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </li>
            ))}

            {canCreate && (
              <li>
                <button
                  type="button"
                  onClick={() => select(search.trim())}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-[var(--nb-primary)] transition-colors hover:bg-[var(--nb-surface-2)]"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Create <span className="font-extrabold">&ldquo;{search.trim()}&rdquo;</span>
                  </span>
                </button>
              </li>
            )}

            {filtered.length === 0 && !canCreate && (
              <li className="px-3 py-2 text-sm font-medium text-[var(--nb-muted)]">No categories found</li>
            )}
          </ul>

          {value && (
            <div className="border-t-[3px] border-[var(--nb-ink)] p-2">
              <button
                type="button"
                onClick={() => select(null)}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <X className="h-3 w-3" />
                Clear override — revert to ML
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
