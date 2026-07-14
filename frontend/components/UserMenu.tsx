"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function UserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-sm font-bold text-white shadow-[0_6px_18px_-6px_var(--ring)] transition-transform hover:-translate-y-0.5"
      >
        {initial}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="nb-card absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden p-0"
          >
            <div className="border-b border-[var(--hairline)] px-4 py-3">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Signed in as
              </p>
              <p className="truncate text-sm font-bold text-[var(--foreground)]">{user?.username}</p>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <SettingsIcon className="h-4 w-4 text-[var(--muted)]" />
                Settings
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[var(--neg)] transition-colors hover:bg-[var(--neg)]/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
