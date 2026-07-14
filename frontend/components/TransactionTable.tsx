"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "@/types";
import { formatCurrency } from "@/lib/formatCurrency";
import { effectiveCategory } from "@/lib/transactions";
import { useSettings } from "@/context/SettingsContext";
import { useCategories } from "@/context/CategoriesContext";

export type SortKey = "date" | "vendor" | "amount" | "category";
export type SortDir = "asc" | "desc";

interface TransactionTableProps {
  transactions: Transaction[];
  showAccounts: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
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
        className={`inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide transition-colors ${
          active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
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
    transition: { duration: 0.18, delay: Math.min(i, 20) * 0.02 },
  }),
};

export default function TransactionTable({
  transactions,
  showAccounts,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const { currency } = useSettings();
  const { colorFor } = useCategories();
  const colSpan = showAccounts ? 6 : 5;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--hairline)] bg-[var(--surface-2)]">
            <SortHeader label="Date" column="date" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Description" column="vendor" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            {showAccounts && (
              <th className="px-5 py-3 text-left text-[0.7rem] font-bold uppercase tracking-wide text-[var(--muted)]">
                Account
              </th>
            )}
            <SortHeader label="Amount" column="amount" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            <SortHeader label="Category" column="category" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-5 py-12 text-center text-sm font-medium text-[var(--muted)]">
                No transactions match your filters.
              </td>
            </tr>
          )}
          {transactions.map((tx, i) => {
            const category = effectiveCategory(tx);
            const color = colorFor(category);
            const isIncome = tx.type === "income";
            const note = tx.note?.trim();
            return (
              <motion.tr
                key={tx.transaction_id}
                custom={i}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                className="border-b border-[var(--hairline)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
              >
                <td className="whitespace-nowrap px-5 py-3 align-top font-medium text-[var(--muted)]">
                  {tx.date ?? <span className="italic">—</span>}
                </td>
                <td className="px-5 py-3 align-top">
                  <div className="font-semibold text-[var(--foreground)]">
                    {tx.vendor ?? <span className="italic text-[var(--muted)]">Unknown</span>}
                  </div>
                  {note && (
                    <div className="mt-0.5 max-w-[16rem] truncate text-xs font-normal text-[var(--muted)]" title={note}>
                      {note}
                    </div>
                  )}
                </td>
                {showAccounts && (
                  <td className="whitespace-nowrap px-5 py-3 align-top">
                    {tx.account ? (
                      <span className="nb-badge">{tx.account}</span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                )}
                <td
                  className={`whitespace-nowrap px-5 py-3 text-right align-top font-bold tabular-nums ${
                    isIncome ? "text-[var(--pos)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {tx.amount != null ? (
                    <>
                      {isIncome ? "+" : "−"}
                      {formatCurrency(tx.amount, currency)}
                    </>
                  ) : (
                    <span className="italic text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-5 py-3 align-top">
                  <span
                    className="nb-badge"
                    style={{ backgroundColor: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}66` }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    {category}
                  </span>
                </td>
                <td className="px-5 py-3 align-top">
                  <div className="flex items-center justify-end gap-1.5">
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
                      className="nb-icon-btn h-8 w-8 hover:!text-[var(--neg)]"
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
