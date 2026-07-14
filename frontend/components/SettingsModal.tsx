"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  Check,
  Loader2,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import ConfirmDialog from "@/components/ConfirmDialog";

interface SettingsModalProps {
  onClose: () => void;
  onDataCleared: () => void;
}

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="nb-card-flat p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[var(--primary)]">{icon}</span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--foreground)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function SettingsModal({ onClose, onDataCleared }: SettingsModalProps) {
  const { user, setCurrency, logout } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Change-password form
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Destructive confirmations
  const [confirmKind, setConfirmKind] = useState<null | "wipe" | "delete">(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirmPw) {
      setPwError("New passwords don't match.");
      return;
    }
    setPwSubmitting(true);
    setPwError(null);
    try {
      await api.changePassword(current, next);
      toast("Password updated", "success");
      setCurrent("");
      setNext("");
      setConfirmPw("");
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally {
      setPwSubmitting(false);
    }
  }

  async function handleWipe() {
    setConfirmKind(null);
    try {
      await api.wipeData();
      toast("All transactions and budgets cleared", "success");
      onDataCleared();
    } catch {
      toast("Could not clear your data", "error");
    }
  }

  async function handleDeleteAccount() {
    setConfirmKind(null);
    try {
      await api.deleteAccount();
      toast("Account deleted", "success");
      logout();
    } catch {
      toast("Could not delete account", "error");
    }
  }

  const activeTheme = mounted ? theme ?? "system" : "system";

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="nb-card my-auto w-full max-w-lg p-0"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[20px] border-b border-[var(--hairline)] bg-[var(--glass-fill-strong)] px-5 py-4 backdrop-blur-xl">
            <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">Settings</h2>
            <button onClick={onClose} aria-label="Close settings" className="nb-icon-btn h-9 w-9">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            {/* Appearance */}
            <SectionCard icon={<Palette className="h-4 w-4" />} title="Appearance">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const active = activeTheme === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={`flex flex-col items-center gap-1.5 rounded-[12px] border py-3 text-xs font-semibold transition-all ${
                        active
                          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "border-[var(--hairline)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <p className="mb-2 mt-4 text-xs font-medium text-[var(--muted)]">Currency</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CURRENCY_OPTIONS.map((c) => {
                  const active = (user?.currency ?? "USD") === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className={`flex items-center gap-2 rounded-[11px] border px-3 py-2 text-left text-sm font-medium transition-all ${
                        active
                          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--foreground)]"
                          : "border-[var(--hairline)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <span className="w-5 text-center text-base leading-none">{c.symbol}</span>
                      <span className="flex-1 truncate">{c.code}</span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Security */}
            <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Change password">
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="Current password"
                  className="nb-input text-sm"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="New password"
                    className="nb-input text-sm"
                    required
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirm new"
                    className="nb-input text-sm"
                    required
                  />
                </div>
                {pwError && (
                  <p className="text-xs font-semibold text-[var(--neg)]">{pwError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={pwSubmitting || !current || !next}
                    className="nb-btn nb-btn-primary px-4 py-2 text-sm"
                  >
                    {pwSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
                  </button>
                </div>
              </form>
            </SectionCard>

            {/* Danger zone */}
            <SectionCard icon={<AlertTriangle className="h-4 w-4" />} title="Danger zone">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--hairline)] p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Clear all data</p>
                    <p className="text-xs text-[var(--muted)]">Delete every transaction and budget. Keeps your account.</p>
                  </div>
                  <button onClick={() => setConfirmKind("wipe")} className="nb-btn px-3 py-2 text-xs">
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear data
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--neg)]/30 bg-[var(--neg)]/5 p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--neg)]">Delete account</p>
                    <p className="text-xs text-[var(--muted)]">Permanently remove your account and all data.</p>
                  </div>
                  <button onClick={() => setConfirmKind("delete")} className="nb-btn nb-btn-danger px-3 py-2 text-xs">
                    Delete
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        </motion.div>
      </motion.div>

      {confirmKind === "wipe" && (
        <ConfirmDialog
          title="Clear all data?"
          message="This permanently deletes every transaction and budget in your account. This cannot be undone."
          confirmLabel="Clear everything"
          onConfirm={handleWipe}
          onCancel={() => setConfirmKind(null)}
        />
      )}
      {confirmKind === "delete" && (
        <ConfirmDialog
          title="Delete your account?"
          message="Your account, all transactions and budgets will be permanently deleted. This cannot be undone."
          confirmLabel="Delete account"
          onConfirm={handleDeleteAccount}
          onCancel={() => setConfirmKind(null)}
        />
      )}
    </>
  );
}
