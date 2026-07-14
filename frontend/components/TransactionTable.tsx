"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Pin, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type { Transaction } from "@/types";
import { formatCurrency } from "@/lib/formatCurrency";
import { categoryColor } from "@/lib/categoryColors";
import { effectiveCategory } from "@/lib/transactions";
import { useSettings } from "@/context/SettingsContext";

export type SortKey = "date" | "vendor" | "amount" | "category";
export type SortDir = "asc" | "desc";

interface TransactionTableProps {
  transactions: Transaction[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onRevert: (tx: Transaction) => void;
}

function CategoryBadge({ name, isManual }: { name: string; isManual: boolean }) {
  return (
    <span
      className="nb-badge"
      style={{ backgroundColor: categoryColor(name) }}
      title={isManual ? "You set this category" : "Auto-categorised"}
    >
      {isManual ? <Pin className="h-2.5 w-2.5 shrink-0" /> : <Sparkles className="h-2.5 w-2.5 shrink-0" />}
      {name}
    </span>
  );
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-5 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-wider transition-colors ${
          active ? "text-[var(--foreground)]" : "text-[var(--nb-muted)] hover:text-[var(--foreground)]"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, delay: Math.min(i, 20) * 0.025 },
  }),
};

export default function TransactionTable({
  transactions,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onRevert,
}: TransactionTableProps) {
  const { currency } = useSettings();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-[3px] border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
            <SortHeader label="Date" column="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Description" column="vendor" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Amount" column="amount" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            <SortHeader label="Category" column="category" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-[var(--nb-muted)]">
                No transactions match your filters.
              </td>
            </tr>
          )}
          {transactions.map((tx, i) => {
            const displayCategory = effectiveCategory(tx);
            const isManual = tx.manual_category != null;
            const isIncome = tx.type === "income";
            return (
              <motion.tr
                key={tx.transaction_id}
                custom={i}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                className="border-b-2 border-dashed border-[var(--nb-ink)]/15 transition-colors last:border-0 hover:bg-[var(--nb-surface-2)]"
              >
                <td className="whitespace-nowrap px-5 py-3 font-semibold text-[var(--nb-muted)]">
                  {tx.date ?? <span className="italic">—</span>}
                </td>
                <td className="whitespace-nowrap px-5 py-3 font-bold text-[var(--foreground)]">
                  {tx.vendor ?? <span className="italic text-[var(--nb-muted)]">Unknown</span>}
                </td>
                <td
                  className={`whitespace-nowrap px-5 py-3 text-right font-extrabold tabular-nums ${
                    isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--foreground)]"
                  }`}
                >
                  {tx.amount != null ? (
                    <>
                      {isIncome ? "+" : "−"}
                      {formatCurrency(tx.amount, currency)}
                    </>
                  ) : (
                    <span className="italic text-[var(--nb-muted)]">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <CategoryBadge name={displayCategory} isManual={isManual} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {isManual && (
                      <button
                        onClick={() => onRevert(tx)}
                        className="nb-icon-btn h-8 w-8"
                        aria-label="Revert to auto category"
                        title="Revert to auto category"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(tx)}
                      className="nb-icon-btn h-8 w-8"
                      aria-label="Edit transaction"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(tx)}
                      className="nb-icon-btn h-8 w-8 hover:bg-red-400"
                      aria-label="Delete transaction"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
