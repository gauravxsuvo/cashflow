"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLES: Record<ToastKind, { bar: string; icon: React.ReactNode }> = {
  success: {
    bar: "#1f8a4c",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  error: {
    bar: "#e63329",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  info: {
    bar: "#144eb8",
    icon: <Info className="h-5 w-5" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => remove(id), 4200);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="nb-card pointer-events-auto flex items-center gap-3 overflow-hidden p-0"
            >
              <span
                className="flex h-full min-h-[3.25rem] w-1.5 shrink-0 self-stretch"
                style={{ backgroundColor: KIND_STYLES[t.kind].bar }}
              />
              <span style={{ color: KIND_STYLES[t.kind].bar }}>
                {KIND_STYLES[t.kind].icon}
              </span>
              <p className="flex-1 py-3 pr-1 text-sm font-semibold text-[var(--foreground)]">
                {t.message}
              </p>
              <button
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                className="mr-3 rounded-md p-1 text-[var(--nb-muted)] transition-colors hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
