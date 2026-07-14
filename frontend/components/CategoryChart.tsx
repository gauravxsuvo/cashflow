"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import type { CategorySummary } from "@/types";
import { formatCurrency } from "@/lib/formatCurrency";
import { categoryColor } from "@/lib/categoryColors";
import { useSettings } from "@/context/SettingsContext";

interface CategoryChartProps {
  data: CategorySummary[];
  activeCategory: string | null;
  onSelect: (name: string | null) => void;
}

export default function CategoryChart({ data, activeCategory, onSelect }: CategoryChartProps) {
  const { currency } = useSettings();
  const total = data.reduce((sum, d) => sum + d.total, 0);

  const chartData = data.map((d) => {
    const base = categoryColor(d.category);
    const dimmed = activeCategory && activeCategory !== d.category;
    return {
      name: d.category,
      value: d.total,
      count: d.count,
      fill: dimmed ? `${base}59` : base,
    };
  });

  return (
    <div className="nb-card flex h-full flex-col p-5">
      <div className="mb-2 flex items-center gap-2">
        <PieIcon className="h-5 w-5" />
        <h2 className="text-base font-extrabold text-[var(--foreground)]">Where Your Money Goes</h2>
      </div>

      {chartData.length === 0 ? (
        <p className="flex h-[260px] items-center justify-center text-sm font-semibold text-[var(--nb-muted)]">
          No expenses in this period
        </p>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={66}
                  outerRadius={108}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--background)"
                  strokeWidth={2.5}
                  className="cursor-pointer outline-none"
                  onClick={(_, index) => {
                    const name = chartData[index]?.name;
                    if (name) onSelect(activeCategory === name ? null : name);
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    const name = String(p.name ?? "");
                    const raw = p.value;
                    const value = Array.isArray(raw) ? 0 : Number(raw ?? 0);
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                    return (
                      <div className="nb-card px-3 py-2 text-sm">
                        <p className="font-extrabold text-[var(--foreground)]">{name}</p>
                        <p className="font-semibold text-[var(--nb-muted)]">
                          {formatCurrency(value, currency)} · {pct}%
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Donut center total */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--nb-muted)]">
                Spent
              </span>
              <span className="text-xl font-extrabold tabular-nums text-[var(--foreground)]">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>

          {/* Clickable legend */}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.map((d) => {
              const isActive = activeCategory === d.category;
              const dimmed = activeCategory && !isActive;
              const color = categoryColor(d.category);
              return (
                <button
                  key={d.category}
                  onClick={() => onSelect(isActive ? null : d.category)}
                  className={`nb-badge transition-opacity ${dimmed ? "opacity-40" : ""}`}
                  style={{
                    backgroundColor: `${color}26`,
                    borderColor: isActive ? color : `${color}66`,
                  }}
                  title={`${formatCurrency(d.total, currency)} · ${d.count} txns`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  {d.category}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
