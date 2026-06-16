"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import type { ClusterSummary } from "@/types";
import { formatCurrency } from "@/lib/formatCurrency";
import { categoryColor } from "@/lib/categoryColors";
import { useSettings } from "@/context/SettingsContext";

interface ClusterChartProps {
  data: ClusterSummary[];
  activeCategory: string | null;
  onSelect: (name: string | null) => void;
}

export default function ClusterChart({ data, activeCategory, onSelect }: ClusterChartProps) {
  const { currency } = useSettings();
  const total = data.reduce((sum, d) => sum + d.total, 0);

  // Per-slice fill lives in the data (recharts 3 deprecates <Cell>); dimmed
  // slices get an alpha suffix so the active filter stands out.
  const chartData = data.map((d) => {
    const base = categoryColor(d.cluster_name);
    const dimmed = activeCategory && activeCategory !== d.cluster_name;
    return {
      name: d.cluster_name,
      value: d.total,
      count: d.count,
      fill: dimmed ? `${base}59` : base,
    };
  });

  return (
    <div className="nb-card flex h-full flex-col p-5">
      <div className="mb-2 flex items-center gap-2">
        <PieIcon className="h-5 w-5" />
        <h2 className="text-base font-extrabold text-[var(--foreground)]">Spending by Category</h2>
      </div>

      {chartData.length === 0 ? (
        <p className="flex h-[260px] items-center justify-center text-sm font-semibold text-[var(--nb-muted)]">
          No transactions yet
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
                  stroke="#0a0a0a"
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
                    return (
                      <div className="nb-card px-3 py-2 text-sm">
                        <p className="font-extrabold text-[var(--foreground)]">{name}</p>
                        <p className="font-semibold text-[var(--nb-muted)]">
                          {formatCurrency(value, currency)}
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
                Total
              </span>
              <span className="text-xl font-extrabold tabular-nums text-[var(--foreground)]">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>

          {/* Clickable legend */}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.map((d) => {
              const isActive = activeCategory === d.cluster_name;
              const dimmed = activeCategory && !isActive;
              return (
                <button
                  key={d.cluster_name}
                  onClick={() => onSelect(isActive ? null : d.cluster_name)}
                  className={`nb-badge transition-opacity ${dimmed ? "opacity-40" : ""}`}
                  style={{ backgroundColor: categoryColor(d.cluster_name) }}
                  title={`${formatCurrency(d.total, currency)} · ${d.count} txns`}
                >
                  {d.cluster_name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
