"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import type { Transaction, TransactionType } from "@/types";
import { api } from "@/lib/api";
import { categoriesForType } from "@/lib/categories";
import { ACCOUNT_PRESETS } from "@/lib/accounts";
import DatePicker from "@/components/DatePicker";
import CategorySelect from "@/components/CategorySelect";

interface TransactionModalProps {
  transaction?: Transaction; // undefined = add mode, populated = edit mode
  knownAccounts?: string[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ModalForm {
  date: string;
  vendor: string;
  amount: string; // kept as string so the field can be cleared while typing
  type: TransactionType;
  manual_category: string | null;
  account: string;
  note: string;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = (): ModalForm => ({
  date: todayIso(),
  vendor: "",
  amount: "",
  type: "expense",
  manual_category: null,
  account: "",
  note: "",
});

export default function TransactionModal({ transaction, knownAccounts = [], onClose, onSuccess }: TransactionModalProps) {
  const isEdit = !!transaction;

  const [form, setForm] = useState<ModalForm>(emptyForm);
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
        account: transaction.account ?? "",
        note: transaction.note ?? "",
      });
    } else {
      setForm(emptyForm());
    }
    setError(null);
  }, [transaction, isEdit]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setType(type: TransactionType) {
    setForm((prev) => {
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

    const account = form.account.trim() || null;
    const note = form.note.trim() || null;

    try {
      if (isEdit && transaction) {
        await api.updateTransaction(transaction.transaction_id, {
          date: form.date,
          vendor: form.vendor,
          amount: amountNum,
          type: form.type,
          manual_category: form.manual_category, // null clears the override
          account,
          note,
        });
      } else {
        await api.createTransaction({
          date: form.date,
          vendor: form.vendor,
          amount: amountNum,
          type: form.type,
          ...(form.manual_category !== null && { manual_category: form.manual_category }),
          ...(account && { account }),
          ...(note && { note }),
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

  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]";
  const isIncome = form.type === "income";
  const accountOptions = Array.from(new Set([...ACCOUNT_PRESETS, ...knownAccounts]));

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="nb-card my-auto w-full max-w-md p-0"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
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
              className={`nb-btn py-2.5 text-sm ${
                isIncome ? "!border-transparent !bg-gradient-to-br !from-[var(--pos)] !to-emerald-600 !text-white" : ""
              }`}
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

          <div className="grid grid-cols-2 gap-3">
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
              <label className={labelClass} htmlFor="account">
                Account <span className="normal-case text-[var(--muted)]/70">(optional)</span>
              </label>
              <input
                id="account"
                type="text"
                name="account"
                list="account-options"
                value={form.account}
                onChange={handleTextChange}
                placeholder="e.g. Checking"
                className="nb-input"
              />
              <datalist id="account-options">
                {accountOptions.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <CategorySelect
              value={form.manual_category}
              options={categoriesForType(form.type)}
              onChange={(cat) => setForm((p) => ({ ...p, manual_category: cat }))}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="note">
              Note <span className="normal-case text-[var(--muted)]/70">(optional)</span>
            </label>
            <textarea
              id="note"
              name="note"
              value={form.note}
              onChange={handleTextChange}
              rows={2}
              maxLength={280}
              placeholder="Add a memo…"
              className="nb-input resize-none"
            />
          </div>

          {error && (
            <p className="rounded-[11px] border border-[var(--neg)]/40 bg-[var(--neg)]/10 px-3.5 py-2.5 text-xs font-semibold text-[var(--neg)]">
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
