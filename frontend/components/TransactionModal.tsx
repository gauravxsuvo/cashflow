"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { Transaction } from "@/types";
import DatePicker from "@/components/DatePicker";
import CategorySelect from "@/components/CategorySelect";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TransactionModalProps {
  transaction?: Transaction; // undefined = add mode, populated = edit mode
  availableCategories: string[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ModalForm {
  date: string;
  vendor: string;
  amount: string; // kept as string so the field can be cleared while typing
  manual_category: string | null;
}

const EMPTY_FORM: ModalForm = { date: "", vendor: "", amount: "", manual_category: null };

export default function TransactionModal({
  transaction,
  availableCategories,
  onClose,
  onSuccess,
}: TransactionModalProps) {
  const isEdit = !!transaction;

  const [form, setForm] = useState<ModalForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vendorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit && transaction) {
      setForm({
        date: transaction.date ?? "",
        vendor: transaction.vendor ?? "",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        manual_category: transaction.manual_category ?? null,
      });
    } else {
      setForm(EMPTY_FORM);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!Number.isFinite(amountNum)) {
      setError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const url =
        isEdit && transaction
          ? `${BASE_URL}/api/transactions/${transaction.transaction_id}`
          : `${BASE_URL}/api/transactions`;

      // For PUT: always include manual_category so the backend knows whether to
      // keep, change, or clear (null) the override.
      const body = isEdit
        ? {
            date: form.date,
            vendor: form.vendor,
            amount: amountNum,
            manual_category: form.manual_category,
          }
        : {
            date: form.date,
            vendor: form.vendor,
            amount: amountNum,
            ...(form.manual_category !== null && { manual_category: form.manual_category }),
          };

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const msg =
          typeof detail?.detail === "string"
            ? detail.detail
            : Array.isArray(detail?.detail)
              ? detail.detail[0]?.msg ?? `Request failed: ${res.status}`
              : `Request failed: ${res.status}`;
        throw new Error(msg);
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
          <div>
            <label className={labelClass}>Date</label>
            <DatePicker value={form.date} onChange={(iso) => setForm((p) => ({ ...p, date: iso }))} required />
          </div>

          <div>
            <label className={labelClass} htmlFor="vendor">
              Vendor
            </label>
            <input
              ref={vendorRef}
              id="vendor"
              type="text"
              name="vendor"
              value={form.vendor}
              onChange={handleTextChange}
              required
              placeholder="e.g. Starbucks, Amazon"
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
              options={availableCategories}
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
