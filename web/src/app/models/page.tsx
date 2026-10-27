"use client";

import React, { useEffect, useState } from "react";
import QiniChart from "@/components/QiniChart";
import DecileChart from "@/components/DecileChart";
import { fetchResultsData } from "@/lib/data";
import { ResultsData } from "@/lib/types";
import { formatPercent } from "@/lib/formatters";
import { HelpCircle, CheckCircle2 } from "lucide-react";

export default function ModelsPage() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResultsData()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading model benchmarks and statistical tests...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
        <h3 className="font-semibold text-base">Error loading model data</h3>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const { models, paired_tests, qini_curves, deciles_seed0, units } = data;

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Model Benchmarks &amp; Statistical Rigor
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-3xl">
          Evaluation of S, T, and X-Learners with Logistic Regression and XGBoost base learners
          across 10 repeated stratified 70/30 splits of the Kevin Hillstrom email dataset.
        </p>
      </section>

      {/* Model Benchmark Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Multi-Seed Performance Summary (10 Splits)
          </h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-3">Base</th>
                <th className="py-3 px-4 text-right">Normalized Qini (mean &plusmn; std)</th>
                <th className="py-3 px-4 text-right">Qini / Customer</th>
                <th className="py-3 px-4 text-right">AUUC Norm</th>
                <th className="py-3 px-4 text-right">Top 30% Uplift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {models.map((m) => {
                const isUpliftTop = ["x_learner_lr", "t_learner_lr", "s_learner_xgb"].includes(m.model_id);
                return (
                  <tr
                    key={m.model_id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                      isUpliftTop ? "bg-indigo-50/20 dark:bg-indigo-950/10 font-medium" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-white">
                      {m.model}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {m.base_learner}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 dark:text-white">
                      {m.qini_normalized_mean.toFixed(4)}{" "}
                      <span className="text-slate-400 text-[11px] font-sans">
                        &plusmn; {m.qini_normalized_std.toFixed(4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                      {m.qini_per_N_mean.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                      {m.auuc_norm_mean.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatPercent(m.uplift_top30_mean, 2)}{" "}
                      <span className="text-slate-400 text-[11px] font-sans font-normal">
                        &plusmn; {formatPercent(m.uplift_top30_std, 2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Metric Units Reference Box */}
      <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          <HelpCircle className="w-4 h-4 text-indigo-500" />
          <span>Metric Definitions &amp; Units</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
          {Object.entries(units).map(([key, desc]) => (
            <div key={key} className="space-y-0.5">
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">{key}:</span>{" "}
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Statistical Rigor Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nadeau-Bengio Corrected Resampled t-Tests (J=10 splits)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Accounting for split correlation: Var(d) = (1/J + n_test/n_train) &times; s&sup2;, df = 9.
              Multiple comparisons adjusted via step-down Holm-Bonferroni.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Comparison</th>
                <th className="py-3 px-3 text-right">Mean Diff</th>
                <th className="py-3 px-3 text-right">Std Diff</th>
                <th className="py-3 px-3 text-right">t-stat</th>
                <th className="py-3 px-3 text-right">Raw p</th>
                <th className="py-3 px-3 text-right">Holm p</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paired_tests.map((t, idx) => {
                const isSig = t.significance.startsWith("significant");
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-white">
                      {t.model_a} <span className="text-slate-400 font-sans">vs</span> {t.model_b}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs">
                      {t.mean_diff > 0 ? `+${t.mean_diff.toFixed(4)}` : t.mean_diff.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-500">
                      {t.std_diff.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs">
                      {t.t_stat.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-500">
                      {t.p_value_raw.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold">
                      {t.p_value_holm.toFixed(4)}
                    </td>
                    <td className="py-3 px-4">
                      {isSig ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Significant at 0.05
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Not significant
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Interactive Qini Curves Chart */}
      <section className="space-y-3">
        <QiniChart curves={qini_curves} />
      </section>

      {/* Decile Profile Bar Chart */}
      <section className="space-y-3">
        <DecileChart deciles={deciles_seed0} />
      </section>
    </div>
  );
}
