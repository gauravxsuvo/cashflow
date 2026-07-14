"use client";

import { Landmark } from "lucide-react";
import type { AccountSummary } from "@/lib/transactions";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";

const ACCENTS: Record<string, string> = {
  Cash: "#34d399",
  Checking: "#6a5cff",
  Savings: "#22d3ee",
  "Credit Card": "#fb7185",
  Investments: "#f59e0b",
  Unassigned: "#94a3b8",
};

function accentFor(name: string): string {
  if (ACCENTS[name]) return ACCENTS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = ["#6a5cff", "#22d3ee", "#34d399", "#fb7185", "#f59e0b", "#a78bfa"];
  return hues[h % hues.length];
}

export default function AccountsPanel({ accounts }: { accounts: AccountSummary[] }) {
  const { currency } = useSettings();

  return (
    <div className="nb-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-[var(--muted)]" />
        <h2 className="text-base font-bold tracking-tight text-[var(--foreground)]">Accounts</h2>
        <span className="text-xs font-medium text-[var(--muted)]">net by wallet</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {accounts.map((a) => {
          const accent = accentFor(a.account);
          const positive = a.net >= 0;
          return (
            <div
              key={a.account}
              className="relative overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-2)] p-3.5"
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: accent }}
                aria-hidden
              />
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">{a.account}</p>
              </div>
              <p
                className={`mt-1.5 truncate text-lg font-bold tabular-nums ${
                  positive ? "text-[var(--foreground)]" : "text-[var(--neg)]"
                }`}
              >
                {a.net < 0 ? "−" : ""}
                {formatCurrency(Math.abs(a.net), currency)}
              </p>
              <p className="mt-0.5 truncate text-[0.68rem] font-medium text-[var(--muted)]">
                {a.count} {a.count === 1 ? "entry" : "entries"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
