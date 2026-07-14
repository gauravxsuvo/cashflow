"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Esc cancels, Enter confirms.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <motion.div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        className="nb-card w-full max-w-sm p-0"
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <div className="flex items-start gap-3 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--neg)]/15 text-[var(--neg)]">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-[var(--foreground)]">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--hairline)] bg-[var(--surface-2)] p-3">
          <button onClick={onCancel} className="nb-btn px-4 py-2 text-sm">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="nb-btn nb-btn-danger px-4 py-2 text-sm" autoFocus>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
