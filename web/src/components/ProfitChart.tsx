"use client";

import React from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { PolicyId, ProfitGridData } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface ProfitChartProps {
  profitGrid: ProfitGridData;
  margin: number;
  cost: number;
  selectedPolicy: PolicyId;
  budgetFraction: number;
}

const POLICY_METRICS: Record<
  PolicyId,
  { label: string; color: string; strokeDasharray?: string }
> = {
  t_learner_lr: { label: "T-Learner (LR)", color: "#0f766e", strokeDasharray: "" },
  x_learner_lr: { label: "X-Learner (LR)", color: "#0284c7", strokeDasharray: "6 3" },
  s_learner_xgb: { label: "S-Learner (XGB)", color: "#d97706", strokeDasharray: "4 2 1 2" },
  response_lr: { label: "Response Model (LR)", color: "#e11d48", strokeDasharray: "2 2" },
  random: { label: "Random Targeting", color: "#64748b", strokeDasharray: "5 5" },
};

export default function ProfitChart({
  profitGrid,
  margin,
  cost,
  selectedPolicy,
  budgetFraction,
}: ProfitChartProps) {
  const { n_pop, fractions, policies, everyone } = profitGrid;

  // Selected policy variation data
  const selPolicyData = policies[selectedPolicy];

  // Build chart points for each fraction f
  const data = fractions.map((f, idx) => {
    const pt: Record<string, unknown> = {
      fraction: Math.round(f * 100),
    };

    // Calculate each policy profit
    for (const [polId, pData] of Object.entries(policies)) {
      const delta = pData.delta_spend_mean[idx];
      const prof = n_pop * f * (margin * delta - cost);
      pt[polId] = Math.round(prof);
    }

    // Selected policy variation band: [lower, upper]
    if (selPolicyData) {
      const selDelta = selPolicyData.delta_spend_mean[idx];
      const selStd = selPolicyData.delta_spend_std[idx];
      const selProf = n_pop * f * (margin * selDelta - cost);
      const selVar = n_pop * f * margin * selStd;
      pt["selected_band"] = [Math.round(selProf - selVar), Math.round(selProf + selVar)];
    }

    return pt;
  });

  // Calculate target everyone at f=1.0
  const everyoneProfit = Math.round(n_pop * 1.0 * (margin * everyone.delta_spend_mean - cost));
  const selectedLabel = POLICY_METRICS[selectedPolicy]?.label || selectedPolicy;

  return (
    <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Campaign Profit vs Budget Targeted
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scaled to 100,000 customers &bull; Shaded region indicates &plusmn;1 SD split variation for{" "}
            <strong className="text-teal-700 dark:text-teal-400 font-semibold">{selectedLabel}</strong>
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Target Everyone (100%):{" "}
          <strong className="text-amber-700 dark:text-amber-400 font-mono tabular">
            {formatCurrency(everyoneProfit, 0)}
          </strong>
        </div>
      </div>

      <div className="sr-only">
        Line chart comparing expected dollar profit across targeted budget fractions from 5% to 100%.
        Break-even line at $0 profit. Shaded band shows split-to-split uncertainty for the currently selected policy.
      </div>

      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 15, right: 15, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" className="dark:stroke-slate-800/80" />
            <XAxis
              dataKey="fraction"
              tickFormatter={(v) => `${v}%`}
              label={{ value: "Budget Targeted (% of Customers)", position: "insideBottom", offset: -5, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <YAxis
              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <Tooltip
              formatter={(val, name) => {
                if (name === "selected_band") {
                  if (Array.isArray(val)) {
                    return [`${formatCurrency(val[0], 0)} to ${formatCurrency(val[1], 0)}`, `${selectedLabel} (Range)`];
                  }
                  return [String(val), "Range"];
                }
                const label = POLICY_METRICS[name as PolicyId]?.label || String(name);
                return [formatCurrency(Number(val ?? 0), 0), label];
              }}
              labelFormatter={(label) => `Targeting Budget: Top ${label}%`}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "#334155",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#f8fafc",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
              }}
            />

            {/* Zero break-even reference line */}
            <ReferenceLine
              y={0}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ value: "Break-even ($0)", position: "left", fontSize: 10, fill: "#94a3b8" }}
            />

            {/* Selected budget vertical marker */}
            <ReferenceLine
              x={Math.round(budgetFraction * 100)}
              stroke="#0f766e"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{
                value: `Selected (${Math.round(budgetFraction * 100)}%)`,
                position: "top",
                fontSize: 11,
                fill: "#0f766e",
                fontWeight: 600,
              }}
            />

            {/* Variation band for selected policy only */}
            <Area
              type="monotone"
              dataKey="selected_band"
              name="selected_band"
              fill="#0f766e"
              stroke="none"
              fillOpacity={0.14}
              isAnimationActive={false}
              legendType="none"
            />

            {/* Render lines for all policies */}
            {Object.keys(policies).map((polId) => {
              const meta = POLICY_METRICS[polId as PolicyId] || { label: polId, color: "#94a3b8" };
              const isSelected = polId === selectedPolicy;
              return (
                <Line
                  key={polId}
                  type="monotone"
                  dataKey={polId}
                  name={polId}
                  stroke={meta.color}
                  strokeWidth={isSelected ? 3 : 1.75}
                  strokeDasharray={meta.strokeDasharray}
                  opacity={isSelected ? 1.0 : 0.45}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}

            <Legend
              formatter={(value) => {
                if (value === "selected_band") return "";
                const isSelected = value === selectedPolicy;
                const label = POLICY_METRICS[value as PolicyId]?.label || value;
                return (
                  <span className={isSelected ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    {label} {isSelected ? "(Selected)" : ""}
                  </span>
                );
              }}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
