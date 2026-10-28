"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DecileRecord } from "@/lib/types";

interface DecileChartProps {
  deciles: Record<string, DecileRecord[]>;
}

const MODEL_NAMES: Record<string, string> = {
  x_learner_lr: "X-Learner (LR)",
  t_learner_lr: "T-Learner (LR)",
  s_learner_xgb: "S-Learner (XGBoost)",
  baseline_response_lr: "Baseline Response (LR)",
  random: "Random Targeting",
  baseline_response_xgb: "Baseline Response (XGB)",
  s_learner_lr: "S-Learner (LR)",
  t_learner_xgb: "T-Learner (XGB)",
  x_learner_xgb: "X-Learner (XGB)",
};

export default function DecileChart({ deciles }: DecileChartProps) {
  const [selectedModel, setSelectedModel] = useState<string>("x_learner_lr");

  const modelDeciles = deciles[selectedModel] || [];

  const chartData = modelDeciles.map((d) => ({
    decile: `D${d.decile}`,
    fullDecile: `Decile ${d.decile}`,
    rate_t: Number((d.rate_t * 100).toFixed(2)),
    rate_c: Number((d.rate_c * 100).toFixed(2)),
    uplift: Number((d.uplift * 100).toFixed(2)),
  }));

  return (
    <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Decile Uplift Profile
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Seed 0 Test Split Only
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Treated vs control visit rates and incremental lift sorted by predicted score deciles (D1 highest score)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="decile-model-select" className="text-xs text-slate-500 font-medium">
            Select Model:
          </label>
          <select
            id="decile-model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
          >
            {Object.keys(deciles).map((mid) => (
              <option key={mid} value={mid}>
                {MODEL_NAMES[mid] || mid}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sr-only">
        Decile uplift bar chart for {MODEL_NAMES[selectedModel] || selectedModel}.
        Higher deciles demonstrate higher incremental visit lift between treated and control groups.
      </div>

      <div className="h-80 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" className="dark:stroke-slate-800/80" />
            <XAxis dataKey="decile" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
              tickFormatter={(v) => `${v}%`}
              label={{ value: "Visit Rate / Incremental Lift (%)", angle: -90, position: "insideLeft", offset: 15, fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value ?? 0).toFixed(2)}%`,
                name === "rate_t"
                  ? "Treated Visit Rate"
                  : name === "rate_c"
                  ? "Control Visit Rate"
                  : "Incremental Uplift",
              ]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDecile || ""}
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
              formatter={(value) =>
                value === "rate_t"
                  ? "Treated Visit Rate"
                  : value === "rate_c"
                  ? "Control Visit Rate"
                  : "Incremental Uplift"
              }
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            <Bar dataKey="rate_t" fill="#0f766e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="rate_c" fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="uplift" fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
