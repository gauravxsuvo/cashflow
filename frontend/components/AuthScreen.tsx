"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, User, Wallet, BarChart3, Target, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

type Mode = "login" | "register";

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;

const STRENGTH = [
  { label: "Too weak", color: "#e5484d" },
  { label: "Weak", color: "#f59e0b" },
  { label: "Fair", color: "#eab308" },
  { label: "Good", color: "#22c55e" },
  { label: "Strong", color: "#10b981" },
];

/** 0–4 heuristic mirroring the backend policy (length + letter + number + variety). */
function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-zA-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (pw.length >= 12 || new Set(pw).size >= 8) s++;
  return s;
}

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";
  const score = passwordScore(password);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirm("");
  }

  function validate(): string | null {
    if (!USERNAME_RE.test(username.trim())) {
      return "Username must be 3–30 characters (letters, numbers, . _ - ).";
    }
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (isRegister) {
      if (!/[a-zA-Z]/.test(password)) return "Password must include at least one letter.";
      if (!/[0-9]/.test(password)) return "Password must include at least one number.";
      if (new Set(password).size < 4) return "Password is too repetitive — mix in more characters.";
      if (password !== confirm) return "Passwords don't match.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) await register(username.trim(), password);
      else await login(username.trim(), password);
      // On success the auth state flips and this screen unmounts.
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error && err.name === "AbortError")
        setError("The server took too long to respond. It may be waking up — try again.");
      else setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2">
        {/* Brand / marketing side */}
        <div className="hidden flex-col gap-8 px-4 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] shadow-[0_10px_30px_-8px_var(--ring)]">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Cashflow</span>
          </div>

          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-[var(--foreground)]">
              Every dollar,
              <br />
              beautifully clear.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">
              A private ledger for your income, expenses and budgets. Organise every transaction with
              your own categories and accounts, and see exactly where your money goes.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {[
              { icon: Sparkles, text: "Your own categories, colours and accounts" },
              { icon: BarChart3, text: "Net balance, savings rate & trends at a glance" },
              { icon: Target, text: "Monthly budgets that keep you on track" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="nb-card mx-auto w-full max-w-md p-6 sm:p-8"
        >
          {/* Mobile brand */}
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] shadow-[0_8px_24px_-8px_var(--ring)]">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">Cashflow</span>
          </div>

          {/* Mode switch */}
          <div className="nb-card-flat mb-6 grid grid-cols-2 gap-1 p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`relative rounded-[10px] py-2 text-sm font-semibold transition-colors ${
                  mode === m ? "text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="authTab"
                    className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{m === "login" ? "Sign in" : "Create account"}</span>
              </button>
            ))}
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isRegister
              ? "Start tracking your money in seconds. Your data stays yours."
              : "Sign in to pick up where you left off."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_name"
                  className="nb-input pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? "At least 8 characters" : "••••••••"}
                  className="nb-input px-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {isRegister && password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{
                          background: i < score ? STRENGTH[score].color : "var(--hairline)",
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs font-medium" style={{ color: STRENGTH[score].color }}>
                    {STRENGTH[score].label}
                    <span className="text-[var(--muted)]"> · 8+ chars with letters &amp; numbers</span>
                  </p>
                </div>
              )}
            </div>

            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <label htmlFor="confirm" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      id="confirm"
                      name="confirm"
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      className="nb-input pl-9"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[11px] border border-[var(--neg)]/40 bg-[var(--neg)]/10 px-3.5 py-2.5 text-xs font-semibold text-[var(--neg)]"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="nb-btn nb-btn-primary w-full py-3 text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRegister ? "Creating account…" : "Signing in…"}
                </>
              ) : isRegister ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--muted)]">
            {isRegister ? "Already have an account? " : "New to Cashflow? "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "login" : "register")}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
