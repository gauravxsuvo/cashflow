"use client";

import { Landmark } from "lucide-react";
import type { AccountSummary } from "@/lib/transactions";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";

const ACCENTS: Record<string, string> = {
  Cash: "#1f8a4c",
  Checking: "#144eb8",
  Savings: "#159aa8",
  "Credit Card": "#e63329",
  Investments: "#e8792b",
  Unassigned: "#6e6555",
};

function accentFor(name: string): string {
  if (ACCENTS[name]) return ACCENTS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = ["#144eb8", "#e63329", "#f6c019", "#1f8a4c", "#e8792b", "#7a3fb0"];
  return hues[h % hues.length];
}

export default function AccountsPanel({ accounts }: { accounts: AccountSummary[] }) {
  const { currency } = useSettings();

  return (
    <div className="nb-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-[var(--muted)]" />
        <h2 className="text-base font-black uppercase tracking-tight text-[var(--foreground)]">Accounts</h2>
        <span className="text-xs font-medium text-[var(--muted)]">net by wallet</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {accounts.map((a) => {
          const accent = accentFor(a.account);
          const positive = a.net >= 0;
          return (
            <div
              key={a.account}
              className="relative overflow-hidden rounded-[4px] border-2 border-[var(--border)] bg-[var(--surface-2)] p-3.5"
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: accent }}
                aria-hidden
              />
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--border)]" style={{ background: accent }} />
                <p className="truncate text-xs font-bold text-[var(--foreground)]">{a.account}</p>
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
