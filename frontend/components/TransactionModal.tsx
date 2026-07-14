"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import type { Transaction, TransactionType } from "@/types";
import { api } from "@/lib/api";
import { categoriesForType } from "@/lib/categories";
import DatePicker from "@/components/DatePicker";
import CategorySelect from "@/components/CategorySelect";

interface TransactionModalProps {
  transaction?: Transaction; // undefined = add mode, populated = edit mode
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ModalForm {
  date: string;
  vendor: string;
  amount: string; // kept as string so the field can be cleared while typing
  type: TransactionType;
  manual_category: string | null;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TransactionModal({ transaction, onClose, onSuccess }: TransactionModalProps) {
  const isEdit = !!transaction;

  const [form, setForm] = useState<ModalForm>(() => ({
    date: todayIso(),
    vendor: "",
    amount: "",
    type: "expense",
    manual_category: null,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vendorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit && transaction) {
      setForm({
        date: transaction.date ?? todayIso(),
        vendor: transaction.vendor ?? "",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        type: transaction.type,
        manual_category: transaction.manual_category ?? null,
      });
    } else {
      setForm({ date: todayIso(), vendor: "", amount: "", type: "expense", manual_category: null });
    }
    setError(null);
  }, [transaction, isEdit]);

  // Esc closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setType(type: TransactionType) {
    setForm((prev) => {
      // Drop the manual category if it isn't valid for the new type.
      const valid = categoriesForType(type).includes(prev.manual_category ?? "");
      return { ...prev, type, manual_category: valid ? prev.manual_category : null };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setError("Please enter a valid, non-negative amount.");
      return;
    }
    if (!form.date) {
      setError("Please choose a date.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && transaction) {
        await api.updateTransaction(transaction.transaction_id, {
          date: form.date,
          vendor: form.vendor,
          amount: amountNum,
          type: form.type,
          manual_category: form.manual_category, // null clears the override
        });
      } else {
        await api.createTransaction({
          date: form.date,
          vendor: form.vendor,
          amount: amountNum,
          type: form.type,
          ...(form.manual_category !== null && { manual_category: form.manual_category }),
        });
      }
      onSuccess(isEdit ? "Transaction updated" : "Transaction added");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--nb-muted)]";
  const isIncome = form.type === "income";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="nb-card w-full max-w-md p-0"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between border-b-[3px] border-[var(--nb-ink)] px-6 py-4">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">
            {isEdit ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="nb-icon-btn h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`nb-btn py-2.5 text-sm ${!isIncome ? "nb-btn-danger" : ""}`}
            >
              <ArrowDownRight className="h-4 w-4" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`nb-btn py-2.5 text-sm ${isIncome ? "!bg-emerald-500 !text-white" : ""}`}
            >
              <ArrowUpRight className="h-4 w-4" />
              Income
            </button>
          </div>

          <div>
            <label className={labelClass}>Date</label>
            <DatePicker value={form.date} onChange={(iso) => setForm((p) => ({ ...p, date: iso }))} required />
          </div>

          <div>
            <label className={labelClass} htmlFor="vendor">
              {isIncome ? "Source" : "Description"}
            </label>
            <input
              ref={vendorRef}
              id="vendor"
              type="text"
              name="vendor"
              value={form.vendor}
              onChange={handleTextChange}
              required
              placeholder={isIncome ? "e.g. Payroll, Client invoice" : "e.g. Starbucks, Rent"}
              className="nb-input"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleTextChange}
              required
              min={0}
              max={1_000_000_000_000}
              step={0.01}
              inputMode="decimal"
              placeholder="0.00"
              className="nb-input tabular-nums"
            />
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <CategorySelect
              value={form.manual_category}
              options={categoriesForType(form.type)}
              onChange={(cat) => setForm((p) => ({ ...p, manual_category: cat }))}
            />
          </div>

          {error && (
            <p className="rounded-md border-2 border-red-500 bg-red-100 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="nb-btn px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="nb-btn nb-btn-primary px-4 py-2 text-sm">
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Transaction"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
