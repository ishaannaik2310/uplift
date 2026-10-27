"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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

const POLICY_METRICS: Record<PolicyId, { label: string; color: string }> = {
  t_learner_lr: { label: "T-Learner (LR)", color: "#2563eb" },
  x_learner_lr: { label: "X-Learner (LR)", color: "#0d9488" },
  s_learner_xgb: { label: "S-Learner (XGB)", color: "#7c3aed" },
  response_lr: { label: "Response Model (LR)", color: "#e11d48" },
  random: { label: "Random Targeting", color: "#64748b" },
};

export default function ProfitChart({
  profitGrid,
  margin,
  cost,
  selectedPolicy,
  budgetFraction,
}: ProfitChartProps) {
  const { n_pop, fractions, policies, everyone } = profitGrid;

  // Build chart points for each fraction f
  const data = fractions.map((f, idx) => {
    const pt: Record<string, number> = {
      fraction: Math.round(f * 100),
    };
    for (const [polId, pData] of Object.entries(policies)) {
      const delta = pData.delta_spend_mean[idx];
      const prof = n_pop * f * (margin * delta - cost);
      pt[polId] = Math.round(prof);
    }
    return pt;
  });

  // Calculate target everyone at f=1.0
  const everyoneProfit = Math.round(n_pop * 1.0 * (margin * everyone.delta_spend_mean - cost));

  return (
    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Campaign Profit vs Budget Targeted
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scaled to 100,000 customers &bull; Margin: {(margin * 100).toFixed(0)}% &bull; Cost: ${cost.toFixed(2)}/email
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Target Everyone (100%):{" "}
          <strong className="text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(everyoneProfit, 0)}
          </strong>
        </div>
      </div>

      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
            <XAxis
              dataKey="fraction"
              tickFormatter={(v) => `${v}%`}
              label={{ value: "Budget (% Targeted)", position: "insideBottom", offset: -5, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <YAxis
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <Tooltip
              formatter={(val, name) => [
                formatCurrency(Number(val ?? 0), 0),
                POLICY_METRICS[name as PolicyId]?.label || String(name),
              ]}
              labelFormatter={(label) => `Budget: Top ${label}%`}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "#334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f8fafc",
              }}
            />
            {/* Zero break-even line */}
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "Break-even ($0)", position: "left", fontSize: 10 }} />
            {/* Selected budget line */}
            <ReferenceLine
              x={Math.round(budgetFraction * 100)}
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{ value: `Selected (${Math.round(budgetFraction * 100)}%)`, position: "top", fontSize: 10, fill: "#6366f1" }}
            />
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
                  strokeWidth={isSelected ? 3 : 1.5}
                  opacity={isSelected ? 1.0 : 0.4}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
