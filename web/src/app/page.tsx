"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import PipelineDiagram from "@/components/PipelineDiagram";
import { fetchResultsData, fetchProfitGridData } from "@/lib/data";
import { ResultsData, ProfitGridData } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";

export default function OverviewPage() {
  const [results, setResults] = useState<ResultsData | null>(null);
  const [profitGrid, setProfitGrid] = useState<ProfitGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchResultsData(), fetchProfitGridData()])
      .then(([rData, pData]) => {
        setResults(rData);
        setProfitGrid(pData);
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
        <p className="text-sm text-slate-500">Loading benchmark results...</p>
      </div>
    );
  }

  if (error || !results || !profitGrid) {
    return (
      <div className="py-12 p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
        <h3 className="font-semibold text-base">Failed to load benchmark data</h3>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const { meta, models, paired_tests } = results;

  // Extract key statistics from data
  const xLearner = models.find((m) => m.model_id === "x_learner_lr");
  const baselineLR = models.find((m) => m.model_id === "baseline_response_lr");
  const xVsBaselineTest = paired_tests.find(
    (t) => t.model_a === "x_learner_lr" && t.model_b === "baseline_response_lr"
  );

  const everyoneProfitDefault =
    profitGrid.n_pop * 1.0 * (profitGrid.default_margin * profitGrid.everyone.delta_spend_mean - profitGrid.default_cost);

  return (
    <div className="space-y-10">
      {/* Hero section */}
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          ML Course Project &bull; Uplift Modeling & Causality
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Stop Paying Customers Who Would&apos;ve Bought Anyway
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
          Standard response models predict who is likely to purchase, systematically targeting
          high-intent customers who would have bought even without marketing. Uplift modeling
          uses randomized controlled trial (RCT) data to estimate the <em>incremental causal impact</em> of
          interventions, isolating persuadable customers from non-responders and sure things.
        </p>
      </section>

      {/* Pipeline Diagram */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Evaluation & Decision Pipeline
        </h2>
        <PipelineDiagram />
      </section>

      {/* Dataset Facts Grid */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Dataset Facts (Kevin Hillstrom Email Analytics)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Rows</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatNumber(meta.n_rows)}
            </div>
            <span className="text-[11px] text-slate-400">70/30 split ({formatNumber(meta.n_test)} test)</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Treated Group</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatNumber(meta.n_treated)}
            </div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
              {formatPercent(meta.visit_rate_treated)} visit rate
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Control Group</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {formatNumber(meta.n_control)}
            </div>
            <span className="text-[11px] text-slate-500">
              {formatPercent(meta.visit_rate_control)} visit rate
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Visit ATE</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +{formatPercent(meta.ate_visit)}
            </div>
            <span className="text-[11px] text-slate-400">Incremental visit rate</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Spend ATE (Full Data)</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              +{formatCurrency(meta.ate_spend)}
            </div>
            <span className="text-[11px] text-slate-400">
              {formatCurrency(meta.spend_rate_treated)} vs {formatCurrency(meta.spend_rate_control)}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Spenders</span>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {formatPercent(meta.spender_rate)}
            </div>
            <span className="text-[11px] text-slate-400">
              {meta.n_spenders} of {formatNumber(meta.n_rows)} customers
            </span>
          </div>
        </div>
      </section>

      {/* 3 Headline Findings (Honest and rigorous) */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Three Honest Headline Findings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Finding 1 */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>1. Modest Ranking Gain, Not Significant</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Uplift models rank customers somewhat better than the naive response model (X-Learner LR
              Qini: <strong>{xLearner?.qini_normalized_mean.toFixed(4)}</strong> vs Baseline LR:{" "}
              <strong>{baselineLR?.qini_normalized_mean.toFixed(4)}</strong>), but the differences are{" "}
              <strong>not statistically significant</strong> after Nadeau-Bengio split variance correction and
              Holm-Bonferroni adjustment (t = {xVsBaselineTest?.t_stat.toFixed(2)}, raw p ={" "}
              {xVsBaselineTest?.p_value_raw.toFixed(4)}, Holm p ={" "}
              {xVsBaselineTest?.p_value_holm.toFixed(4)}).
            </p>
          </div>

          {/* Finding 2 */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>2. Default Assumptions Favor Mass Mailing</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              At default business assumptions (<strong>{formatPercent(meta.default_margin, 0)} margin</strong> and{" "}
              <strong>{formatCurrency(meta.default_cost)} per email</strong>), emailing 100% of customers is the
              most profitable option (expected profit of <strong>{formatCurrency(everyoneProfitDefault, 0)}</strong> per 100k
              customers). The average incremental spend easily covers the low $0.05 email cost.
            </p>
          </div>

          {/* Finding 3 */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>3. Selective Targeting Pays at Higher Costs</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              At higher contact costs, selective targeting can earn more profit in-sample, but the differences are
              within split-to-split variation. High spend sparsity (only {formatPercent(meta.spender_rate)} spenders)
              means empirical dollar profit carries wide noise across sample partitions.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Actions */}
      <section className="pt-2 flex flex-wrap gap-3">
        <Link
          href="/simulator"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
        >
          <span>Launch Interactive Profit Simulator</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/models"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors"
        >
          <span>Explore Benchmark & Statistical Tests</span>
        </Link>
      </section>
    </div>
  );
}
