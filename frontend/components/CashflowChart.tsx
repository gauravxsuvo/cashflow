"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { Transaction } from "@/types";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSettings } from "@/context/SettingsContext";

interface CashflowChartProps {
  transactions: Transaction[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const INCOME_FILL = "#22c55e";
const EXPENSE_FILL = "#7c3aed";

export default function CashflowChart({ transactions }: CashflowChartProps) {
  const { currency } = useSettings();

  // Aggregate income vs expense per calendar month (dates stored ISO YYYY-MM-DD).
  const data = useMemo(() => {
    const byMonth = new Map<string, { income: number; expense: number }>();
    for (const tx of transactions) {
      if (!tx.date) continue;
      const key = tx.date.slice(0, 7); // YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      const bucket = byMonth.get(key) ?? { income: 0, expense: 0 };
      if (tx.type === "income") bucket.income += tx.amount ?? 0;
      else bucket.expense += tx.amount ?? 0;
      byMonth.set(key, bucket);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, v]) => {
        const [, m] = key.split("-");
        return {
          month: MONTHS[Number(m) - 1] ?? key,
          income: Number(v.income.toFixed(2)),
          expense: Number(v.expense.toFixed(2)),
        };
      });
  }, [transactions]);

  return (
    <div className="nb-card flex h-full flex-col p-5">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        <h2 className="text-base font-extrabold text-[var(--foreground)]">Income vs. Expenses</h2>
      </div>

      {data.length === 0 ? (
        <p className="flex h-[260px] items-center justify-center text-sm font-semibold text-[var(--nb-muted)]">
          No dated transactions yet
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 6, left: -10, bottom: 0 }} barGap={2}>
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
                const income = Number(payload.find((p) => p.dataKey === "income")?.value ?? 0);
                const expense = Number(payload.find((p) => p.dataKey === "expense")?.value ?? 0);
                return (
                  <div className="nb-card px-3 py-2 text-sm">
                    <p className="font-extrabold text-[var(--foreground)]">{label}</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      + {formatCurrency(income, currency)}
                    </p>
                    <p className="font-semibold text-[var(--nb-primary)]">
                      − {formatCurrency(expense, currency)}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 4 }}
              formatter={(value) => (
                <span className="text-[var(--nb-muted)]">{value === "income" ? "Income" : "Expenses"}</span>
              )}
            />
            <Bar dataKey="income" fill={INCOME_FILL} stroke="#0a0a0a" strokeWidth={2} radius={[5, 5, 0, 0]} maxBarSize={34} />
            <Bar dataKey="expense" fill={EXPENSE_FILL} stroke="#0a0a0a" strokeWidth={2} radius={[5, 5, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
