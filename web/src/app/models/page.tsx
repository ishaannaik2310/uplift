"use client";

import React, { useEffect, useState } from "react";
import QiniChart from "@/components/QiniChart";
import DecileChart from "@/components/DecileChart";
import { SkeletonCard, SkeletonChart, ErrorState } from "@/components/SkeletonLoader";
import { fetchResultsData } from "@/lib/data";
import { ResultsData } from "@/lib/types";
import { formatPercent } from "@/lib/formatters";
import { HelpCircle, Award, Scale, CheckCircle2, MinusCircle } from "lucide-react";

export default function ModelsPage() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchResultsData()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load model data");
        setLoading(false);
      });
  }, [reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="space-y-3 max-w-3xl">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard count={3} />
        </div>
        <SkeletonChart />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load model benchmark data"
        message={error}
        onRetry={handleRetry}
      />
    );
  }

  const { models, paired_tests, qini_curves, deciles_seed0, units } = data;

  // Best values per column for table highlighting
  const bestNormalizedQini = Math.max(...models.map((m) => m.qini_normalized_mean));
  const bestQiniPerN = Math.max(...models.map((m) => m.qini_per_N_mean));
  const bestAuucNorm = Math.max(...models.map((m) => m.auuc_norm_mean));
  const bestTop30 = Math.max(...models.map((m) => m.uplift_top30_mean));

  // Summary highlights
  const bestModel = [...models].sort((a, b) => b.qini_normalized_mean - a.qini_normalized_mean)[0];
  const baselineLR = models.find((m) => m.model_id === "baseline_response_lr") || models[0];
  const bestVsBaselineTest = paired_tests.find(
    (t) =>
      (t.model_a === bestModel?.model_id && t.model_b === baselineLR.model_id) ||
      (t.model_b === bestModel?.model_id && t.model_a === baselineLR.model_id)
  );

  return (
    <div className="space-y-12">
      {/* Header */}
      <section className="space-y-3">
        <h1 className="text-2xl sm:text-4xl font-serif font-bold text-slate-900 dark:text-white tracking-tight break-words">
          Model Benchmarks &amp; Statistical Rigor
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
          Evaluation of S, T, and X-Learners with Logistic Regression and XGBoost base learners
          across 10 repeated stratified 70/30 splits of the Kevin Hillstrom email dataset.
        </p>
      </section>

      {/* Summary KPI Cards: Best vs Baseline & Rigor Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Highest mean normalized Qini */}
        <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Highest mean normalized Qini</span>
            <Award className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-serif text-slate-900 dark:text-white">
            {bestModel?.model}
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-mono tabular">
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              {bestModel?.qini_normalized_mean.toFixed(4)}
            </span>{" "}
            <span className="text-slate-400 font-sans">
              &plusmn; {bestModel?.qini_normalized_std.toFixed(4)}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <div className="font-mono tabular">
              Baseline ({baselineLR.model}):{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {baselineLR.qini_normalized_mean.toFixed(4)}
              </span>{" "}
              <span className="text-slate-400 font-sans">
                &plusmn; {baselineLR.qini_normalized_std.toFixed(4)}
              </span>
            </div>
            <div className="text-slate-500 font-sans pt-0.5">
              Difference vs baseline:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {bestVsBaselineTest?.significance.startsWith("significant")
                  ? "significant at 0.05 after Holm adjustment"
                  : "not significant after Holm adjustment"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Resampling Framework */}
        <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Validation Rigor</span>
            <Scale className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-serif text-slate-900 dark:text-white tabular">
            10 Repeated Splits
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Stratified 70/30 train/test splits (Seeds 0&ndash;9)
          </div>
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
            Avoids single-split luck. Variances corrected with Nadeau-Bengio (2003) overlap formula.
          </p>
        </div>

        {/* Card 3: Significance Verdict */}
        <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Holm-Adjusted Verdict</span>
            <MinusCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-serif text-slate-900 dark:text-white">
            Not Significant
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Uplift ranking difference vs baseline response
          </div>
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
            Corrected Holm-Bonferroni p-values &gt; 0.05. Treatment heterogeneity in this RCT is modest.
          </p>
        </div>
      </section>

      {/* Model Benchmark Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Multi-Seed Performance Summary (10 Splits)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Best values per column highlighted in bold. Base learners indicated via tags.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/90 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">Model</th>
                <th className="py-3.5 px-3 font-medium uppercase tracking-wider text-[11px]">Base Learner</th>
                <th className="py-3.5 px-4 text-right font-medium uppercase tracking-wider text-[11px]">
                  Normalized Qini (mean &plusmn; std)
                </th>
                <th className="py-3.5 px-4 text-right font-medium uppercase tracking-wider text-[11px]">
                  Qini / Customer
                </th>
                <th className="py-3.5 px-4 text-right font-medium uppercase tracking-wider text-[11px]">
                  AUUC Norm
                </th>
                <th className="py-3.5 px-4 text-right font-medium uppercase tracking-wider text-[11px]">
                  Top 30% Uplift
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {models.map((m) => {
                const isBestQini = Math.abs(m.qini_normalized_mean - bestNormalizedQini) < 1e-4;
                const isBestQiniN = Math.abs(m.qini_per_N_mean - bestQiniPerN) < 1e-4;
                const isBestAuuc = Math.abs(m.auuc_norm_mean - bestAuucNorm) < 1e-4;
                const isBestTop30 = Math.abs(m.uplift_top30_mean - bestTop30) < 1e-4;

                return (
                  <tr
                    key={m.model_id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {m.model}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
                        {m.base_learner}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular">
                      <span className={isBestQini ? "font-bold text-teal-700 dark:text-teal-400" : "text-slate-900 dark:text-white"}>
                        {m.qini_normalized_mean.toFixed(4)}
                      </span>{" "}
                      <span className="text-slate-400 text-[11px] font-sans">
                        &plusmn; {m.qini_normalized_std.toFixed(4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular">
                      <span className={isBestQiniN ? "font-bold text-teal-700 dark:text-teal-400" : "text-slate-600 dark:text-slate-300"}>
                        {m.qini_per_N_mean.toFixed(4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular">
                      <span className={isBestAuuc ? "font-bold text-teal-700 dark:text-teal-400" : "text-slate-600 dark:text-slate-300"}>
                        {m.auuc_norm_mean.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular">
                      <span className={isBestTop30 ? "font-bold text-emerald-700 dark:text-emerald-400" : "text-emerald-600 dark:text-emerald-400 font-medium"}>
                        {formatPercent(m.uplift_top30_mean, 2)}
                      </span>{" "}
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

      {/* Metric Definitions & Units Box */}
      <section className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>Metric Definitions &amp; Units Reference</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {Object.entries(units).map(([key, desc]) => (
            <div key={key} className="space-y-0.5">
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">{key}:</span>{" "}
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Statistical Rigor Table with Plain-Text Badges */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nadeau-Bengio Corrected Resampled t-Tests (J=10 splits)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Accounting for split correlation: Var(d) = (1/J + n_test/n_train) &times; s&sup2;, df = 9.
              Multiple comparisons adjusted via step-down Holm-Bonferroni.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/90 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">Comparison</th>
                <th className="py-3.5 px-3 text-right font-medium uppercase tracking-wider text-[11px]">Mean Diff</th>
                <th className="py-3.5 px-3 text-right font-medium uppercase tracking-wider text-[11px]">Std Diff</th>
                <th className="py-3.5 px-3 text-right font-medium uppercase tracking-wider text-[11px]">t-stat</th>
                <th className="py-3.5 px-3 text-right font-medium uppercase tracking-wider text-[11px]">Raw p</th>
                <th className="py-3.5 px-3 text-right font-medium uppercase tracking-wider text-[11px]">Holm p</th>
                <th className="py-3.5 px-4 font-medium uppercase tracking-wider text-[11px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paired_tests.map((t, idx) => {
                const isSig = t.significance.startsWith("significant");
                return (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {t.model_a} <span className="text-slate-400 font-sans font-normal">vs</span> {t.model_b}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular">
                      {t.mean_diff > 0 ? `+${t.mean_diff.toFixed(4)}` : t.mean_diff.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-500 tabular">
                      {t.std_diff.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular">
                      {t.t_stat.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-500 tabular">
                      {t.p_value_raw.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular">
                      {t.p_value_holm.toFixed(4)}
                    </td>
                    <td className="py-3 px-4">
                      {isSig ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Significant at 0.05 after Holm adjustment</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
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
      <section className="space-y-4">
        <QiniChart curves={qini_curves} />
      </section>

      {/* Decile Profile Bar Chart */}
      <section className="space-y-4">
        <DecileChart deciles={deciles_seed0} />
      </section>
    </div>
  );
}
