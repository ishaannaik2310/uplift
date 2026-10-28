"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { QiniCurveData } from "@/lib/types";

interface QiniChartProps {
  curves: Record<string, QiniCurveData>;
}

// Distinct stroke dash patterns and accessible high-contrast palette
// Lines are identifiable even in monochrome / grayscale
const MODEL_CONFIG: Record<
  string,
  { label: string; color: string; strokeDasharray?: string; strokeWidth?: number }
> = {
  x_learner_lr: { label: "X-Learner (LR)", color: "#0f766e", strokeDasharray: "", strokeWidth: 2.5 },
  t_learner_lr: { label: "T-Learner (LR)", color: "#0284c7", strokeDasharray: "6 3", strokeWidth: 2.5 },
  s_learner_xgb: { label: "S-Learner (XGB)", color: "#d97706", strokeDasharray: "4 2 1 2", strokeWidth: 2.5 },
  baseline_response_lr: { label: "Baseline Response (LR)", color: "#e11d48", strokeDasharray: "2 2", strokeWidth: 2 },
  random: { label: "Random Targeting", color: "#64748b", strokeDasharray: "5 5", strokeWidth: 1.5 },
  baseline_response_xgb: { label: "Baseline Response (XGB)", color: "#f43f5e", strokeDasharray: "3 3", strokeWidth: 1.5 },
  s_learner_lr: { label: "S-Learner (LR)", color: "#b45309", strokeDasharray: "8 4", strokeWidth: 1.5 },
  t_learner_xgb: { label: "T-Learner (XGB)", color: "#38bdf8", strokeDasharray: "4 4", strokeWidth: 1.5 },
  x_learner_xgb: { label: "X-Learner (XGB)", color: "#14b8a6", strokeDasharray: "2 4", strokeWidth: 1.5 },
};

export default function QiniChart({ curves }: QiniChartProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "x_learner_lr",
    "t_learner_lr",
    "s_learner_xgb",
    "baseline_response_lr",
    "random",
  ]);

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((m) => m !== id)
          : prev // keep at least 1
        : [...prev, id]
    );
  };

  const randomCurve = curves["random"];
  if (!randomCurve || !randomCurve.fraction) return null;

  const chartData = randomCurve.fraction.map((frac, idx) => {
    const point: Record<string, number> = {
      fraction: Math.round(frac * 100),
    };
    for (const [mid, cData] of Object.entries(curves)) {
      if (cData.mean && cData.mean[idx] !== undefined) {
        point[mid] = Number(cData.mean[idx].toFixed(2));
      }
    }
    return point;
  });

  return (
    <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Qini Curves Across 10 Repeated Splits
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mean cumulative incremental visits above control across targeted fractions. Dash styles distinguish models.
          </p>
        </div>

        {/* Model Chips Selector */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Toggle models on Qini curve">
          {Object.keys(curves).map((mid) => {
            const isSelected = selectedModels.includes(mid);
            const cfg = MODEL_CONFIG[mid] || { label: mid, color: "#64748b" };
            return (
              <button
                key={mid}
                onClick={() => toggleModel(mid)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-xs"
                    : "bg-transparent text-slate-400 border-dashed border-slate-300/60 dark:border-slate-700/60 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                aria-pressed={isSelected}
              >
                <span
                  className="w-2.5 h-1.5 rounded-sm inline-block shrink-0"
                  style={{
                    backgroundColor: isSelected ? cfg.color : "transparent",
                    border: isSelected ? "none" : "1px solid #94a3b8",
                  }}
                />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Screen reader text summary for accessibility */}
      <div className="sr-only">
        Chart showing Qini curves for {selectedModels.length} models across 10 resampled splits.
        X-Learner LR and T-Learner LR reach peak cumulative incremental lift in the top 20% to 40% targeting range.
      </div>

      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" className="dark:stroke-slate-800/80" />
            <XAxis
              dataKey="fraction"
              tickFormatter={(v) => `${v}%`}
              label={{ value: "Targeted Customer Fraction (%)", position: "insideBottom", offset: -5, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <YAxis
              label={{ value: "Cumulative Incremental Visits", angle: -90, position: "insideLeft", offset: 15, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <Tooltip
              formatter={(value, name) => [
                Number(value ?? 0).toFixed(2),
                MODEL_CONFIG[String(name)]?.label || String(name),
              ]}
              labelFormatter={(label) => `Budget: Top ${label}%`}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "#334155",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#f8fafc",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
              }}
            />
            <Legend
              formatter={(value) => MODEL_CONFIG[value]?.label || value}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            {selectedModels.map((mid) => {
              const cfg = MODEL_CONFIG[mid] || { label: mid, color: "#64748b" };
              return (
                <Line
                  key={mid}
                  type="monotone"
                  dataKey={mid}
                  name={mid}
                  stroke={cfg.color}
                  strokeWidth={cfg.strokeWidth || 2}
                  strokeDasharray={cfg.strokeDasharray}
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
