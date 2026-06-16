"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { Transaction } from "@/types";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";

interface SpendingTrendChartProps {
  transactions: Transaction[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function SpendingTrendChart({ transactions }: SpendingTrendChartProps) {
  const { currency } = useSettings();

  // Aggregate spend per calendar month (dates are stored ISO YYYY-MM-DD).
  const data = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.date) continue;
      const key = tx.date.slice(0, 7); // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (tx.amount ?? 0));
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, total]) => {
        const [, m] = key.split("-");
        return { month: MONTHS[Number(m) - 1] ?? key, total: Number(total.toFixed(2)) };
      });
  }, [transactions]);

  return (
    <div className="nb-card flex h-full flex-col p-5">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        <h2 className="text-base font-extrabold text-[var(--foreground)]">Spending Over Time</h2>
      </div>

      {data.length === 0 ? (
        <p className="flex h-[260px] items-center justify-center text-sm font-semibold text-[var(--nb-muted)]">
          No dated transactions yet
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--nb-muted)" opacity={0.25} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fontWeight: 700, fill: "var(--nb-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--nb-ink)", strokeWidth: 2 }}
            />
            <YAxis
              tick={{ fontSize: 11, fontWeight: 600, fill: "var(--nb-muted)" }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            />
            <Tooltip
              cursor={{ fill: "var(--nb-muted)", opacity: 0.12 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const value = Number(payload[0].value ?? 0);
                return (
                  <div className="nb-card px-3 py-2 text-sm">
                    <p className="font-extrabold text-[var(--foreground)]">{label}</p>
                    <p className="font-semibold text-[var(--nb-muted)]">
                      {formatCurrency(value, currency)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="total" fill="#7c3aed" stroke="#0a0a0a" strokeWidth={2.5} radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
