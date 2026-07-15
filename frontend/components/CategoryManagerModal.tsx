"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import type { TransactionType } from "@/types";
import { useCategories } from "@/context/CategoriesContext";
import { useToast } from "@/components/Toast";

const SWATCHES = [
  "#e63329", "#e8792b", "#f6c019", "#1f8a4c", "#159aa8",
  "#144eb8", "#3b5bdb", "#7a3fb0", "#d6336c", "#0ca678",
  "#e6a817", "#495057", "#111111",
];

const UNCATEGORIZED = "Uncategorized";

interface CategoryManagerModalProps {
  onClose: () => void;
  /** Called after a change that cascades to transactions/budgets (rename/delete). */
  onMutated?: () => void;
}

export default function CategoryManagerModal({ onClose, onMutated }: CategoryManagerModalProps) {
  const { categories, colorFor, create, update, remove } = useCategories();
  const { toast } = useToast();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [recoloring, setRecoloring] = useState<string | null>(null);

  const [addKind, setAddKind] = useState<TransactionType>("expense");
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState(SWATCHES[7]);
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const expense = categories.filter((c) => c.kind === "expense");
  const income = categories.filter((c) => c.kind === "income");

  async function submitRename(name: string) {
    const next = renameDraft.trim();
    if (!next || next === name) {
      setRenaming(null);
      return;
    }
    try {
      await update(name, { new_name: next });
      toast("Category renamed", "success");
      onMutated?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not rename", "error");
    } finally {
      setRenaming(null);
    }
  }

  async function submitRecolor(name: string, color: string) {
    setRecoloring(null);
    try {
      await update(name, { color });
    } catch {
      toast("Could not update colour", "error");
    }
  }

  async function submitDelete(name: string) {
    try {
      await remove(name);
      toast("Category deleted — its transactions are now Uncategorized", "success");
      onMutated?.();
    } catch {
      toast("Could not delete category", "error");
    }
  }

  async function submitAdd() {
    const name = addName.trim();
    if (!name) return;
    setAddBusy(true);
    try {
      await create(name, addKind, addColor);
      toast("Category added", "success");
      setAddName("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add category", "error");
    } finally {
      setAddBusy(false);
    }
  }

  function CategoryRow({ name }: { name: string }) {
    const isUncat = name === UNCATEGORIZED;
    const color = colorFor(name);
    return (
      <div className="flex items-center gap-2 rounded-[3px] border-2 border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <button
          type="button"
          onClick={() => setRecoloring(recoloring === name ? null : name)}
          className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--border)] transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
          aria-label={`Recolour ${name}`}
        />
        {renaming === name ? (
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename(name);
              if (e.key === "Escape") setRenaming(null);
            }}
            onBlur={() => submitRename(name)}
            maxLength={30}
            className="nb-input h-7 flex-1 py-0.5 text-sm"
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium text-[var(--foreground)]">{name}</span>
        )}

        {!isUncat && renaming !== name && (
          <button
            type="button"
            onClick={() => {
              setRenaming(name);
              setRenameDraft(name);
            }}
            className="rounded-md p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            aria-label={`Rename ${name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {!isUncat && (
          <button
            type="button"
            onClick={() => submitDelete(name)}
            className="rounded-md p-1 text-[var(--muted)] transition-colors hover:text-[var(--neg)]"
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  function RecolorPalette({ name }: { name: string }) {
    if (recoloring !== name) return null;
    return (
      <div className="flex flex-wrap gap-1.5 rounded-[3px] border-2 border-[var(--border)] bg-[var(--surface-2)] p-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => submitRecolor(name, c)}
            className="h-6 w-6 rounded-full transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
            aria-label={`Set ${name} to ${c}`}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="nb-card my-auto w-full max-w-2xl p-0"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2px] border-b-2 border-[var(--border)] bg-[var(--card)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Categories</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="nb-icon-btn h-9 w-9">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Add new */}
          <div className="nb-card-flat p-4">
            <p className="mb-3 text-sm font-bold text-[var(--foreground)]">Add a category</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="nb-card-flat inline-flex items-center gap-0.5 p-0.5">
                {(["expense", "income"] as TransactionType[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setAddKind(k)}
                    className={`rounded-[2px] px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                      addKind === k
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                maxLength={30}
                placeholder="Category name"
                className="nb-input h-9 flex-1 text-sm"
              />
              <button onClick={submitAdd} disabled={addBusy || !addName.trim()} className="nb-btn nb-btn-primary h-9 px-3 text-sm">
                {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAddColor(c)}
                  className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                    addColor === c ? "ring-2 ring-[var(--foreground)] ring-offset-1 ring-offset-transparent" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Colour ${c}`}
                >
                  {addColor === c && <Check className="mx-auto h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Expense · {expense.length}</p>
              <div className="space-y-1.5">
                {expense.map((c) => (
                  <div key={c.name} className="space-y-1.5">
                    <CategoryRow name={c.name} />
                    <RecolorPalette name={c.name} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Income · {income.length}</p>
              <div className="space-y-1.5">
                {income.map((c) => (
                  <div key={c.name} className="space-y-1.5">
                    <CategoryRow name={c.name} />
                    <RecolorPalette name={c.name} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
