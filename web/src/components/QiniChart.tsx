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
} from "recharts";
import { QiniCurveData } from "@/lib/types";

interface QiniChartProps {
  curves: Record<string, QiniCurveData>;
}

const MODEL_COLORS: Record<string, { color: string; strokeDasharray?: string }> = {
  baseline_response_lr: { color: "#e11d48", strokeDasharray: "4 4" },
  baseline_response_xgb: { color: "#f43f5e", strokeDasharray: "2 2" },
  random: { color: "#64748b", strokeDasharray: "5 5" },
  s_learner_lr: { color: "#f59e0b" },
  s_learner_xgb: { color: "#7c3aed" },
  t_learner_lr: { color: "#2563eb" },
  t_learner_xgb: { color: "#60a5fa", strokeDasharray: "3 3" },
  x_learner_lr: { color: "#0d9488" },
  x_learner_xgb: { color: "#14b8a6", strokeDasharray: "3 3" },
};

const MODEL_LABELS: Record<string, string> = {
  baseline_response_lr: "Baseline Response (LR)",
  baseline_response_xgb: "Baseline Response (XGB)",
  random: "Random Targeting",
  s_learner_lr: "S-Learner (LR)",
  s_learner_xgb: "S-Learner (XGB)",
  t_learner_lr: "T-Learner (LR)",
  t_learner_xgb: "T-Learner (XGB)",
  x_learner_lr: "X-Learner (LR)",
  x_learner_xgb: "X-Learner (XGB)",
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
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  // Build combined data array for Recharts from common 101-point fraction grid
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
    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Qini Curves Across 10 Repeated Splits
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mean cumulative incremental visits above control across targeted customer fractions
          </p>
        </div>

        {/* Model toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(curves).map((mid) => {
            const isSelected = selectedModels.includes(mid);
            const style = MODEL_COLORS[mid] || { color: "#64748b" };
            return (
              <button
                key={mid}
                onClick={() => toggleModel(mid)}
                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                    : "bg-transparent text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: isSelected ? style.color : "#94a3b8" }}
                />
                {MODEL_LABELS[mid] || mid}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
            <XAxis
              dataKey="fraction"
              tickFormatter={(v) => `${v}%`}
              label={{ value: "Targeted Population (%)", position: "insideBottom", offset: -5, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <YAxis
              label={{ value: "Cumulative Incremental Visits (Qini)", angle: -90, position: "insideLeft", offset: 15, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
            />
            <Tooltip
              formatter={(value, name) => [
                Number(value ?? 0).toFixed(2),
                MODEL_LABELS[String(name)] || String(name),
              ]}
              labelFormatter={(label) => `Targeted: Top ${label}%`}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                borderColor: "#334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f8fafc",
              }}
            />
            {selectedModels.map((mid) => {
              const style = MODEL_COLORS[mid] || { color: "#64748b" };
              return (
                <Line
                  key={mid}
                  type="monotone"
                  dataKey={mid}
                  name={mid}
                  stroke={style.color}
                  strokeWidth={2}
                  strokeDasharray={style.strokeDasharray}
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
