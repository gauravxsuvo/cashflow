"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import type { TransactionType } from "@/types";
import { useCategories } from "@/context/CategoriesContext";
import { usePopover } from "@/hooks/usePopover";

interface CategorySelectProps {
  value: string;
  options: string[];
  kind: TransactionType;
  onChange: (value: string) => void;
}

const SWATCHES = [
  "#fca5a5", "#fdba74", "#fcd34d", "#bef264", "#86efac",
  "#5eead4", "#67e8f9", "#93c5fd", "#a5b4fc", "#c4b5fd",
  "#d8b4fe", "#f9a8d4",
];

export default function CategorySelect({ value, options, kind, onChange }: CategorySelectProps) {
  const { colorFor, create } = useCategories();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[8]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { placement, measure } = usePopover();

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

  function select(cat: string) {
    onChange(cat);
    setOpen(false);
  }

  function resetCreate() {
    setCreating(false);
    setNewName("");
    setError(null);
  }

  async function submitCreate() {
    const name = newName.trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cat = await create(name, kind, newColor);
      onChange(cat.name);
      resetCreate();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create category.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) measure(triggerRef.current, 320);
          setOpen((o) => !o);
        }}
        className="nb-input flex items-center justify-between text-left"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--foreground)]">
          <span
            className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--glass-ring)]"
            style={{ backgroundColor: colorFor(value) }}
          />
          <span className="truncate">{value || "Uncategorized"}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`nb-card absolute left-0 z-50 w-full overflow-hidden p-0 ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">No categories yet.</li>
            )}
            {options.map((cat) => (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => select(cat)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] ${
                    value === cat ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--glass-ring)]"
                    style={{ backgroundColor: colorFor(cat) }}
                  />
                  <span className="flex-1 truncate text-left">{cat}</span>
                  {value === cat && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--hairline)] p-2">
            {creating ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCreate();
                    }
                  }}
                  maxLength={30}
                  placeholder="New category name"
                  className="nb-input h-9 text-sm"
                />
                <div className="flex flex-wrap gap-1.5">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                        newColor === c ? "ring-2 ring-[var(--foreground)] ring-offset-1 ring-offset-transparent" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                </div>
                {error && <p className="text-xs font-semibold text-[var(--neg)]">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={resetCreate} className="nb-btn h-8 px-3 text-xs">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitCreate}
                    disabled={busy}
                    className="nb-btn nb-btn-primary h-8 px-3 text-xs"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create new category
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
